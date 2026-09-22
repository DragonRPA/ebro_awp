const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/context/AppContext.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add to AppContextType
const interfaceRegex = /generateDueBillings:\s*\(.*?\)\s*=>\s*Promise<.*?>;/;
if (content.match(interfaceRegex)) {
  content = content.replace(
    interfaceRegex,
    `$&
  syncContractBillingMilestones: (contractId?: string) => void;`
  );
}

// 2. Add to returned context
const returnRegex = /generateBillingsForMonth, getDueContractsForBilling, generateDueBillings, generateBillingForSingleContract, /;
if (content.match(returnRegex)) {
  content = content.replace(
    returnRegex,
    `$&syncContractBillingMilestones, `
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('Exported syncContractBillingMilestones');
