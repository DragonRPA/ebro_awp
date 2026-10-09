const fs = require('fs');
const lines = fs.readFileSync('src/pages/Customers.tsx', 'utf8').split('\n');

let s = -1;
let e = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('data-mid="site-option-ref-search-box"')) {
    s = i - 2;
  }
  if (s !== -1 && e === -1 && lines[i].includes('<strong>요구사양:</strong>')) {
    e = i + 7;
  }
}

if (s === -1 || e === -1) {
  console.log('block not found');
  process.exit(1);
}

const block = lines.slice(s, e + 1);
const remainingLines = [...lines.slice(0, s), ...lines.slice(e + 1)];

let insertIdx = -1;
for (let i = 0; i < remainingLines.length; i++) {
  if (remainingLines[i].includes('{editingSite.id ? \'현장 수정\' : \'신규 현장 등록\'}')) {
    insertIdx = i + 4; // after </h3> and </button></div>
    break;
  }
}

if (insertIdx === -1) {
  console.log('insert target not found');
  process.exit(1);
}

const newLines = [
  ...remainingLines.slice(0, insertIdx),
  ...block,
  ...remainingLines.slice(insertIdx)
];

let c = newLines.join('\n');
c = c.replace(
  '현장별 옵션관리 등록 현장 검색 (옵션 속성 복사)',
  '기존 현장 정보 복사해오기 (명칭/주소/옵션)'
);
c = c.replace(
  '-- [선택] 기존 현장 담당자/옵션 정보 복사해오기',
  '-- [선택] 복사해 올 기존 현장 선택'
);

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Moved template loader block to the top');
