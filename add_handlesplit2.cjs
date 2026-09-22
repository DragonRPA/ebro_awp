const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /(const handleCancel = async)/;
const match = content.match(regex);
if (match) {
  const replacement = `const handleSplitSubmit = async () => {
    if (!splitTargetId) return;
    const splitAmount = parseInt(splitAmountInput.replace(/[^0-9]/g, ''), 10);
    if (isNaN(splitAmount) || splitAmount <= 0) {
      showErrorModal('분할할 금액을 정확히 입력해 주세요.', '오류');
      return;
    }
    const origBilling = billings.find(b => b.id === splitTargetId);
    if (!origBilling) return;
    if (splitAmount >= origBilling.totalAmount) {
      showErrorModal('분할 금액은 원본 청구 총액보다 작아야 합니다.', '오류');
      return;
    }

    try {
      await splitBillingAbsoluteAmount(splitTargetId, splitAmount);
      showToast('청구가 성공적으로 분할되었습니다.');
      setSplitModalOpen(false);
      setSplitTargetId(null);
      setSplitAmountInput('');
    } catch (err: any) {
      showErrorModal(err.message || String(err), '분할 실패');
    }
  };

  $1`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Added handleSplitSubmit');
} else {
  console.log('Target not found for handleSplitSubmit');
}
