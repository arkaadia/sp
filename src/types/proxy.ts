export type ProxyType = 'MTPROTO' | 'SOCKS5' | 'HTTP' | 'WEB';

export interface ProxyConfig {
  enabled: boolean;
  type: ProxyType;
  hostname: string;
  port: number;
  secret?: string;      // Specific to MTPROTO
  username?: string;    // Optional for HTTP, SOCKS5, WEB
  password?: string;    // Optional for HTTP, SOCKS5, WEB
  updatedAt?: string;
  lastTested?: string;
  lastTestStatus?: 'success' | 'failed' | null;
  lastTestMessage?: string;
}

export interface ProxyTestResult {
  success: boolean;
  latencyMs?: number;
  ip?: string;
  message: string;
  details?: string;
}
