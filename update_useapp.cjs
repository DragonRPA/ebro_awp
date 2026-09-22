const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /(generateBillingForSingleContract,)/;
const match = content.match(regex);
if (match) {
  content = content.replace(regex, `$1 splitBillingAbsoluteAmount,`);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Added splitBillingAbsoluteAmount to destructured useApp()');
} else {
  console.log('Target not found for useApp');
}
