const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

c = c.replace(
  /<option value="">-- 옵션 참조 현장 선택 \(\{optionReferenceSites\.length\}개\) --<\/option>/g,
  `<option value="">-- [선택] 기존 현장 담당자/옵션 정보 복사해오기 ({optionReferenceSites.length}개) --</option>`
);

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Fixed Customers.tsx');
