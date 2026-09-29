import { useEffect } from 'react';

export const useGlobalGridScroll = () => {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // 1. Find the closest scrollable container
      let target = e.target as HTMLElement | null;
      let scrollableContainer: HTMLElement | null = null;
      
      while (target && target !== document.body) {
        // Only target containers with actual horizontal overflow and configured to scroll
        const style = window.getComputedStyle(target);
        const hasHorizontalScrollbar = target.scrollWidth > target.clientWidth;
        const isOverflowAuto = style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
        
        // Treat table containers or explicitly scrollable divs
        if (hasHorizontalScrollbar && isOverflowAuto) {
          scrollableContainer = target;
          break;
        }
        target = target.parentElement;
      }

      if (scrollableContainer) {
        // Shift + Wheel = Horizontal Scroll
        if (e.shiftKey) {
          e.preventDefault();
          scrollableContainer.scrollLeft += (e.deltaY || e.deltaX);
        }
        // If there's no vertical scrollbar but there is a horizontal one, 
        // normal wheel can also scroll horizontally (convenience feature for grids)
        else if (scrollableContainer.scrollHeight <= scrollableContainer.clientHeight && scrollableContainer.scrollWidth > scrollableContainer.clientWidth) {
          // If deltaY is present (vertical wheel action) but no vertical scroll exists
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
             e.preventDefault();
             scrollableContainer.scrollLeft += e.deltaY;
          }
        }
      }
    };

    // Use passive: false so we can preventDefault
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);
};
