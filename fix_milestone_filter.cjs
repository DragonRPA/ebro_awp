const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/context/AppContext.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\.filter\(b => b\.contractId === c\.id && b\.status !== 'REJECTED'\)/;
if (content.match(regex)) {
  content = content.replace(
    regex,
    `.filter(b => b.contractId === c.id && b.status !== 'REJECTED' && (!b.billingType || b.billingType === 'RENTAL'))`
  );
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed syncContractBillingMilestones to only count RENTAL billings');
} else {
  console.log('Could not find regex');
}
