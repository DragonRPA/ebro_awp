
const fs = require('fs');
const content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => { if(l.includes('tab-toggle')) console.log((i+1) + ': ' + l.trim()); });

