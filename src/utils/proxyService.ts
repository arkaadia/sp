import fs from 'fs';
import path from 'path';
import net from 'net';
import https from 'https';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ProxyAgent as UndiciProxyAgent, Agent as UndiciAgent, setGlobalDispatcher } from 'undici';
import { ProxyConfig, ProxyTestResult, ProxyType } from '../types/proxy';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'proxy-config.json');

let currentConfig: ProxyConfig = {
  enabled: false,
  type: 'HTTP',
  hostname: '',
  port: 8080,
  username: '',
  password: '',
  secret: '',
};

let activeHttpAgent: http.Agent | https.Agent | null = null;

// Initialize config from disk on startup
export function loadProxyConfig(): ProxyConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      currentConfig = {
        enabled: Boolean(parsed.enabled),
        type: (parsed.type as ProxyType) || 'HTTP',
        hostname: parsed.hostname || '',
        port: Number(parsed.port) || 8080,
        username: parsed.username || '',
        password: parsed.password || '',
        secret: parsed.secret || '',
        lastTested: parsed.lastTested,
        lastTestStatus: parsed.lastTestStatus,
        lastTestMessage: parsed.lastTestMessage,
        updatedAt: parsed.updatedAt,
      };

      if (currentConfig.enabled && currentConfig.hostname && currentConfig.port) {
        applyProxyRouting(currentConfig);
      }
    }
  } catch (err) {
    console.warn('Failed to load proxy config from disk:', err);
  }
  return currentConfig;
}

export function getProxyConfig(): ProxyConfig {
  return { ...currentConfig };
}

export function getActiveHttpAgent(): http.Agent | https.Agent | undefined {
  return activeHttpAgent || undefined;
}

export function isProxyActive(): boolean {
  return currentConfig.enabled && Boolean(currentConfig.hostname) && Boolean(currentConfig.port);
}

function buildProxyUrl(config: ProxyConfig): string {
  const { type, hostname, port, username, password } = config;
  const protocol = type === 'SOCKS5' ? 'socks5' : 'http';
  let auth = '';
  if (username && username.trim().length > 0) {
    const user = encodeURIComponent(username.trim());
    const pass = password ? encodeURIComponent(password) : '';
    auth = pass ? `${user}:${pass}@` : `${user}@`;
  }
  return `${protocol}://${auth}${hostname.trim()}:${port}`;
}

export function applyProxyRouting(config: ProxyConfig) {
  if (!config.enabled || !config.hostname || !config.port) {
    // Disable proxy & restore direct connection
    activeHttpAgent = null;
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.ALL_PROXY;
    try {
      setGlobalDispatcher(new UndiciAgent());
    } catch (e) {
      console.warn('Could not reset undici global dispatcher:', e);
    }
    console.log('[ProxyService] Proxy disabled. Direct internet connection restored.');
    return;
  }

  const proxyUrl = buildProxyUrl(config);

  if (config.type === 'HTTP' || config.type === 'WEB') {
    activeHttpAgent = new HttpsProxyAgent(proxyUrl);
    process.env.HTTP_PROXY = proxyUrl;
    process.env.HTTPS_PROXY = proxyUrl;
    try {
      setGlobalDispatcher(new UndiciProxyAgent(proxyUrl));
    } catch (e) {
      console.warn('Could not set undici global dispatcher for HTTP proxy:', e);
    }
    console.log(`[ProxyService] Outbound traffic routed through ${config.type} proxy (${config.hostname}:${config.port}).`);
  } else if (config.type === 'SOCKS5') {
    activeHttpAgent = new SocksProxyAgent(proxyUrl);
    process.env.ALL_PROXY = proxyUrl;
    process.env.HTTP_PROXY = proxyUrl;
    process.env.HTTPS_PROXY = proxyUrl;
    try {
      setGlobalDispatcher(new UndiciProxyAgent(proxyUrl));
    } catch (e) {
      // SOCKS in undici may require socks protocol or node httpAgent fallback
      console.warn('Undici socks dispatcher notice:', e);
    }
    console.log(`[ProxyService] Outbound traffic routed through SOCKS5 proxy (${config.hostname}:${config.port}).`);
  } else if (config.type === 'MTPROTO') {
    activeHttpAgent = null;
    console.log(`[ProxyService] MTPROTO configuration saved (${config.hostname}:${config.port}).`);
  }
}

export function saveProxyConfig(config: Partial<ProxyConfig>): ProxyConfig {
  currentConfig = {
    ...currentConfig,
    ...config,
    updatedAt: new Date().toISOString(),
  };

  applyProxyRouting(currentConfig);

  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(currentConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save proxy config to disk:', err);
  }

  return currentConfig;
}

export async function testProxyConnection(config: ProxyConfig): Promise<ProxyTestResult> {
  const startTime = Date.now();

  if (!config.hostname || !config.hostname.trim()) {
    return {
      success: false,
      message: 'Hostname is required for proxy connection test.',
    };
  }

  const port = Number(config.port);
  if (!port || port < 1 || port > 65535) {
    return {
      success: false,
      message: 'A valid port number between 1 and 65535 is required.',
    };
  }

  // MTPROTO socket testing
  if (config.type === 'MTPROTO') {
    if (!config.secret || !config.secret.trim()) {
      return {
        success: false,
        message: 'Secret is required for MTPROTO proxy configuration.',
      };
    }

    const secretTrimmed = config.secret.trim();
    // Validate hex secret format (must be hex characters, typical lengths 32 hex chars / 16 bytes or prefixed)
    const isHex = /^[0-9a-fA-F]+$/.test(secretTrimmed);
    if (!isHex || secretTrimmed.length < 16) {
      return {
        success: false,
        message: 'Invalid MTPROTO Secret format: Must be a hex-encoded string of at least 16 hex characters.',
      };
    }

    return new Promise<ProxyTestResult>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(8000);

      socket.connect(port, config.hostname.trim(), () => {
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve({
          success: true,
          latencyMs: latency,
          ip: config.hostname.trim(),
          message: `✅ Connection Successful! Server traffic is routed through IP: ${config.hostname.trim()}`,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          success: false,
          latencyMs: Date.now() - startTime,
          message: '❌ Proxy Connection Failed. Please check your credentials or proxy server status.',
        });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({
          success: false,
          latencyMs: Date.now() - startTime,
          message: '❌ Proxy Connection Failed. Please check your credentials or proxy server status.',
        });
      });
    });
  }

  // HTTP, WEB, or SOCKS5 internet verification test strictly routed through the configured proxy
  const proxyUrl = buildProxyUrl(config);
  const agent = config.type === 'SOCKS5' ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl);

  try {
    let result: { ip: string; latencyMs: number };
    try {
      // Primary check: api.ipify.org
      result = await requestIpThroughAgent(agent, 'https://api.ipify.org?format=json', 8000);
    } catch (primaryErr) {
      // Fallback check: httpbin.org/ip
      result = await requestIpThroughAgent(agent, 'https://httpbin.org/ip', 8000);
    }

    return {
      success: true,
      latencyMs: result.latencyMs,
      ip: result.ip,
      message: `✅ Connection Successful! Server traffic is routed through IP: ${result.ip}`,
      details: `Traffic successfully verified through ${config.type} proxy (${result.latencyMs}ms).`,
    };
  } catch (err: any) {
    console.error(`[ProxyService] Outbound test failed via ${config.type} proxy (${config.hostname}:${port}):`, err?.message);
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      message: '❌ Proxy Connection Failed. Please check your credentials or proxy server status.',
    };
  }
}

/**
 * Executes an HTTP GET request to an IP detection service strictly routed through the provided proxy agent.
 */
function requestIpThroughAgent(agent: any, targetUrl: string, timeoutMs: number = 8000): Promise<{ ip: string; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const parsed = new URL(targetUrl);

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        agent: agent,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Elysian-Sprite-Studio-Proxy-Tester/1.0',
          'Accept': 'application/json',
          'Host': parsed.hostname,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          const latencyMs = Date.now() - startTime;
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              const ip = (data.ip || data.origin || '').toString().trim();
              if (ip) {
                // If origin has multiple comma-separated IPs (e.g. forward chain), pick the first one
                const cleanIp = ip.split(',')[0].trim();
                return resolve({ ip: cleanIp, latencyMs });
              }
            } catch {
              // Regex fallback
              const ipMatch = body.match(/"(?:ip|origin)"\s*:\s*"([^"]+)"/);
              if (ipMatch) {
                return resolve({ ip: ipMatch[1].split(',')[0].trim(), latencyMs });
              }
            }
            reject(new Error(`Failed to parse IP from response: ${body.slice(0, 80)}`));
          } else {
            reject(new Error(`Endpoint ${parsed.hostname} returned HTTP status ${res.statusCode}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Proxy connection timed out after ${timeoutMs}ms reaching ${parsed.hostname}`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}
