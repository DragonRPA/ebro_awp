import { useEffect } from 'react';

/**
 * 전역 그리드 휠 스크롤 훅
 * - 이벤트 위임: main-content-area 하나에만 리스너 부착
 * - Shift + 휠: 이벤트 발생 좌표에서 가장 가까운 스크롤 가능한 컨테이너에 횡스크롤 적용
 * - 일반 휠: 완전히 기본 동작(페이지 세로 스크롤)에 위임, 절대 간섭하지 않음
 */
export const useGridWheel = (activeTab: string) => {
  useEffect(() => {
    const mainArea = document.querySelector('.main-content-area') as HTMLElement | null;
    if (!mainArea) return;

    const handleWheel = (e: WheelEvent) => {
      // Shift 키 없으면 아무것도 하지 않음 - 기본 동작 완전 위임
      if (!e.shiftKey) return;

      // e.target에서 위로 올라가며 스크롤 가능한 테이블 컨테이너 탐색
      let el = e.target as HTMLElement | null;
      while (el && el !== mainArea) {
        const style = window.getComputedStyle(el);
        const canScrollH = el.scrollWidth > el.clientWidth;
        const overflowH = style.overflowX === 'auto' || style.overflowX === 'scroll';
        // table-container 클래스 또는 overflowX:auto/scroll 이고 실제 가로 스크롤이 가능한 요소
        if (canScrollH && (overflowH || el.classList.contains('table-container'))) {
          el.scrollLeft += e.deltaY;
          e.preventDefault();
          return;
        }
        el = el.parentElement;
      }
      // 적합한 컨테이너를 찾지 못한 경우 기본 동작 유지
    };

    mainArea.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      mainArea.removeEventListener('wheel', handleWheel);
    };
  }, [activeTab]);
};
