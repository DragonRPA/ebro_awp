// src/services/agentService.ts
// e-Bro ERP 로컬 사이드카 에이전트(eBroAgent) 단일 표준 메타데이터 및 통신 헬퍼

export const EXPECTED_AGENT_VERSION = 'v2.0.0.Build.1';
// 🌐 Cloudflare R2 글로벌 CDN 기반 대용량 독립 실행 파일 및 스마트 버전 관리 엔드포인트 (Vercel 용량 0% 격리)
export const DEFAULT_CF_R2_BASE_URL = 'https://pub-a2fd3c2ae0cc450b8ebe34baf1b051e1.r2.dev';
export const AGENT_EXE_URL = `${DEFAULT_CF_R2_BASE_URL}/downloads/eBroAgent.exe`; // Cloudflare R2 CDN 초고속 배포 (Vercel 번들 완전 격리)
export const AGENT_VERSION_CHECK_URL = `${DEFAULT_CF_R2_BASE_URL}/downloads/version.json`; // 스마트 업데이트 검증 메타데이터
export const AGENT_DOWNLOAD_URL = '/downloads/eBroAgent.js';            // Node.js 경량 스크립트 (eBroAgent.js)
export const AGENT_BRO_JS_URL = '/downloads/eBroAgent.js';               // eBroAgent.js 직접 다운로드
export const AGENT_EBRO_JS_URL = '/downloads/eBroAgent.js';             // eBroAgent.js 호환 다운로드
export const AGENT_REG_BAT_URL = '/downloads/등록-실행.bat';       // 브라우저 실행 프로토콜 등록기
export const AGENT_LAUNCHER_URL = '/downloads/start-agent.bat';        // 실행 배치 파일
export const AGENT_KILL_BAT_URL = '/downloads/kill-agent.bat';
export const AGENT_CERT_URL = `${DEFAULT_CF_R2_BASE_URL}/downloads/eBroAgent_Root.cer`; // 보안 인증서 (Cloudflare CDN)
export const AGENT_INSTALL_BAT_URL = '/downloads/install-cert.bat';     // 인증서 등록 배치 파일
export const NODEJS_INSTALL_URL = 'https://nodejs.org/en/download/';
export const AGENT_PROTOCOL_URI = 'broagent://run';
export const AGENT_INSTALLER_BASE_URL = `${DEFAULT_CF_R2_BASE_URL}/downloads/eBroAgentSetup.exe`; // 인스톨러 표준 다운로드 URL

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
 * 📦 접속 URL 및 테넌트 기준 맞춤형 eBroAgent 설치 프로그램 메타데이터 생성
 * 각 고객사(테넌트)별 서브도메인 및 상호가 바인딩된 전용 설치 파일명 및 다운로드 링크를 제공합니다.
 */
export function getTenantAgentInstallerInfo(tenant?: {
  tenantCode?: string;
  displayName?: string;
  tradeName?: string;
  corporateName?: string;
  subdomain?: string;
} | null): TenantAgentInstallerInfo {
  const code = (tenant?.tenantCode || 'GIYEUN').toUpperCase();
  const name = tenant?.displayName || tenant?.tradeName || tenant?.corporateName || '기연리프트';
  const sub = (tenant?.subdomain || code.toLowerCase());
  
  // 테넌트 전용 설치 파일명 (예: eBroAgent_Setup_GIYEUN.exe, eBroAgent_Setup_HANSOL.exe)
  const fileName = `eBroAgent_Setup_${code}.exe`;
  
  // Cloudflare R2 엔드포인트 URL (서버 파라미터로 테넌트 식별자 동봉)
  const downloadUrl = `${DEFAULT_CF_R2_BASE_URL}/downloads/${fileName}?tenant=${encodeURIComponent(code)}&subdomain=${encodeURIComponent(sub)}`;
  const fallbackUrl = `${DEFAULT_CF_R2_BASE_URL}/downloads/eBroAgentSetup.exe?tenant=${encodeURIComponent(code)}`;

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


export interface AgentHealthInfo {
  status: 'ONLINE' | 'OFFLINE';
  version?: string;
  callsign?: string;
  machineName?: string;
  archiveRoot?: string;
  driveMirrorDir?: string;
  uptimeSeconds?: number;
  timestamp?: string;
}

// 활성 에이전트 베이스 URL (127.0.0.1 ➔ localhost 자동 동적 폴백)
let activeAgentBaseUrl = 'http://127.0.0.1:5175';

export function getAgentBaseUrl(): string {
  return activeAgentBaseUrl;
}

/**
 * 로컬 에이전트 통신 헬퍼 (127.0.0.1 및 localhost 상호 폴백 지원)
 */
export async function fetchWithAgentFallback(path: string, init?: RequestInit): Promise<Response> {
  const candidateHosts = [
    activeAgentBaseUrl,
    activeAgentBaseUrl.includes('127.0.0.1') ? 'http://localhost:5175' : 'http://127.0.0.1:5175'
  ];

  let lastErr: any = null;
  for (const host of candidateHosts) {
    try {
      const mergedInit: any = {
        ...init,
        // Chrome/Edge W3C Local Network Access(LNA) 표준: loopback 접근 권한 명시
        targetAddressSpace: 'loopback'
      };
      const res = await fetch(`${host}${path}`, mergedInit);
      if (res.ok || res.status < 500) {
        activeAgentBaseUrl = host;
        return res;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('로컬 에이전트 연결 실패');
}

/**
 * 로컬 에이전트 헬스체크 및 콜사인 동기화
 */
export async function checkLocalAgentHealth(callsign: string = 'admin'): Promise<AgentHealthInfo> {
  try {
    const res = await fetchWithAgentFallback(`/health?callsign=${encodeURIComponent(callsign)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      return {
        status: 'ONLINE',
        version: data.version || 'v1.0.0',
        callsign: data.callsign || callsign,
        machineName: data.machineName,
        archiveRoot: data.archiveRoot,
        driveMirrorDir: data.driveMirrorDir,
        uptimeSeconds: data.uptimeSeconds,
        timestamp: data.timestamp
      };
    }
  } catch (err) {
    // 오프라인
  }
  return { status: 'OFFLINE' };
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
 * 📢 에이전트가 필요한 시점에 응답하지 않을 때 전역 모달 표출 이벤트 디스패치
 */
export function notifyAgentRequired(actionName: string = '로컬 연동 작업'): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ebro:agent_required', { detail: { actionName } }));
  }
}
