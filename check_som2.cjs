const fs = require('fs');
const content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('activeTab === \\'SITE_OPTIONS\\''));
for(let i=start; i<=start+40; i++) console.log((i+1) + ': ' + lines[i]);
