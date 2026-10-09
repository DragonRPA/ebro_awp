const fs = require('fs');
const lines = fs.readFileSync('src/pages/Customers.tsx', 'utf8').split('\n');
let s = -1, e = -1;
let s2 = -1; // for insert target
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('🔍 현장별 옵션관리')) s = i;
  if (s !== -1 && e === -1 && lines[i].includes('title="선택한 등록 현장의 옵션 속성을 현재 현장에 복사 적용"')) e = i + 19; 
  // wait, the block ends with {selectedRefSite && (...)} which has 11 lines
}
console.log('block start:', s, 'approx block end:', e);
