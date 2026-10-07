const fs = require('fs');
const content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 400; i <= 480; i++) {
  console.log('Line ' + (i+1) + ': ' + lines[i]);
}
