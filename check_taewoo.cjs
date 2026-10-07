const xlsx = require('xlsx');
const workbook = xlsx.readFile('C:/eBroAgent/drive_mirror/01.계약서패키지_마스터.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

let taewoo = false;
for (const cellAddress in worksheet) {
  if (cellAddress[0] === '!') continue;
  const cell = worksheet[cellAddress];
  const v = cell.v ? String(cell.v) : '';
  if (v.includes('태우이엔지')) taewoo = true;
}
console.log('taewoo in actual C drive file:', taewoo);
