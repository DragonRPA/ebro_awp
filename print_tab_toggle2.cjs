
const fs = require('fs');
const content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
const lines = content.split('\n');
for(let i=365; i<=380; i++) console.log((i+1) + ': ' + lines[i]);

