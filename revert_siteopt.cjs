const fs = require('fs');
let c = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

c = c.replace(
  `{(() => { const cust = (customers || []).find((c: Customer) => c.id === site.customerId); return cust ? \`[\${cust.name}] \${site.name}\` : site.name; })()}`,
  `{site.name}`
);

fs.writeFileSync('src/pages/SiteOptionManage.tsx', c);
console.log('Fixed SiteOptionManage.tsx');
