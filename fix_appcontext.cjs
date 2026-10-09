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

c = c.replace(
  `const newCA = db.insertRow<ContractAsset>('contractAssets', {
        contractId: targetContract.id,
        assetId: ca.assetId,
        monthlyRentalFee: ca.monthlyRentalFee,
        dailyRentalFee: ca.dailyRentalFee,
        startDate: nextDay,
        endDate: oldEndDate,
        predecessorContractId: contractId,
        predecessorContractAssetId: ca.id,
        createdAt: nowIsoSucceed
      });`,
  `const newCA = db.insertRow<ContractAsset>('contractAssets', {
        contractId: targetContract.id,
        assetId: ca.assetId,
        monthlyRentalFee: ca.monthlyRentalFee,
        dailyRentalFee: ca.dailyRentalFee,
        startDate: nextDay,
        endDate: oldEndDate,
        status: ca.status,
        predecessorContractId: contractId,
        predecessorContractAssetId: ca.id,
        createdAt: nowIsoSucceed
      });`
);
fs.writeFileSync('src/context/AppContext.tsx', c);
console.log('Fixed AppContext.tsx');
