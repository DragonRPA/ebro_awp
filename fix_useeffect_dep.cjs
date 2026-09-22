const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\/ 청구 귀속월 변경 시 정산 시작일\/종료일 자동 재계산 연동[\s\S]*?}, \[wizardBillingYm, selectedContractForWizard\]\);/m;

const newCode = `  // 청구 귀속월 변경 시 정산 시작일/종료일 자동 재계산 연동
  useEffect(() => {
    if (!selectedContractIdForWizard || !wizardBillingYm) return;
    const c = contracts.find(x => x.id === selectedContractIdForWizard);
    if (!c) return;
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
  }, [wizardBillingYm, selectedContractIdForWizard, contracts]);`;

if (content.match(regex)) {
  content = content.replace(regex, newCode);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed useEffect dependency order');
} else {
  console.log('Could not find regex');
}
