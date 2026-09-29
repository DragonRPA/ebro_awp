import { useEffect } from 'react';

export const useGridWheel = (activeTab: string) => {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only intervene if Shift key is pressed
      if (e.shiftKey) {
        const target = e.currentTarget as HTMLElement;
        target.scrollLeft += (e.deltaY || e.deltaX);
        e.preventDefault(); // prevent default behavior (like navigating history or page zoom in some browsers)
      }
    };

    const attachListeners = () => {
      // Find all grid/table objects
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        let wrapper = table.parentElement;
        // Search up to find the scrollable container for this specific table
        while (wrapper && wrapper.tagName !== 'MAIN' && wrapper !== document.body) {
          const style = window.getComputedStyle(wrapper);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll' || wrapper.classList.contains('table-container')) {
             if (!wrapper.dataset.wheelAttached) {
               wrapper.addEventListener('wheel', handleWheel, { passive: false });
               wrapper.dataset.wheelAttached = 'true';
             }
             break; // Stop at the first scrollable wrapper of this table
          }
          wrapper = wrapper.parentElement;
        }
      });
    };

    // Attach immediately and after short delays to handle React asynchronous rendering
    attachListeners();
    const t1 = setTimeout(attachListeners, 300);
    const t2 = setTimeout(attachListeners, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      // Cleanup happens naturally when React unmounts the nodes, 
      // but if needed we could track them.
    };
  }, [activeTab]);
};
