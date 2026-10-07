const fs = require('fs');
let lines = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('isSaving ?')) {
    for (let j = Math.max(0, i-20); j <= Math.min(lines.length-1, i+10); j++) {
      console.log(`${j+1}: ${lines[j].replace(/[^\x00-\x7F]/g, '?')}`);
    }
  }
}
