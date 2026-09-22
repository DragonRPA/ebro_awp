const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/context/AppContext.tsx';
let content = fs.readFileSync(path, 'utf8');

const interfaceTargetRegex = /(regenerateBilling:\s*\([^)]*\)\s*=>\s*Promise<string>;)/;
const interfaceMatch = content.match(interfaceTargetRegex);

if (interfaceMatch) {
  content = content.replace(interfaceTargetRegex, `$1\n  splitBillingAbsoluteAmount: (billingId: string, splitAmount: number) => Promise<void>;`);
  console.log('Added to Context interface');
} else {
  console.log('Context interface target not found');
}

const implTargetRegex = /(const regenerateBilling =\s*async\s*\([^)]*\): Promise<string> => \{[\s\S]*?\n  \};)/;
const implMatch = content.match(implTargetRegex);

if (implMatch) {
  const newImpl = `
  const splitBillingAbsoluteAmount = async (billingId: string, splitAmount: number): Promise<void> => {
    const origBilling = db.billings.find(b => b.id === billingId);
    if (!origBilling) throw new Error("원본 청구를 찾을 수 없습니다.");
    if (origBilling.status === 'PAID') throw new Error("이미 수납이 완료된 청구서는 분할할 수 없습니다.");
    if (splitAmount <= 0 || splitAmount >= origBilling.totalAmount) throw new Error("분할 금액이 유효하지 않습니다.");
    
    // Create negative detail for original billing
    const subtractDetailId = 'bd_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000);
    const subtractDetail = {
      id: subtractDetailId,
      billingId: origBilling.id,
      itemName: '청구 분할 차감',
      quantity: 1,
      unitPrice: -splitAmount,
      amount: -splitAmount,
      createdAt: new Date().toISOString()
    };
    
    // Create new child billing
    const childBillingId = 'b_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000);
    const childBilling = {
      ...origBilling,
      id: childBillingId,
      parentBillingId: origBilling.id,
      totalAmount: splitAmount,
      paidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      details: []
    };
    
    // Create positive detail for child billing
    const childDetailId = 'bd_' + Date.now().toString() + '_' + Math.floor(Math.random()*1000) + 'c';
    const childDetail = {
      id: childDetailId,
      billingId: childBillingId,
      itemName: '금액 분할 청구건',
      quantity: 1,
      unitPrice: splitAmount,
      amount: splitAmount,
      createdAt: new Date().toISOString()
    };
    childBilling.details.push(childDetail);
    
    // Mutate DB (In a real app, this should be a transaction via API)
    origBilling.totalAmount -= splitAmount;
    if (!origBilling.details) origBilling.details = [];
    origBilling.details.push(subtractDetail);
    
    db.billings.push(childBilling);
    db.billingDetails.push(subtractDetail, childDetail);
    
    await saveDb(db);
  };
`;
  content = content.replace(implTargetRegex, `$1\n${newImpl}`);
  console.log('Added to Context implementation');
} else {
  console.log('Context implementation target not found');
}

const exportRegex = /(regenerateBilling,\s*approveBilling)/;
const exportMatch = content.match(exportRegex);
if(exportMatch) {
  content = content.replace(exportRegex, 'splitBillingAbsoluteAmount, regenerateBilling, approveBilling');
  console.log('Added to exports');
} else {
  // try another
  const exportRegex2 = /(regenerateBilling,\s*)/;
  content = content.replace(exportRegex2, '$1 splitBillingAbsoluteAmount, ');
  console.log('Added to exports (fallback)');
}

fs.writeFileSync(path, content, 'utf8');
