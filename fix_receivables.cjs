const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Receivables.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /case 'customer': return customers\.find[^\n]+;/;
const replacement = `case 'customer': {
        const c = contracts.find(x => x.id === (a as any).contractId);
        const custId = (a as any).customerId || c?.customerId;
        return customers.find(x => x.id === custId)?.name || '';
      }`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed customer lookup in Receivables');
} else {
  console.log('Regex failed');
}
