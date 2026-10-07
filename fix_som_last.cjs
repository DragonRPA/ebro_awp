
const fs = require('fs');
let lines = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8').split('\n');
let res = [];
for (let line of lines) {
  if (line.includes('Cannot find name \\'cust\\'')) continue;
  if (line.includes('{cust?.name || \\'-\\'}')) continue;
  if (line.includes('\\'고객사\\': cust?.name || \\'-\\',')) continue;
  res.push(line);
}
fs.writeFileSync('src/pages/SiteOptionManage.tsx', res.join('\n'), 'utf8');

