
const fs = require('fs');
const content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => { if(l.includes('현장 옵션 및 보양 설정') || l.includes('옵션 속성 복사')) console.log((i+1) + ': ' + l.trim()); });

