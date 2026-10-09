const fs = require('fs');
let c = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

c = c.replace(
  `oldCAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { endDate: successionDate });
    });`,
  `oldCAssets.forEach(ca => {
      db.updateRow<ContractAsset>('contractAssets', ca.id, { 
        endDate: successionDate,
        status: 'RETURNED',
        actualReturnDate: successionDate
      });
    });`
);

// for newCA
c = c.replace(
  `        endDate: oldEndDate,
        predecessorContractId: contractId,
        predecessorContractAssetId: ca.id,
        createdAt: nowIsoSucceed`,
  `        endDate: oldEndDate,
        status: ca.status,
        predecessorContractId: contractId,
        predecessorContractAssetId: ca.id,
        createdAt: nowIsoSucceed`
);

fs.writeFileSync('src/context/AppContext.tsx', c);
console.log('Fixed AppContext.tsx again');
