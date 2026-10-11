const fs = require('fs');
const path = require('path');

function walk(dir) {
  let list = [];
  for (const item of fs.readdirSync(dir)) {
    const p = path.join(dir, item);
    const s = fs.statSync(p);
    if (s.isDirectory()) list = list.concat(walk(p));
    else if (/\.(tsx|jsx|css)$/.test(item)) list.push(p);
  }
  return list;
}

const files = walk('src');
const list = [];

const lightColors = [
  '#f1f5f9', '#f8fafc', '#f3f4f6', '#e2e8f0', '#e5e7eb',
  '#edf2f7', '#f0f2f5', '#f5f5f5', '#f7fafc', '#f9fafb', '#eef2f6'
];

files.forEach(file => {
  if (file.includes('templates') || file.includes('universalTemplateEngine') || file.includes('monthlyReportPdfBuilder')) return;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    for (const col of lightColors) {
      if (lower.includes(col)) {
        if (lower.includes('background') || lower.includes('bg-')) {
          list.push({ file: file.replace(/\\/g, '/'), line: idx + 1, col, text: line.trim() });
          break;
        }
      }
    }
  });
});

fs.writeFileSync('scripts/mismatches.json', JSON.stringify(list, null, 2));
console.log('Saved', list.length, 'mismatches to scripts/mismatches.json');
