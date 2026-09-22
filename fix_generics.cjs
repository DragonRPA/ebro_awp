const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/context/AppContext.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /(const splitBillingAbsoluteAmount = async[^}]*\s*await db\.awaitPendingWrites\(\);\s*refreshAllData\(\);\s*\};)/;
const match = content.match(regex);
if (match) {
  let replacement = match[1];
  replacement = replacement.replace(/db\.insertRow\('billings'/g, "db.insertRow<Billing>('billings'");
  replacement = replacement.replace(/db\.insertRow\('billingDetails'/g, "db.insertRow<BillingDetail>('billingDetails'");
  replacement = replacement.replace(/db\.updateRow\('billings'/g, "db.updateRow<Billing>('billings'");
  
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed typescript generics in AppContext');
} else {
  console.log('Regex not matched');
}
