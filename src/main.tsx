import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeHindsightTracker } from './utils/hindsightTracker'
import { AppProvider } from './context/AppContext.tsx'
import { TradeProvider } from './context/TradeContext.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initClientSecurityDefense } from './utils/clientSecurityDefense'

// 🛡️ 역공학 방어: 프로덕션 콘솔 소탕, 개발자 도구 변조 및 우클릭/단축키 방어 활성화
initClientSecurityDefense();

// [System Optimization] Global Unhandled Promise Rejection Handler
// 비동기 프로세스(fire-and-forget DB 호출 등)가 실패 시 무음 처리되는 위험을 차단합니다.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  // 에러 메시지 추출
  let msg = '비동기 작업 처리 중 오류가 발생했습니다.';
  if (event.reason?.message) msg += '\n' + event.reason.message;
  
  // 사용자에게 경고 (무음 실패 방지 원칙 준수)
  if (msg.includes('Failed to fetch') || msg.includes('network')) {
     console.warn('Network error swallowed globally.');
  } else {
     alert('[시스템 경고] ' + msg);
  }
});

initializeHindsightTracker();

// 🧹 브라우저 주소창 임시 캐시무효화 파라미터 자동 정리 (히스토리 오염 방지)
try {
  if (typeof window !== 'undefined' && window.location.search) {
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.has('_v')) {
      url.searchParams.delete('_v');
      changed = true;
    }
    if (url.searchParams.has('_t')) {
      url.searchParams.delete('_t');
      changed = true;
    }
    if (changed) {
      const cleanPath = url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash;
      window.history.replaceState(window.history.state, document.title, cleanPath);
    }
  }
} catch (e) {
  // Silent ignore
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="시스템 일시 오류 복구">
      <AppProvider>
        <TradeProvider><Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16', color: '#94a3b8' }}>시스템 로딩 중...</div>}><App /></Suspense></TradeProvider>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
)
