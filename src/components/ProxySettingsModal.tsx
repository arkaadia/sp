import React, { useState, useEffect } from 'react';
import {
  X,
  Network,
  Shield,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Globe,
  Radio,
  Power,
  Server,
  Zap,
} from 'lucide-react';
import { ProxyConfig, ProxyTestResult, ProxyType } from '../types/proxy';

interface ProxySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProxySaved?: (config: ProxyConfig) => void;
}

export const ProxySettingsModal: React.FC<ProxySettingsModalProps> = ({
  isOpen,
  onClose,
  onProxySaved,
}) => {
  const [proxyType, setProxyType] = useState<ProxyType>('HTTP');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState<number | string>(8080);
  const [secret, setSecret] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Status & testing state
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProxyActive, setIsProxyActive] = useState(false);
  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch current proxy configuration on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setTestResult(null);
    setSaveSuccessMessage(null);
    setErrorMessage(null);

    fetch('/api/proxy')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.config) {
          const cfg: ProxyConfig = data.config;
          setProxyType(cfg.type || 'HTTP');
          setHostname(cfg.hostname || '');
          setPort(cfg.port || (cfg.type === 'SOCKS5' ? 1080 : 8080));
          setSecret(cfg.secret || '');
          setUsername(cfg.username || '');
          setPassword(cfg.password || '');
          setIsProxyActive(Boolean(data.isProxyActive));

          if (cfg.lastTestStatus && cfg.lastTestMessage) {
            setTestResult({
              success: cfg.lastTestStatus === 'success',
              message: cfg.lastTestMessage,
            });
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load proxy config:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Adjust default port when changing proxy types if currently default
  const handleTypeChange = (newType: ProxyType) => {
    setProxyType(newType);
    setTestResult(null);
    setSaveSuccessMessage(null);
    setErrorMessage(null);

    // Provide friendly default port if empty or common default
    if (!port || port === 8080 || port === 1080 || port === 443 || port === 8888) {
      if (newType === 'SOCKS5') setPort(1080);
      else if (newType === 'MTPROTO') setPort(443);
      else setPort(8080);
    }
  };

  const handleTestConnection = async () => {
    setErrorMessage(null);
    setSaveSuccessMessage(null);
    setTestResult(null);

    if (!hostname.trim()) {
      setErrorMessage('Please enter a Hostname or IP address before testing.');
      return;
    }

    const portNum = Number(port);
    if (!portNum || portNum < 1 || portNum > 65535) {
      setErrorMessage('Please enter a valid port number between 1 and 65535.');
      return;
    }

    if (proxyType === 'MTPROTO' && !secret.trim()) {
      setErrorMessage('MTPROTO proxy requires a Secret key for connection.');
      return;
    }

    setIsTesting(true);

    try {
      const response = await fetch('/api/proxy/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: proxyType,
          hostname: hostname.trim(),
          port: portNum,
          secret: secret.trim(),
          username: username.trim(),
          password: password,
        }),
      });

      const data: ProxyTestResult = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({
        success: false,
        message: '❌ Proxy Connection Failed. Please check your credentials or proxy server status.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    if (!hostname.trim()) {
      setErrorMessage('Please enter a valid Hostname or IP address.');
      return;
    }

    const portNum = Number(port);
    if (!portNum || portNum < 1 || portNum > 65535) {
      setErrorMessage('Please enter a valid port number (1-65535).');
      return;
    }

    if (proxyType === 'MTPROTO' && !secret.trim()) {
      setErrorMessage('Please provide the Secret key for the MTPROTO proxy.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/proxy/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          type: proxyType,
          hostname: hostname.trim(),
          port: portNum,
          secret: secret.trim(),
          username: username.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsProxyActive(true);
        setSaveSuccessMessage(
          `Proxy settings saved! Outbound server & AI traffic will now route through ${proxyType} (${hostname.trim()}:${portNum}).`
        );
        if (onProxySaved && data.config) {
          onProxySaved(data.config);
        }
        // Auto-close after brief confirmation
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(data.error || 'Failed to save proxy settings.');
      }
    } catch (err: any) {
      setErrorMessage(`Failed to save proxy: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableProxy = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setTestResult(null);

    try {
      const res = await fetch('/api/proxy/disable', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsProxyActive(false);
        setSaveSuccessMessage('Proxy disabled. Direct internet connection restored.');
        if (onProxySaved && data.config) {
          onProxySaved(data.config);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMessage(`Failed to disable proxy: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-[#0f131a] border border-amber-500/30 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-gradient-to-r from-[#141822] via-[#10141c] to-[#141822]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Proxy Configuration
                {isProxyActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Direct (No Proxy)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure network proxy protocols for server outbound & AI provider requests
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Active status indicator card */}
          {isProxyActive && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-amber-200">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Proxy routing is currently <strong>active</strong> for all external AI generation calls.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDisableProxy}
                disabled={isSaving}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800/90 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-200 transition-colors shrink-0"
              >
                Disable Proxy
              </button>
            </div>
          )}

          {/* Section 1: Proxy Type Radio Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-2.5 uppercase tracking-wider text-[11px]">
              Select Proxy Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(['HTTP', 'SOCKS5', 'WEB', 'MTPROTO'] as ProxyType[]).map((type) => {
                const isSelected = proxyType === type;
                return (
                  <label
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`cursor-pointer flex flex-col p-3 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400/80 text-white shadow-md shadow-amber-500/5 ring-1 ring-amber-400/30'
                        : 'bg-[#121620] border-slate-800/90 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs tracking-wide">{type}</span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-amber-400 bg-amber-400' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 line-clamp-1">
                      {type === 'MTPROTO'
                        ? 'Telegram binary'
                        : type === 'SOCKS5'
                        ? 'TCP socket tunnel'
                        : type === 'HTTP'
                        ? 'Standard HTTP'
                        : 'Web gateway'}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 2: Socket address */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-2.5 uppercase tracking-wider text-[11px]">
              Socket Address
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <span className="text-[11px] text-slate-400 font-medium">Hostname / IP Address</span>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={hostname}
                    onChange={(e) => {
                      setHostname(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="e.g. 198.51.100.1 or proxy.example.com"
                    className="w-full pl-9 pr-3 py-2 bg-[#121620] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium">Port</span>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Server className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={port}
                    onChange={(e) => {
                      setPort(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder={proxyType === 'SOCKS5' ? '1080' : '8080'}
                    className="w-full pl-9 pr-3 py-2 bg-[#121620] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Credentials based on proxy type */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-slate-200 mb-2.5 uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>Credentials</span>
              <span className="text-[10px] text-slate-500 font-normal normal-case">
                {proxyType === 'MTPROTO' ? 'Required Secret Key' : 'Optional Authentication'}
              </span>
            </label>

            {proxyType === 'MTPROTO' ? (
              // MTPROTO: Secret input field
              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium">
                  Secret <span className="text-amber-400">*</span>
                </span>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    onChange={(e) => {
                      setSecret(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="e.g. ee000000000000000000000000000000007777772e676f6f676c652e636f6d"
                    className="w-full px-3 py-2 pr-10 bg-[#121620] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Hex-encoded MTProto secret string (standard 32-char hex or dd/ee-prefixed TLS secret).
                </p>
              </div>
            ) : (
              // HTTP, SOCKS5, or WEB: Username and Password (optional)
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Username <span className="text-slate-500 text-[10px]">(optional)</span>
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="Leave blank if not required"
                    className="w-full px-3 py-2 bg-[#121620] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Password <span className="text-slate-500 text-[10px]">(optional)</span>
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder="Leave blank if not required"
                      className="w-full px-3 py-2 pr-10 bg-[#121620] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Test connection result banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                testResult.success
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs">
                <p className="font-semibold mb-0.5">
                  {testResult.success ? 'Internet Connection Verified' : 'Connection Test Failed'}
                </p>
                <p className="text-[11px] opacity-90 leading-relaxed">{testResult.message}</p>
                {testResult.ip && (
                  <p className="text-[10px] text-emerald-300/80 mt-1 font-mono">
                    Outbound IP detected: {testResult.ip} {testResult.latencyMs && `(${testResult.latencyMs}ms)`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Validation or save error message */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Save success toast */}
          {saveSuccessMessage && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-200">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-[#121620] flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            {/* Test Connection Button */}
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Testing Route...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test Connection</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2.5">
              {/* Cancel Button */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isTesting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-400/20 hover:shadow-amber-400/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Proxy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Test Connection Notification below the buttons */}
          {testResult && (
            <div
              className={`text-xs px-3.5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
                testResult.success
                  ? 'text-emerald-300 bg-emerald-950/40 border border-emerald-500/30'
                  : 'text-rose-300 bg-rose-950/40 border border-rose-500/30'
              }`}
            >
              <span>
                {testResult.success
                  ? `✅ Connection Successful! Server traffic is routed through IP: ${testResult.ip || 'Unknown'}`
                  : `❌ Proxy Connection Failed. Please check your credentials or proxy server status.`
                }
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
