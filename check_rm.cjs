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
for (let i = start; i <= start + 30; i++) {
  console.log(i + ': ' + lines[i]);
}
