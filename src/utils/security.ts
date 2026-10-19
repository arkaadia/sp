import { Request, Response, NextFunction } from 'express';

/**
 * Elysian Sprite Studio - Security, SSRF Prevention & Sanitization Utility
 */

// Private & Cloud Metadata IPv4 regex checks
const IPV4_BLOCKED_PATTERNS = [
  /^127\./,                         // Loopback (127.0.0.0/8)
  /^10\./,                          // Private class A (10.0.0.0/8)
  /^192\.168\./,                    // Private class C (192.168.0.0/16)
  /^169\.254\./,                    // Link-local / Cloud Metadata (169.254.0.0/16)
  /^0\./,                           // Current network (0.0.0.0/8)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // CGNAT (100.64.0.0/10)
  /^192\.0\.2\./,                   // TEST-NET-1
  /^198\.51\.100\./,                // TEST-NET-2
  /^203\.0\.113\./,                 // TEST-NET-3
  /^224\./,                         // Multicast
  /^240\./,                         // Reserved
];

function isPrivateClassB(ip: string): boolean {
  const match = ip.match(/^172\.(\d+)\./);
  if (!match) return false;
  const secondOctet = parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
];

/**
 * Validates custom endpoint URL against SSRF, private networks, cloud metadata, and unsafe protocols.
 * Returns null if valid, or a descriptive error message if blocked.
 */
export function validateEndpointUrl(urlString: string): { valid: boolean; error?: string; url?: URL } {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'Endpoint URL must be a non-empty string.' };
  }

  const trimmed = urlString.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: `Invalid URL format: '${trimmed}'. Must be a valid HTTP or HTTPS URL.` };
  }

  // Protocol check - only HTTP and HTTPS allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `Unsafe protocol '${parsed.protocol}'. Only 'http:' and 'https:' are permitted.`
    };
  }

  // Reject user credentials in URL (e.g. http://user:pass@example.com)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'URLs containing embedded credentials (user:password@) are not allowed.'
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname) || hostname.endsWith('.localhost')) {
    return {
      valid: false,
      error: `SSRF Protection: Access to '${hostname}' (loopback/internal service) is blocked.`
    };
  }

  // Check IPv6 loopback and unique local
  if (
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    hostname.startsWith('fe80')
  ) {
    return {
      valid: false,
      error: 'SSRF Protection: Access to IPv6 loopback or private addresses is blocked.'
    };
  }

  // Check numeric / decimal / hex encoded IPv4 addresses (e.g., 2130706433 or 0x7f000001)
  if (/^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)) {
    return {
      valid: false,
      error: 'SSRF Protection: Numeric or hexadecimal encoded IP addresses are blocked.'
    };
  }

  // Check standard IPv4 format
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    // Check octet bounds
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some(o => o < 0 || o > 255)) {
      return { valid: false, error: 'Invalid IPv4 address format.' };
    }

    // Check blocked IPv4 ranges
    for (const pattern of IPV4_BLOCKED_PATTERNS) {
      if (pattern.test(hostname)) {
        return {
          valid: false,
          error: `SSRF Protection: Access to private or metadata IP range '${hostname}' is blocked.`
        };
      }
    }

    if (isPrivateClassB(hostname)) {
      return {
        valid: false,
        error: `SSRF Protection: Access to private network range 172.16.0.0/12 ('${hostname}') is blocked.`
      };
    }
  }

  // Disallow non-standard reserved ports (e.g., SMTP, SSH, Redis, internal ports)
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    const blockedPorts = [21, 22, 23, 25, 53, 69, 110, 143, 6379, 11211, 27017, 3306, 5432, 9200];
    if (blockedPorts.includes(portNum)) {
      return {
        valid: false,
        error: `SSRF Protection: Connection to restricted port ${portNum} is blocked.`
      };
    }
  }

  return { valid: true, url: parsed };
}

/**
 * Redacts API keys, bearer tokens, and secrets from logs and error messages.
 */
export function redactSecrets(input: string | any): string {
  if (typeof input !== 'string') {
    if (input === null || input === undefined) return '';
    try {
      input = JSON.stringify(input);
    } catch {
      input = String(input);
    }
  }

  return input
    // OpenAI and standard sk- keys
    .replace(/sk-[a-zA-Z0-9_\-]{16,}/g, 'sk-[REDACTED]')
    // Google Gemini API keys (AIza...)
    .replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza[REDACTED]')
    // Bearer tokens
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, 'Bearer [REDACTED]')
    // Password / apiKey fields in query or JSON
    .replace(/(["']?apiKey["']?\s*[:=]\s*["'])([^"']{4,})(["'])/gi, '$1[REDACTED]$3')
    .replace(/(["']?password["']?\s*[:=]\s*["'])([^"']{4,})(["'])/gi, '$1[REDACTED]$3');
}

/**
 * In-memory sliding-window rate limiter
 */
interface RateLimitRecord {
  timestamps: number[];
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Periodically clean up old entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter(t => now - t < options.windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 60000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Derive client identifier (IP address or fallback)
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
                     req.socket.remoteAddress ||
                     'unknown-client';

    const now = Date.now();
    let record = store.get(clientIp);

    if (!record) {
      record = { timestamps: [] };
      store.set(clientIp, record);
    }

    // Filter to only timestamps inside the current window
    record.timestamps = record.timestamps.filter(t => now - t < options.windowMs);

    if (record.timestamps.length >= options.maxRequests) {
      const oldestInWindow = record.timestamps[0];
      const retryAfterSeconds = Math.ceil((options.windowMs - (now - oldestInWindow)) / 1000);

      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);

      return res.status(429).json({
        error: options.message || 'Too many requests. Please wait before making more requests.',
        retryAfterSeconds
      });
    }

    record.timestamps.push(now);
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.timestamps.length));

    next();
  };
}

/**
 * Downloads a remote image safely with SSRF validation, size limits (25MB max), and timeout (15s).
 */
export async function fetchSafeImage(imageUrl: string, maxSizeBytes: number = 25 * 1024 * 1024): Promise<Buffer> {
  // Validate image URL with SSRF protection
  const validation = validateEndpointUrl(imageUrl);
  if (!validation.valid) {
    throw new Error(`Unsafe image download URL: ${validation.error}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      redirect: 'follow', // Fetch standard redirects
    });

    if (!response.ok) {
      throw new Error(`Failed to download image (HTTP ${response.status}): ${response.statusText}`);
    }

    // Check Content-Length header if provided
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      throw new Error(`Image size exceeds the allowed limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`);
    }

    // Stream / read with strict size enforcement
    if (!response.body) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxSizeBytes) {
        throw new Error(`Image size exceeds the allowed limit of ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`);
      }
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        receivedBytes += value.length;
        if (receivedBytes > maxSizeBytes) {
          reader.cancel();
          throw new Error(`Image download aborted: size exceeded ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`);
        }
        chunks.push(value);
      }
    }

    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timeoutId);
  }
}
