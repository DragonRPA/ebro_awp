const fs = require('fs');
let c = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

c = c.replace('CustomerSite, Product', 'CustomerSite, SiteMaster, Product');

fs.writeFileSync('src/context/AppContext.tsx', c);
console.log('Fixed AppContext SiteMaster import');
