import type { TenantFeatures } from './db';

export const EXPECTED_AGENT_VERSION = 'v2.0.0.Build.6';
// 🚀 GitHub Releases 글로벌 초고속 CDN (Azure/Fastly 한국 PoP 8~10MB/s 3초 다운로드)
export const DEFAULT_GITHUB_RELEASE_BASE_URL = 'https://github.com/DragonRPA/ebro_awp/releases/download/agent-v2.0.0';
// 🌐 Cloudflare R2 보조 엔드포인트 (Fallback)
export const DEFAULT_CF_R2_BASE_URL = 'https://pub-55a68547bdf24600b80d27782912c83e.r2.dev';

export const AGENT_INSTALLER_BASE_URL = `${DEFAULT_GITHUB_RELEASE_BASE_URL}/eBroAgent_Setup.exe`; // Inno Setup 16MB 초고속 정식 인스톨러
export const AGENT_EXE_URL = AGENT_INSTALLER_BASE_URL; // 기본 초고속 인스톨러 다운로드 엔드포인트
export const AGENT_SILENT_INSTALL_CMD = 'eBroAgent_Setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART'; // 무음 설치 명령행
export const AGENT_VERSION_CHECK_URL = `${DEFAULT_CF_R2_BASE_URL}/downloads/version.json`; // 스마트 업데이트 검증 메타데이터
export const AGENT_DOWNLOAD_URL = `${DEFAULT_GITHUB_RELEASE_BASE_URL}/eBroAgent_Setup.exe`;
export const AGENT_BRO_JS_URL = `${DEFAULT_GITHUB_RELEASE_BASE_URL}/eBroAgent_Setup.exe`;
export const AGENT_EBRO_JS_URL = `${DEFAULT_GITHUB_RELEASE_BASE_URL}/eBroAgent_Setup.exe`;
export const AGENT_REG_BAT_URL = '/downloads/등록-실행.bat';       // 브라우저 실행 프로토콜 등록기
export const AGENT_LAUNCHER_URL = '/downloads/start-agent.bat';        // 실행 배치 파일
export const AGENT_KILL_BAT_URL = '/downloads/kill-agent.bat';
export const AGENT_CERT_URL = `${DEFAULT_CF_R2_BASE_URL}/downloads/eBroAgent_Root.cer`; // 보안 인증서 (Cloudflare CDN)
export const AGENT_INSTALL_BAT_URL = '/downloads/install-cert.bat';     // 인증서 등록 배치 파일
export const NODEJS_INSTALL_URL = 'https://nodejs.org/en/download/';
export const AGENT_PROTOCOL_URI = 'broagent://run';

export interface TenantAgentInstallerInfo {
  downloadUrl: string;
  fallbackUrl: string;
  fileName: string;
  tenantCode: string;
  tenantName: string;
  subdomain: string;
  version: string;
}

/**
 * 📦 깃허브 레포지토리 기반 에이전트 다운로드 URL 생성 헬퍼
 */
export function getAgentDownloadUrl(targetRepo?: string, fileName: string = 'eBroAgent_Setup.exe'): string {
  const repo = (targetRepo?.split(',')[0].trim()) || 'DragonRPA/ebro_awp';
  return `https://github.com/${repo}/releases/download/agent-v2.0.0/${fileName}`;
}

/**
 * 📦 접속 URL 및 테넌트 기준 맞춤형 eBroAgent 설치 프로그램 메타데이터 생성
 * 각 고객사(테넌트)별 서브도메인 및 상호가 바인딩된 전용 설치 파일명 및 초고속 CDN 다운로드 링크를 제공합니다.
 */
export function getTenantAgentInstallerInfo(tenant?: {
  tenantCode?: string;
  displayName?: string;
  tradeName?: string;
  corporateName?: string;
  subdomain?: string;
  targetRepo?: string;
} | null): TenantAgentInstallerInfo {
  let rawCode = (tenant?.tenantCode || 'GIYEONLIFT').toUpperCase();
  if (rawCode === 'GIYEUN' || rawCode === 'GIYUEN' || rawCode === 'KIYUEN') {
    rawCode = 'GIYEONLIFT';
  }
  const code = rawCode;
  const name = tenant?.displayName || tenant?.tradeName || tenant?.corporateName || '기연리프트';
  const sub = (tenant?.subdomain || code.toLowerCase());
  
  // 테넌트 전용 설치 파일명 (예: eBroAgent_Setup_GIYEUN.exe, eBroAgent_Setup_HANSOL.exe)
  const fileName = `eBroAgent_Setup_${code}.exe`;
  
  // 🚀 GitHub Releases 글로벌 초고속 CDN 기반 (8~10MB/s, 16MB를 3초 만에 다운로드 완료)
  // currentTenant?.targetRepo가 존재하면 해당 레포지토리 동적 사용 (미지정 시 DragonRPA/ebro_awp 기본값)
  const targetRepo = (tenant?.targetRepo?.split(',')[0].trim()) || 'DragonRPA/ebro_awp';
  const downloadUrl = `https://github.com/${targetRepo}/releases/download/agent-v2.0.0/${fileName}`;
  // Cloudflare R2 보조 엔드포인트 URL
  const fallbackUrl = `${DEFAULT_CF_R2_BASE_URL}/downloads/${fileName}`;

  return {
    downloadUrl,
    fallbackUrl,
    fileName,
    tenantCode: code,
    tenantName: name,
    subdomain: sub,
    version: EXPECTED_AGENT_VERSION,
  };
}

/**
 * 🚀 브라우저에서 테넌트 맞춤형 eBroAgent 설치 파일 다운로드 즉시 실행
 */
export function triggerTenantAgentDownload(tenant?: {
  tenantCode?: string;
  displayName?: string;
  tradeName?: string;
  corporateName?: string;
  subdomain?: string;
  targetRepo?: string;
} | null): void {
  const info = getTenantAgentInstallerInfo(tenant);
  const a = document.createElement('a');
  a.href = info.downloadUrl;
  a.download = info.fileName;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try { document.body.removeChild(a); } catch (e) {}
  }, 1000);
}

/**
 * 🚀 브라우저(사이트)에서 로컬 에이전트(BroAgent.js) 기동 트리거
 */
export function launchLocalAgentFromBrowser(): void {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = AGENT_PROTOCOL_URI;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch (e) {}
    }, 2500);
  } catch (e) {
    window.location.href = AGENT_PROTOCOL_URI;
  }
}

/**
 * 🖥️ eBro AI Agent 독립 데스크톱 스튜디오 창 호출
 */
export async function openAgentStudio(): Promise<boolean> {
  try {
    const res = await fetchWithAgentFallback('/api/launch-studio', {
      method: 'POST',
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) return true;
  } catch (e) {}

  // 브라우저 팝업/프로토콜 폴백
  try {
    window.open('http://127.0.0.1:5175/studio', '_blank', 'width=1020,height=740');
    return true;
  } catch (e) {
    launchLocalAgentFromBrowser();
    return false;
  }
}


export interface AgentHealthInfo {
  status: 'ONLINE' | 'OFFLINE';
  version?: string;
  callsign?: string;
  machineName?: string;
  archiveRoot?: string;
  driveMirrorDir?: string;
  uptimeSeconds?: number;
  policy?: {
    agentAiEnabled: boolean;
    tenantCode?: string;
    updatedAt?: string;
  };
  isAiEnabled?: boolean;
  updateState?: {
    status: string;
    currentVersion: string;
    targetVersion: string | null;
    message: string;
    lastChecked: string | null;
  };
  timestamp?: string;
}

/**
 * 🌐 테넌트 관리 센터의 기능 정책을 로컬 에이전트에 실시간 핫 동기화
 */
export async function syncTenantPolicyToAgent(tenant?: {
  tenantCode?: string;
  subdomain?: string;
  features?: TenantFeatures;
} | null): Promise<boolean> {
  if (!tenant) return false;
  try {
    const isAiEnabled = Boolean(tenant.features?.agentAiEnabled);
    const code = tenant.tenantCode || 'GIYEONLIFT';
    const sub = tenant.subdomain || (code === 'GIYEONLIFT' ? 'giyeon' : code.toLowerCase());
    const res = await fetchWithAgentFallback('/api/policy/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentAiEnabled: isAiEnabled,
        tenantCode: code,
        subdomain: sub
      }),
      signal: AbortSignal.timeout(1500)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// 활성 에이전트 베이스 URL (127.0.0.1 ➔ localhost 자동 동적 폴백)
let activeAgentBaseUrl = 'http://localhost:5175';

export function getAgentBaseUrl(): string {
  return activeAgentBaseUrl;
}

// ── 🌐 전역 에이전트 상태 버스 및 실시간 동기화 ──
let lastKnownAgentOnline: boolean = false;
let lastKnownAgentInfo: AgentHealthInfo | null = null;
const agentStatusListeners = new Set<(online: boolean, info: AgentHealthInfo | null) => void>();

export function isAgentOnlineGlobal(): boolean {
  if (lastKnownAgentOnline) return true;
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('data-ebro-agent-status') === 'online';
  }
  return false;
}

export function subscribeAgentStatus(listener: (online: boolean, info: AgentHealthInfo | null) => void): () => void {
  agentStatusListeners.add(listener);
  try {
    listener(isAgentOnlineGlobal(), lastKnownAgentInfo);
  } catch (e) {}
  return () => { agentStatusListeners.delete(listener); };
}

export function setGlobalAgentStatus(online: boolean, info?: AgentHealthInfo | null): void {
  lastKnownAgentOnline = online;
  if (info !== undefined) lastKnownAgentInfo = info;
  agentStatusListeners.forEach(cb => {
    try { cb(online, lastKnownAgentInfo); } catch (e) {}
  });
}

// 브라우저 런타임 이벤트 리스너 (확장 프로그램 ➔ ERP 실시간 수신)
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window || !event.data || event.data.source !== 'EBRO_EXTENSION') return;
    if (event.data.type === 'AGENT_STATUS_UPDATE') {
      const isOnline = Boolean(event.data.isConnected);
      setGlobalAgentStatus(isOnline);
    }
  });

  window.addEventListener('ebro:extension_agent_status', ((e: CustomEvent) => {
    if (e.detail && typeof e.detail.isConnected === 'boolean') {
      setGlobalAgentStatus(e.detail.isConnected);
    }
  }) as EventListener);
}

/**
 * 🌐 브라우저 확장 프로그램(ebro web agent) 존재 여부 감지
 */
export function isExtensionBridgeAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-ebro-extension-ready') === 'true' ||
         document.documentElement.getAttribute('data-ebro-agent-status') !== null;
}

/**
 * 🌐 브라우저 확장 프로그램(ebro web agent) 프록시를 통한 에이전트 통신
 * Chrome Private Network Access (PNA) 및 Mixed Content 제약을 우회하여 로컬 에이전트와 완벽 통신
 */
export async function fetchViaExtensionBridge(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${activeAgentBaseUrl}${pathOrUrl}`;
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window context not available'));
    }

    const requestId = 'req_' + Math.random().toString(36).substring(2, 10);
    const timeoutMs = (init as any)?.timeout || 120000;

    let timer: any = null;

    const handler = (event: MessageEvent) => {
      if (event.source !== window || !event.data || event.data.source !== 'EBRO_EXTENSION') return;
      if (event.data.type === 'PROXY_FETCH_RESPONSE' && event.data.requestId === requestId) {
        window.removeEventListener('message', handler);
        clearTimeout(timer);

        const res = event.data.response;
        if (!res || !res.success) {
          return reject(new Error(res?.error || '확장 프로그램 프록시 통신 실패'));
        }

        const rawData = res.data;
        const bodyStr = typeof rawData === 'string' ? rawData : (rawData !== null && rawData !== undefined ? JSON.stringify(rawData) : '');

        const responseObj = new Response(bodyStr, {
          status: res.status || 200,
          statusText: res.statusText || 'OK',
          headers: new Headers(res.headers || {})
        });

        if (typeof rawData === 'object' && rawData !== null) {
          responseObj.json = async () => rawData;
        }

        resolve(responseObj);
      }
    };

    window.addEventListener('message', handler);

    timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('확장 프로그램 프록시 응답 시간 초과'));
    }, timeoutMs);

    if (init?.signal) {
      if (init.signal.aborted) {
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        return reject(new DOMException('The user aborted a request.', 'AbortError'));
      }
      init.signal.addEventListener('abort', () => {
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        reject(new DOMException('The user aborted a request.', 'AbortError'));
      }, { once: true });
    }

    let headerObj: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headerObj[k] = v; });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headerObj[k] = v; });
      } else {
        headerObj = { ...init.headers } as Record<string, string>;
      }
    }

    window.postMessage({
      source: 'EBRO_WEB_PAGE',
      type: 'PROXY_FETCH',
      requestId,
      url,
      options: {
        method: init?.method || 'GET',
        headers: headerObj,
        body: typeof init?.body === 'string' ? init.body : undefined,
        timeout: timeoutMs
      }
    }, '*');
  });
}

/**
 * 로컬 에이전트 통신 헬퍼 (확장 프로그램 프록시 ➔ 루프백 fetch 상호 폴백 지원)
 */
/**
 * 로컬 에이전트 통신 헬퍼 (확장 프로그램 프록시 ➔ 루프백 fetch 상호 폴백 지원)
 * - 신호 소진(Signal Exhaustion) 방지: 확장 프로그램 대기로 부모 AbortSignal이 소진되어 루프백이 즉사하는 결함 원천 차단
 * - 확장 프로그램 미설치 시 불필요한 2초 대기 없이 루프백으로 즉각 직행
 * - W3C Potentially Trustworthy Origin 표준 준수: http://localhost:5175 1순위 시도
 */
export async function fetchWithAgentFallback(path: string, init?: RequestInit): Promise<Response> {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:' && !window.location.hostname.includes('localhost');
  const hasExtension = isExtensionBridgeAvailable();

  // 1. HTTPS 환경이며 확장 프로그램이 실제 활성화되어 있는 경우에만 1순위로 시도 (최대 1500ms 빠른 타임아웃)
  if (isHttps && hasExtension) {
    try {
      const extRes = await fetchViaExtensionBridge(path, {
        ...init,
        timeout: Math.min((init as any)?.timeout || 3000, 1500)
      } as RequestInit & { timeout?: number });
      if (extRes.ok || extRes.status < 500) {
        setGlobalAgentStatus(true);
        return extRes;
      }
    } catch (extErr) {
      // 확장 프로그램 응답 지연/미응답 시 즉시 루프백 직접 fetch 시도로 인계
    }
  }

  // 2. 직접 루프백 fetch 시도 (W3C 표준 준수: http://localhost:5175 ➔ http://127.0.0.1:5175 순차 탐색)
  const candidateHosts = [
    'http://localhost:5175',
    'http://127.0.0.1:5175'
  ];

  let lastErr: any = null;
  for (const host of candidateHosts) {
    let timeoutTimer: any = null;
    try {
      // 💡 [핵심 방어] 신호 소진(Signal Exhaustion) 방지:
      // 부모 init?.signal이 이미 aborted된 상태라면 이를 복사하지 않고, 각 호스트마다 신선한 독립 AbortController를 생성합니다.
      const freshController = new AbortController();
      const hostTimeoutMs = (init as any)?.timeout || 3500;

      if (init?.signal && !init.signal.aborted) {
        init.signal.addEventListener('abort', () => freshController.abort(init.signal?.reason), { once: true });
      } else {
        timeoutTimer = setTimeout(() => {
          freshController.abort(new DOMException('Local agent loopback request timeout', 'TimeoutError'));
        }, hostTimeoutMs);
      }

      const mergedInit: RequestInit = {
        ...init,
        signal: freshController.signal,
        // Chrome/Edge W3C Local Network Access(LNA) 표준
      };

      const res = await fetch(`${host}${path}`, mergedInit);
      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (res.ok || res.status < 500) {
        activeAgentBaseUrl = host;
        setGlobalAgentStatus(true);
        return res;
      }
    } catch (e) {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      lastErr = e;
    }
  }

  // 3. 만약 직접 fetch가 실패했고 확장 프로그램을 아직 시도 안 했다면(HTTP 개발 환경이거나 PNA 차단 시), 보조 시도
  if (!isHttps && hasExtension) {
    try {
      const extRes = await fetchViaExtensionBridge(path, init);
      if (extRes.ok || extRes.status < 500) {
        setGlobalAgentStatus(true);
        return extRes;
      }
    } catch (e) {}
  }

  throw lastErr || new Error('로컬 에이전트 연결 실패');
}

// ── 🌐 단일 전역 에이전트 헬스체크 매니저 (Single Global Autonomous Poller) ──
let globalHealthCheckTimer: any = null;
let consecutiveFailures = 0;
let isCheckingHealth = false;

/**
 * 2-Strike 확인 기반 가짜 오프라인(Flapping) 방지 헬스체크
 */
export async function pingLocalAgentHealth(callsign: string = 'admin'): Promise<AgentHealthInfo> {
  if (isCheckingHealth) {
    return lastKnownAgentInfo || { status: lastKnownAgentOnline ? 'ONLINE' : 'OFFLINE' };
  }
  isCheckingHealth = true;

  try {
    const res = await fetchWithAgentFallback(`/health?callsign=${encodeURIComponent(callsign)}`, {
      method: 'GET',
      cache: 'no-store',
      // 헬스체크 전용 독립 타임아웃 (3초)
      timeout: 3000
    } as any);

    if (res.ok) {
      const data = await res.json();
      consecutiveFailures = 0;
      const info: AgentHealthInfo = {
        status: 'ONLINE',
        version: data.version || 'v2.0.0',
        callsign: data.callsign || callsign,
        machineName: data.machineName,
        archiveRoot: data.archiveRoot,
        driveMirrorDir: data.driveMirrorDir,
        uptimeSeconds: data.uptimeSeconds,
        updateState: data.updateState,
        policy: data.policy,
        isAiEnabled: data.isAiEnabled,
        timestamp: data.timestamp
      };
      setGlobalAgentStatus(true, info);
      return info;
    }
  } catch (err) {
    // 💡 1회 실패 시 즉각 OFFLINE으로 단정하지 않고 400ms 후 즉시 1회 재시도 (2-Strike Flapping Prevention)
    consecutiveFailures++;
    if (consecutiveFailures === 1) {
      try {
        await new Promise(r => setTimeout(r, 400));
        const retryRes = await fetchWithAgentFallback('/health', { method: 'GET', cache: 'no-store', timeout: 2000 } as any);
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          consecutiveFailures = 0;
          const retryInfo: AgentHealthInfo = {
            status: 'ONLINE',
            version: retryData.version || 'v2.0.0',
            callsign: retryData.callsign || callsign,
            machineName: retryData.machineName,
            archiveRoot: retryData.archiveRoot,
            driveMirrorDir: retryData.driveMirrorDir,
            uptimeSeconds: retryData.uptimeSeconds,
            updateState: retryData.updateState,
            policy: retryData.policy,
            isAiEnabled: retryData.isAiEnabled,
            timestamp: retryData.timestamp
          };
          setGlobalAgentStatus(true, retryInfo);
          return retryInfo;
        }
      } catch (retryErr) {
        consecutiveFailures = 2;
      }
    }
  } finally {
    isCheckingHealth = false;
  }

  // 2회 연속 실패 시에만 정식으로 OFFLINE 확정
  if (consecutiveFailures >= 2) {
    setGlobalAgentStatus(false, null);
  }
  return { status: 'OFFLINE' };
}

/**
 * 단일 전역 에이전트 헬스체크 모니터 가동
 * - 3.5초 주기 단일 폴링으로 소켓 경합 원천 제거
 * - 탭 포커스 복귀(window.focus) 및 화면 복원(visibilitychange) 시 0.1초 즉시 헬스체크 트리거
 */
export function startGlobalAgentHealthMonitor(callsign: string = 'admin'): void {
  if (typeof window === 'undefined') return;
  if (globalHealthCheckTimer) return;

  // 1. 즉시 1회 검사
  pingLocalAgentHealth(callsign);

  // 2. 단일 주기적 폴링 (3.5초)
  globalHealthCheckTimer = setInterval(() => {
    pingLocalAgentHealth(callsign);
  }, 3500);

  // 3. 브라우저 창/탭 복원 시 즉시 재검사 (트레이에서 올라왔을 때 0.1초 즉시 초록불 복귀)
  window.addEventListener('focus', () => { pingLocalAgentHealth(callsign); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pingLocalAgentHealth(callsign);
    }
  });
}

/**
 * 로컬 에이전트 헬스체크 및 콜사인 동기화 (하위 호환)
 */
export async function checkLocalAgentHealth(callsign: string = 'admin'): Promise<AgentHealthInfo> {
  return pingLocalAgentHealth(callsign);
}

/**
 * 🤖 eBro Web Agent & PC 에이전트 코어 (포트 9002) 헬스체크
 */
export async function checkWebAgentHealth(): Promise<{ online: boolean; extensionConnected: boolean; version?: string }> {
  try {
    const res = await fetch('http://127.0.0.1:9002/status', {
      method: 'GET',
      signal: AbortSignal.timeout(1000)
    });
    if (res.ok) {
      const data = await res.json();
      return {
        online: data.status === 'ONLINE',
        extensionConnected: Boolean(data.browser_extension_connected),
        version: data.version
      };
    }
  } catch (e) {}
  return { online: false, extensionConnected: false };
}

/**
 * 🤖 eBro PC 에이전트에 자연어 명령 전달
 */
export async function executeWebAgentCommand(prompt: string): Promise<any> {
  const res = await fetch('http://127.0.0.1:9002/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, source: 'ERP_WEB_APP' })
  });
  return await res.json();
}

/**
 * 🔄 로컬 에이전트 재시작 트리거
 */
export async function restartLocalAgent(): Promise<boolean> {
  try {
    const res = await fetchWithAgentFallback('/restart', {
      method: 'POST',
      signal: AbortSignal.timeout(2000)
    });
    return res.ok;
  } catch (e) {
    launchLocalAgentFromBrowser();
    return true;
  }
}

/**
 * 🚀 로컬 에이전트 자가 자동 업데이트(Inno Setup 백그라운드 무음 교체) 즉시 트리거
 */
export async function triggerAgentSelfUpdate(force: boolean = false): Promise<{ success: boolean; message?: string; updateState?: any }> {
  try {
    const res = await fetchWithAgentFallback(`/api/check-update?force=${force ? 'true' : 'false'}`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: '자동 업데이트가 시작되었습니다.', updateState: data.updateState };
    }
    return { success: false, message: `업데이트 요청 실패 (HTTP ${res.status})` };
  } catch (e: any) {
    return { success: false, message: e.message || '에이전트 통신 실패' };
  }
}

/**
 * 📢 에이전트가 필요한 시점에 응답하지 않을 때 전역 모달 표출 이벤트 디스패치
 */
export function notifyAgentRequired(actionName: string = '로컬 연동 작업'): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ebro:agent_required', { detail: { actionName } }));
  }
}

