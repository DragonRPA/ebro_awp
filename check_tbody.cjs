
const fs = require('fs');
const content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('1. 유상 옵션 (PAID)'));
for(let i=idx+5; i<=idx+30; i++) console.log((i+1) + ': ' + lines[i]);

