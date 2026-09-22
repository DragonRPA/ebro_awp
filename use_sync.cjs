const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add to useApp destructuring
const useAppRegex = /generateBillingsForMonth, getDueContractsForBilling, generateDueBillings, regenerateBilling, generateBillingForSingleContract, splitBillingAbsoluteAmount,/;
if (content.match(useAppRegex)) {
  content = content.replace(
    useAppRegex,
    `$& syncContractBillingMilestones,`
  );
}

// 2. Call it in handleGenerateWizardBilling
const callRegex = /await db\.awaitPendingWrites\(\);\s*\/\/\s*계약이력 기록/;
if (content.match(callRegex)) {
  content = content.replace(
    callRegex,
    `syncContractBillingMilestones(selectedContractForWizard.id);\n      $&`
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('Added syncContractBillingMilestones to Billings.tsx');
