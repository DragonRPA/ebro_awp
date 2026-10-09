const fs = require('fs');
let c = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

// Add customers to useApp destructuring
c = c.replace(
  'const { \n    sites, standardOptions',
  'const { \n    customers, sites, standardOptions'
);
// Or if it's single line
c = c.replace(
  '    sites, standardOptions, saveStandardOption, deleteStandardOption,',
  '    customers, sites, standardOptions, saveStandardOption, deleteStandardOption,'
);

// Fix the map logic
c = c.replace(
  `{(() => { const cust = db.customers.find(c => c.id === site.customerId); return cust ? \`[\${cust.name}] \${site.name}\` : site.name; })()}`,
  `{(() => { const cust = (customers || []).find((c: Customer) => c.id === site.customerId); return cust ? \`[\${cust.name}] \${site.name}\` : site.name; })()}`
);

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Fixed SiteOptionManage.tsx errors');
