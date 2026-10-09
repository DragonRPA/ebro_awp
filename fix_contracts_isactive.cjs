const fs = require('fs');
let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

c = c.replace('isActive: true, // _TEMP_', 'isActive: true,');

const targetStr = `email: newSiteContactEmail || '미상',
        isActive: true,`;
const targetStr2 = `email: newSiteContactEmail || '미상',\r\n        isActive: true,`;

if (c.includes(targetStr)) {
  c = c.replace(targetStr, `email: newSiteContactEmail || '미상',`);
} else if (c.includes(targetStr2)) {
  c = c.replace(targetStr2, `email: newSiteContactEmail || '미상',`);
}

fs.writeFileSync('src/pages/Contracts.tsx', c);
