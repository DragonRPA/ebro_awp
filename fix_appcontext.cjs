const fs = require('fs');

let c = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

c = c.replace(/contractId: targetContract\.id,\r?\n\s*assetId: ca\.assetId,\r?\n\s*monthlyRentalFee: ca\.monthlyRentalFee,\r?\n\s*dailyRentalFee: ca\.dailyRentalFee,\r?\n\s*startDate: nextDay,\r?\n\s*endDate: oldEndDate,\r?\n\s*createdAt: nowIsoSucceed/g, 
`contractId: targetContract.id,
        assetId: ca.assetId,
        monthlyRentalFee: ca.monthlyRentalFee,
        dailyRentalFee: ca.dailyRentalFee,
        startDate: nextDay,
        endDate: oldEndDate,
        predecessorContractId: contractId,
        predecessorContractAssetId: ca.id,
        createdAt: nowIsoSucceed`);

c = c.replace(/contractId: destinationContract\.id,\r?\n\s*assetId: sourceCA\.assetId,\r?\n\s*monthlyRentalFee: sourceCA\.monthlyRentalFee,\r?\n\s*dailyRentalFee: sourceCA\.dailyRentalFee,\r?\n\s*startDate: relocationStartDate,\r?\n\s*endDate: oldEndDate,\r?\n\s*createdAt: nowIso/g,
`contractId: destinationContract.id,
      assetId: sourceCA.assetId,
      monthlyRentalFee: sourceCA.monthlyRentalFee,
      dailyRentalFee: sourceCA.dailyRentalFee,
      startDate: relocationStartDate,
      endDate: oldEndDate,
      predecessorContractId: sourceContract.id,
      predecessorContractAssetId: sourceCA.id,
      createdAt: nowIso`);

fs.writeFileSync('src/context/AppContext.tsx', c);
console.log('Success!');
