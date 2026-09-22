const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/context/AppContext.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'splitBillingAbsoluteAmount: (billingId: string, splitAmount: number) => Promise<void>;',
  'splitBillingAbsoluteAmount: (billingId: string, splitAmount: number) => Promise<string>;'
);

content = content.replace(
  'const splitBillingAbsoluteAmount = async (billingId: string, splitAmount: number): Promise<void> => {',
  'const splitBillingAbsoluteAmount = async (billingId: string, splitAmount: number): Promise<string> => {'
);

const targetBlock = `    db.updateRow<Billing>('billings', origBilling.id, {
      totalAmount: origBilling.totalAmount - splitAmount,
      updatedAt: now
    });
    
    await db.awaitPendingWrites();
    refreshAllData();
  };`;

const replaceBlock = `    db.updateRow<Billing>('billings', origBilling.id, {
      totalAmount: origBilling.totalAmount - splitAmount,
      updatedAt: now
    });
    
    await db.awaitPendingWrites();
    refreshAllData();
    return childBillingId;
  };`;

content = content.replace(targetBlock, replaceBlock);

fs.writeFileSync(path, content, 'utf8');
console.log('AppContext fixed');
