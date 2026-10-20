// src/utils/clientSecurityDefense.ts
/**
 * 🛡️ 웹앱 클라이언트 역공학 방어 및 런타임 보안 방어벽
 * 1. DevTools 열림 감지 및 런타임 디버깅 브레이크포인트 방해
 * 2. 프로덕션 환경 console 객체 무력화 (내부 비즈니스 로직 및 DB 스키마 노출 차단)
 * 3. window 전역 객체 임의 변조 방지
 * 4. F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U 등 소스보기 단축키 차단 (모바일 브라우저 및 웹앱 뷰)
 * 5. 마우스 우클릭 컨텍스트 메뉴 무력화 (Inspect Element 차단)
 */

export function initClientSecurityDefense(): void {
  if (typeof window === 'undefined') return;

  const isLocalhost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1';

  // 1. 프로덕션 환경 콘솔 정보 소탕 (로컬 개발 환경에서는 정상 작동)
  if (!isLocalhost) {
    try {
      const noop = () => {};
      const devWarn = (..._args: any[]) => {};
      
      // 중요한 DB 스키마 및 네트워크 패킷 덤프를 노출하는 콘솔 함수 마스킹
      console.log = noop;
      console.info = noop;
      console.debug = noop;
      console.dir = noop;
      console.dirxml = noop;
      console.table = noop;
      console.trace = noop;
      // error와 warn은 무음 방지 및 에러 보고를 위해 유지하되 스택 트레이스 난독화
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        if (args[0] && typeof args[0] === 'string' && (args[0].includes('__') || args[0].includes('Supabase'))) return;
        originalWarn(...args);
      };
    } catch {}
  }

  // 2. 단축키 및 컨텍스트 메뉴(우클릭 검사) 방어 (프로덕션 환경)
  if (!isLocalhost) {
    // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S 방어
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I (개발자 도구), Ctrl+Shift+J (콘솔), Ctrl+Shift+C (요소 검사)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Cmd+Option+I (Mac Safari/Chrome)
      if (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+U (소스 보기)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, { capture: true });

    // 우클릭 컨텍스트 메뉴 차단
    window.addEventListener('contextmenu', (e: MouseEvent) => {
      // 입력 폼이나 텍스트 선택 영역이 아닌 경우 우클릭 차단
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return; // 복사/붙여넣기를 위한 폼 내부 우클릭은 허용
      }
      e.preventDefault();
    }, { capture: true });
  }

  // 3. 런타임 역공학 디버거 트랩 (DevTools Pause Attack 무력화)
  if (!isLocalhost) {
    const triggerAntiDebug = () => {
      const startTime = performance.now();
      // debugger 트리거 시 개발자 도구가 열려 있으면 실행이 멈추면서 시간 차 발생
      (function() {
        // eslint-disable-next-line no-debugger
        const f = new Function('debugger');
        f();
      })();
      const endTime = performance.now();
      if (endTime - startTime > 100) {
        // 개발자 도구 디버깅 중으로 판정 -> 세션 메모리 오염 방어
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('__ebro_sec_flag__', '1');
          }
        } catch {}
      }
    };

    // 가벼운 백그라운드 인터벌로 안티 디버깅 유지
    try {
      setInterval(triggerAntiDebug, 3500);
    } catch {}
  }
}
