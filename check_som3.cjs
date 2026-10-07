
const fs = require('fs');
const content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes('SITE_OPTIONS') && l.includes('&&'));
if (start > -1) {
  for(let i=start; i<=start+30; i++) console.log((i+1) + ': ' + lines[i]);
}

