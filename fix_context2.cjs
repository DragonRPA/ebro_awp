const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/context/AppContext.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /(const splitBillingAbsoluteAmount = async \([^)]*\): Promise<void> => \{[\s\S]*?await saveDb\(db\);\s*\};)/;
const match = content.match(regex);

if (match) {
  const replacement = `const splitBillingAbsoluteAmount = async (billingId: string, splitAmount: number): Promise<void> => {
    const origBilling = db.billings.find(b => b.id === billingId);
    if (!origBilling) throw new Error("원본 청구를 찾을 수 없습니다.");
    if (origBilling.status === 'PAID') throw new Error("이미 수납이 완료된 청구서는 분할할 수 없습니다.");
    if (splitAmount <= 0 || splitAmount >= origBilling.totalAmount) throw new Error("분할 금액이 유효하지 않습니다.");
    
    const now = new Date().toISOString();

    const childBillingId = 'b_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000);
    db.insertRow('billings', {
      id: childBillingId,
      billingType: origBilling.billingType,
      customerId: origBilling.customerId,
      contractId: origBilling.contractId,
      invoiceId: origBilling.invoiceId,
      billingYm: origBilling.billingYm,
      billingDate: origBilling.billingDate,
      totalAmount: splitAmount,
      paidAmount: 0,
      status: origBilling.status,
      rejectReason: origBilling.rejectReason,
      isPartial: origBilling.isPartial,
      parentBillingId: origBilling.id,
      createdAt: now,
      updatedAt: now
    });

    const childDetailId = 'bd_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000) + 'c';
    db.insertRow('billingDetails', {
      id: childDetailId,
      billingId: childBillingId,
      contractAssetId: undefined,
      assetId: undefined,
      itemName: '금액 분할 청구건',
      quantity: 1,
      unitPrice: splitAmount,
      amount: splitAmount,
      createdAt: now
    });
    
    const subtractDetailId = 'bd_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000);
    db.insertRow('billingDetails', {
      id: subtractDetailId,
      billingId: origBilling.id,
      contractAssetId: undefined,
      assetId: undefined,
      itemName: '청구 분할 차감',
      quantity: 1,
      unitPrice: -splitAmount,
      amount: -splitAmount,
      createdAt: now
    });

    db.updateRow('billings', origBilling.id, {
      totalAmount: origBilling.totalAmount - splitAmount,
      updatedAt: now
    });
    
    await db.awaitPendingWrites();
    refreshAllData();
  };`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully fixed AppContext.tsx');
} else {
  console.log('Regex not matched');
}
