
const fs = require('fs');
const content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 415; i <= 485; i++) {
  console.log('Line ' + (i+1) + ': ' + lines[i]);
}

