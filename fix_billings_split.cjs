const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetBlock = `    try {
      await splitBillingAbsoluteAmount(splitTargetId, splitAmount);
      showToast('청구가 성공적으로 분할되었습니다.');
      setSplitModalOpen(false);
      setSplitTargetId(null);
      setSplitAmountInput('');
    } catch (err: any) {`;

const replaceBlock = `    try {
      const newBillingId = await splitBillingAbsoluteAmount(splitTargetId, splitAmount);
      if (searchedBillingIds) {
        setSearchedBillingIds([...searchedBillingIds, newBillingId]);
      }
      showToast('청구가 성공적으로 분할되었습니다.');
      setSplitModalOpen(false);
      setSplitTargetId(null);
      setSplitAmountInput('');
    } catch (err: any) {`;

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, replaceBlock);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Billings fixed');
} else {
  console.log('Target block not found in Billings');
}
