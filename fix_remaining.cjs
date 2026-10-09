const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

c = c.replace(/      isActive: true,\r?\n      contacts: initialContacts,/g, '      contacts: initialContacts,');
fs.writeFileSync('src/pages/Customers.tsx', c);

let d = fs.readFileSync('src/pages/PublicConstructionPermitsPage.tsx', 'utf8');
d = d.replace(/        isActive: true,\r?\n/g, '');
fs.writeFileSync('src/pages/PublicConstructionPermitsPage.tsx', d);

console.log('Fixed both');
