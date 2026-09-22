const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = "b.details?.some(d => d.amount < 0 && d.itemName.includes('분할'))";
const replacementStr = "billingDetails.filter(d => d.billingId === b.id).some(d => d.amount < 0 && d.itemName.includes('분할'))";

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed b.details?.some');
} else {
  console.log('Not found');
}
