const fs = require('fs');

let content = fs.readFileSync('D:/01.AntiGravity/eBro/src/utils/hindsightTracker.ts', 'utf-8');

// 1. Change interface
content = content.replace(
  /ui_context_bundle: Record<string, any>;/,
  'ui_context_bundle: Array<any>;'
);

// 2. Change the collection logic
const oldLogicStart = "const observeEls = searchRoot.querySelectorAll('[data-hs-observe]');";
const oldLogicEnd = "ui_context_bundle: uiContextBundle\n      };";

const newLogic = `      // DOM 순서를 유지하며 모든 상호작용 요소와 관찰 요소를 긁어모음
      const elements = searchRoot.querySelectorAll('input, select, textarea, button, [data-hs-observe]');
      const uiContextBundle: Array<any> = [];
      const processed = new Set();
      let seq = 1;

      elements.forEach((el) => {
        if (processed.has(el)) return;
        processed.add(el);

        let value: any = null;
        let elementType = '';
        let labelStr = '';

        if (el.id) {
          const lbl = document.querySelector(\`label[for="\${el.id}"]\`);
          if (lbl) labelStr = lbl.textContent || '';
        }
        if (!labelStr) {
          const parentLbl = el.closest('label');
          if (parentLbl) {
            // Remove the element's own text if it's inside the label to get just the label text
            const clone = parentLbl.cloneNode(true) as HTMLElement;
            const inputInside = clone.querySelector('input, select, textarea');
            if (inputInside) inputInside.remove();
            labelStr = clone.textContent || '';
          }
        }
        // If still no label, try to find a preceding sibling or parent container with text
        if (!labelStr) {
           const prev = el.previousElementSibling;
           if (prev && prev.tagName !== 'INPUT' && prev.tagName !== 'SELECT' && prev.tagName !== 'BUTTON') {
             labelStr = prev.textContent || '';
           }
        }

        if (el instanceof HTMLInputElement) {
          elementType = el.type;
          if (el.type === 'checkbox' || el.type === 'radio') {
            value = el.checked;
          } else {
            value = el.value;
          }
        } else if (el instanceof HTMLSelectElement) {
          elementType = 'select';
          const selected = el.options[el.selectedIndex];
          value = selected ? { value: el.value, text: selected.textContent } : el.value;
        } else if (el instanceof HTMLTextAreaElement) {
          elementType = 'textarea';
          value = el.value;
        } else if (el instanceof HTMLButtonElement) {
          elementType = 'button';
          value = el.textContent?.trim() || '';
        } else {
          elementType = 'container';
          value = el.getAttribute('data-hs-observe') || '';
        }

        uiContextBundle.push({
          seq: seq++,
          tag: el.tagName.toLowerCase(),
          type: elementType,
          id: el.id || '',
          name: (el as any).name || el.getAttribute('data-hs-observe') || '',
          label: labelStr.trim().replace(/\\s+/g, ' ').substring(0, 50),
          value: value
        });
      });

      const payload: HindsightMemoryBundle = {
        action_name: actionName,
        ui_context_bundle: uiContextBundle
      };`;

const startIndex = content.indexOf(oldLogicStart);
const endIndex = content.indexOf(oldLogicEnd) + oldLogicEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  fs.writeFileSync('D:/01.AntiGravity/eBro/src/utils/hindsightTracker.ts', before + newLogic + after, 'utf-8');
  console.log("Success");
} else {
  console.log("Failed to find logic block");
}
