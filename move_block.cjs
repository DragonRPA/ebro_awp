const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

const markerStart = '{/* 🔍 현장별 옵션관리 등록 현장 검색 및 옵션 속성 복사 (참조 동기화) */}';
const searchStart = c.indexOf(markerStart);
const nextDiv = c.indexOf('</div>', c.indexOf('{selectedRefSite && (', searchStart));
const actualEnd = c.indexOf('</div>', nextDiv + 6) + 6;
// But wait, there is a better way. We can use a regex or string extraction carefully.
