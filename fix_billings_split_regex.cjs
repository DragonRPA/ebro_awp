const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /await splitBillingAbsoluteAmount\([^)]+\);\s+showToast\([^)]+\);\s+setSplitModalOpen\(false\);/m;

if (content.match(regex)) {
  content = content.replace(/await splitBillingAbsoluteAmount\(([^,]+),\s*([^)]+)\);/, `const newBillingId = await splitBillingAbsoluteAmount($1, $2);\n      if (searchedBillingIds) {\n        setSearchedBillingIds([...searchedBillingIds, newBillingId]);\n      }`);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Billings fixed with regex');
} else {
  console.log('Regex not matched');
}
