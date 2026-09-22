const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/context/AppContext.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/db\.insertRow\('billings'/g, "db.insertRow<Billing>('billings'");
content = content.replace(/db\.insertRow\('billingDetails'/g, "db.insertRow<BillingDetail>('billingDetails'");
content = content.replace(/db\.updateRow\('billings'/g, "db.updateRow<Billing>('billings'");
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed');
