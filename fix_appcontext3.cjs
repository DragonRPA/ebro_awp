const fs = require('fs');
let c = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

c = c.replace(/oldCAssets\.forEach\(ca => \{\s+db\.updateRow<ContractAsset>\('contractAssets', ca\.id, \{ endDate: successionDate \}\);\s+\}\);/, `oldCAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { 
        endDate: successionDate,
        status: 'RETURNED',
        actualReturnDate: successionDate
      });
    });`);

fs.writeFileSync('src/context/AppContext.tsx', c);
