const fs = require('fs');
const content = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const lines = content.split('\n');

const target = 'data-mid="btn-ocr-biz-license"';
let btnLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(target)) {
    btnLine = i;
    break;
  }
}
const start = btnLine - 21;
const end = btnLine + 5;

const newLines = [...lines.slice(0, start), ...lines.slice(end + 1)];
fs.writeFileSync('src/pages/Customers.tsx', newLines.join('\n'), 'utf8');
