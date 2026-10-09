const fs = require('fs');
let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

c = c.replace(/ \| 'SUCCEEDED'/g, '');
c = c.replace(/\} else if \(quickChipFilter === 'SUCCEEDED'\) matchesChip = c\.status === 'SUCCEEDED';\r?\n/g, '');
c = c.replace(/c\.status === 'SUCCEEDED' \? '승계됨' : \r?\n\s*/g, '');
c = c.replace(/c\.status === 'SUCCEEDED' \? '승계됨' : /g, '');
c = c.replace(/activeContract\.status === 'SUCCEEDED' \? '승계됨' : /g, '');
c = c.replace(/c\.status === 'SUCCEEDED' \? 'badge badge-info' : /g, '');
c = c.replace(/<option value="SUCCEEDED">승계됨<\/option>\r?\n\s*/g, '');
c = c.replace(/\{ id: 'SUCCEEDED', label: `승계건 \(\$\{contracts\.filter\(c => c\.status === 'SUCCEEDED'\)\.length\}\)` \},\r?\n\s*/g, '');

fs.writeFileSync('src/pages/Contracts.tsx', c);
console.log('Success!');
