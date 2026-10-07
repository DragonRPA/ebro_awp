const xlsx = require('xlsx');
const workbook = xlsx.readFile('master.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

let hasTags = false;
let taewoo = false;
for (const cellAddress in worksheet) {
  if (cellAddress[0] === '!') continue;
  const cell = worksheet[cellAddress];
  const v = cell.v ? String(cell.v) : '';
  if (v.includes('{고객사}')) hasTags = true;
  if (v.includes('태우이엔지')) taewoo = true;
}

console.log('hasTags:', hasTags);
console.log('taewoo:', taewoo);
console.log('A44:', worksheet['A44'] ? worksheet['A44'].v : null);
console.log('A1:', worksheet['A1'] ? worksheet['A1'].v : null);
console.log('Row with 태우이엔지:', Object.keys(worksheet).find(k => worksheet[k].v && String(worksheet[k].v).includes('태우이엔지')));
