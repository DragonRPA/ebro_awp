const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldEffectCode = `
  // 청구 귀속월 변경 시 정산 시작일/종료일 자동 재계산 연동
  useEffect(() => {
    if (!selectedContractForWizard || !wizardBillingYm) return;
    const c = selectedContractForWizard;
    const [targetY, targetM] = wizardBillingYm.split('-').map(Number);
    const firstOfM = new Date(targetY, targetM - 1, 1);
    const lastOfM = new Date(targetY, targetM, 0);
    
    const startStr = firstOfM.toISOString().split('T')[0];
    const endStr = lastOfM.toISOString().split('T')[0];
    
    let calcStart = startStr;
    if (c.lastBilledPeriodEnd) {
      const prevEndObj = new Date(c.lastBilledPeriodEnd);
      prevEndObj.setDate(prevEndObj.getDate() + 1);
      calcStart = prevEndObj.toISOString().split('T')[0];
    } else if (c.startDate > startStr) {
      calcStart = c.startDate;
    }

    const normalEnd = c.endDate && c.endDate !== '없음' ? c.endDate : '2099-12-31';
    let calcEnd = normalEnd < endStr ? normalEnd : endStr;

    if (calcStart > calcEnd) {
      calcEnd = normalEnd < endStr ? normalEnd : endStr;
      if (calcStart > calcEnd) {
        calcEnd = calcStart;
      }
    }
    
    setWizardStartDate(calcStart);
    setWizardEndDate(calcEnd);
  }, [wizardBillingYm, selectedContractForWizard]);
`;

const newEffectCode = `
  // 청구 귀속월 변경 시 정산 시작일/종료일 자동 재계산 연동
  useEffect(() => {
    if (!selectedContractForWizard || !wizardBillingYm) return;
    const c = selectedContractForWizard;
    const [targetY, targetM] = wizardBillingYm.split('-').map(Number);
    const firstOfM = new Date(targetY, targetM - 1, 1);
    const lastOfM = new Date(targetY, targetM, 0);
    
    const startStr = firstOfM.toISOString().split('T')[0];
    const endStr = lastOfM.toISOString().split('T')[0];
    
    let calcStart = startStr;
    if (c.lastBilledPeriodEnd) {
      const prevEndObj = new Date(c.lastBilledPeriodEnd);
      prevEndObj.setDate(prevEndObj.getDate() + 1);
      calcStart = prevEndObj.toISOString().split('T')[0];
    } else if (c.startDate > startStr) {
      calcStart = c.startDate;
    }

    const normalEnd = normalizeEndDate(c.endDate);
    let calcEnd = normalEnd < endStr ? normalEnd : endStr;

    if (calcStart > calcEnd) {
      calcEnd = normalEnd < endStr ? normalEnd : endStr;
      if (calcStart > calcEnd) {
        calcEnd = calcStart;
      }
    }
    
    setWizardStartDate(calcStart);
    setWizardEndDate(calcEnd);
  }, [wizardBillingYm, selectedContractForWizard]);
`;

if (content.includes(oldEffectCode)) {
  content = content.replace(oldEffectCode, newEffectCode);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed useEffect to use normalizeEndDate');
} else {
  console.log('Could not find old effect code');
}
