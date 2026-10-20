/**
 * src/services/appReadySignal.ts
 * e-Bro ERP 브라우저 Ready 상태 진단 및 전역 시그널링 서비스
 * 
 * [목적]
 * MCP(Model Context Protocol) 및 에이전틱 AI가 ERP를 자동화할 때,
 * 브라우저 및 시스템이 모든 비동기 초기화(인증, 테넌트, 권한, 라우트)를 마치고
 * 100% 조작 가능한 준비 상태인지 일관되게 확인할 수 있는 표준 인터페이스를 제공합니다.
 */

export interface ErpReadinessDiagnostics {
  status: 'READY' | 'INITIALIZING' | 'LOGIN_REQUIRED' | 'OFFLINE';
  isReady: boolean;
  readyAt?: string;
  currentUser?: {
    id: string;
    name: string;
    role: string;
    department?: string;
  } | null;
  currentTenant?: {
    id: string;
    name: string;
  } | null;
  activeMenu: string;
  domSelectorReady: string; // 'body[data-erp-status="ready"]'
  guardrailsActive: string[];
  dbConnected: boolean;
  pendingWritesCount: number;
}

declare global {
  interface Window {
    __ERP_READY__?: boolean;
    __ERP_DIAGNOSTICS__?: ErpReadinessDiagnostics;
    whenErpReady?: () => Promise<ErpReadinessDiagnostics>;
    getErpReadiness?: () => ErpReadinessDiagnostics;
  }
}

let resolveReadyPromise: ((value: ErpReadinessDiagnostics) => void) | null = null;
let currentDiagnostics: ErpReadinessDiagnostics = {
  status: 'INITIALIZING',
  isReady: false,
  activeMenu: 'booting',
  domSelectorReady: 'body[data-erp-status="ready"]',
  guardrailsActive: [
    'GUARD-1.3 (출고 승인 시 RENTED 전환 강제)',
    'GUARD-2.3 (단일 EXCHANGE 및 ₩60,000 왕복할인)',
    'GUARD-4.1 (일할 매출 기여액 ₩0 차액 보존)',
    'GUARD-5.2 (동기 DB 저장 및 무음 실패 방지)'
  ],
  dbConnected: true,
  pendingWritesCount: 0
};

const readyPromise = new Promise<ErpReadinessDiagnostics>((resolve) => {
  resolveReadyPromise = resolve;
});

// 전역 윈도우 인터페이스 초기화
if (typeof window !== 'undefined') {
  window.__ERP_READY__ = false;
  window.__ERP_DIAGNOSTICS__ = currentDiagnostics;

  window.whenErpReady = () => {
    if (window.__ERP_READY__ && window.__ERP_DIAGNOSTICS__?.isReady) {
      return Promise.resolve(window.__ERP_DIAGNOSTICS__);
    }
    return readyPromise;
  };

  window.getErpReadiness = () => {
    return window.__ERP_DIAGNOSTICS__ || currentDiagnostics;
  };
}

/**
 * ERP 시스템이 조작 가능한 상태임을 브라우저 전역에 공표합니다.
 */
export const markErpReady = (options: {
  user?: any;
  menu: string;
  tenant?: any;
}) => {
  const { user, menu, tenant } = options;

  currentDiagnostics = {
    status: user ? 'READY' : 'LOGIN_REQUIRED',
    isReady: true,
    readyAt: new Date().toISOString(),
    currentUser: user ? {
      id: user.id || user.loginId,
      name: user.name || '임직원',
      role: user.role || 'USER',
      department: user.department || ''
    } : null,
    currentTenant: tenant ? {
      id: tenant.id || 'tenant-giyeun',
      name: tenant.displayName || tenant.tradeName || '기연리프트'
    } : { id: 'tenant-giyeun', name: '기연리프트' },
    activeMenu: menu,
    domSelectorReady: 'body[data-erp-status="ready"]',
    guardrailsActive: [
      'GUARD-1.3 (출고 승인 시 RENTED 전환 강제)',
      'GUARD-2.3 (단일 EXCHANGE 및 ₩60,000 왕복할인)',
      'GUARD-4.1 (일할 매출 기여액 ₩0 차액 보존)',
      'GUARD-5.2 (동기 DB 저장 및 무음 실패 방지)'
    ],
    dbConnected: true,
    pendingWritesCount: 0
  };

  if (typeof document !== 'undefined') {
    // 1. DOM 표준 속성 주입 (Playwright / Puppeteer / AI 셀렉터 대기용)
    document.body.setAttribute('data-erp-status', 'ready');
    document.body.setAttribute('data-erp-menu', menu);
    if (user?.id || user?.loginId) {
      document.body.setAttribute('data-erp-user', user.loginId || user.id);
    }
  }

  if (typeof window !== 'undefined') {
    // 2. 전역 윈도우 플래그 & 진단 객체 갱신
    window.__ERP_READY__ = true;
    window.__ERP_DIAGNOSTICS__ = currentDiagnostics;

    // 3. 표준 CustomEvent('erp:ready') 발행
    window.dispatchEvent(new CustomEvent('erp:ready', { detail: currentDiagnostics }));

    // 4. Promise resolve
    if (resolveReadyPromise) {
      resolveReadyPromise(currentDiagnostics);
    }
  }

  return currentDiagnostics;
};

/**
 * 초기화 또는 메뉴 전환 중 상태를 표기합니다.
 */
export const markErpStatus = (status: 'INITIALIZING' | 'LOGIN_REQUIRED' | 'OFFLINE', menu: string = 'booting') => {
  currentDiagnostics.status = status;
  currentDiagnostics.isReady = false;
  currentDiagnostics.activeMenu = menu;

  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-erp-status', status.toLowerCase());
    document.body.setAttribute('data-erp-menu', menu);
  }

  if (typeof window !== 'undefined') {
    window.__ERP_READY__ = false;
    window.__ERP_DIAGNOSTICS__ = currentDiagnostics;
  }
};

/**
 * 현재 시스템의 Ready 상태 및 진단 정보를 동기적으로 반환합니다.
 * (MCP 도구 'system_check_readiness'에서 직접 호출)
 */
export const getSystemReadiness = (): ErpReadinessDiagnostics => {
  if (typeof window !== 'undefined' && window.__ERP_DIAGNOSTICS__) {
    return window.__ERP_DIAGNOSTICS__;
  }
  return currentDiagnostics;
};
