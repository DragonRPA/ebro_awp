const fs = require('fs');
let content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
const lines = content.split('\n');
const newLines = [];
let skip = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<button') && lines[i+2].includes('setActiveTab(\'MASTER_OPTIONS\')') && lines[i+20].includes('옵션 품목 마스터 ({standardOptions?.length || 0})')) {
    skip = true;
    continue;
  }
  if (skip) {
    if (lines[i].includes('</button>')) {
      skip = false;
    }
    continue;
  }
  newLines.push(lines[i]);
}
fs.writeFileSync('src/pages/SiteOptionManage.tsx', newLines.join('\n'), 'utf8');
