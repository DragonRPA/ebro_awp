const fs = require('fs');
const path = 'src/pages/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  /const canActRentAsset = [^\n]+;/,
  "const canActRentAsset = hasPermission('rent_asset', 'save') || hasPermission('rent_asset', 'view') || isExecUser || userRole === 'LOGISTICS' || userRole === 'DELIVERY' || (userDept && (userDept.includes('배차') || userDept.includes('주기장')));"
);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed canActRentAsset');
