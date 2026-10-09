const fs = require('fs');
let appCtx = fs.readFileSync('src/context/AppContext.tsx', 'utf8').split('\n');
appCtx = appCtx.filter(l => !l.includes('isActive: site.isActive !== undefined ? site.isActive : true,'));
fs.writeFileSync('src/context/AppContext.tsx', appCtx.join('\n'));

let mobCust = fs.readFileSync('src/mobile/pages/MobileCustomerManage.tsx', 'utf8').split('\n');
mobCust = mobCust.map(l => {
  if (l.includes('const custSites = sites.filter(s => s.customerId === c.id && s.isActive !== false);')) {
    return l.replace('s.isActive !== false', 'siteMasters.find(sm => sm.id === s.siteMasterId)?.isActive !== false');
  }
  return l;
});
fs.writeFileSync('src/mobile/pages/MobileCustomerManage.tsx', mobCust.join('\n'));
console.log('Fixed brute force');
