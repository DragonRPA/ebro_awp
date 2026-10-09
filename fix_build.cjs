const fs = require('fs');

// Fix AppContext.tsx
let c = fs.readFileSync('src/context/AppContext.tsx', 'utf8');
c = c.replace(/db\.insertRow\('customer_contacts',/g, "db.insertRow<any>('customer_contacts',");
fs.writeFileSync('src/context/AppContext.tsx', c);

// Fix Customers.tsx
let c2 = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
c2 = c2.replace(/name: prev\.name \|\| refSite\.name,/g, "name: prev?.name || refSite.name,");
c2 = c2.replace(/address: prev\.address \|\| refSite\.address,/g, "address: prev?.address || refSite.address,");
fs.writeFileSync('src/pages/Customers.tsx', c2);

console.log('Fixed build errors');
