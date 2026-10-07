const xlsx = require('xlsx');
const workbook = xlsx.readFile('master.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

let tags = new Set();
for (const cellAddress in worksheet) {
  if (cellAddress[0] === '!') continue;
  const v = worksheet[cellAddress].v ? String(worksheet[cellAddress].v) : '';
  const matches = v.match(/\{[^}]+\}/g);
  if (matches) {
    matches.forEach(m => tags.add(m));
  }
}
console.log('Tags found:', Array.from(tags).join(', '));
