const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Billings.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `    const targetBillingDate = wizardSearchEndDate <= todayStr ? wizardSearchEndDate : todayStr;
    const hasExcluded = contractsWithReceivables.length > 0;
    const confirmMessage = hasExcluded
      ? \`현재 조회된 정산 대상 계약 총 \${filteredWizardContracts.length}건 중,\\n\\n\` +
        \`▶ 일괄 생성 대상: \${contractsWithoutReceivables.length}건 (외상미수금 없음)\\n\` +
        \`⚠️ 일괄 생성 제외: \${contractsWithReceivables.length}건 (외상미수금 존재 - 수동 검토 필요)\\n\\n\` +
        \`외상미수금이 없는 \${contractsWithoutReceivables.length}건에 대해 청구를 일괄 생성하시겠습니까?\\n\` +
        \`(제외된 \${contractsWithReceivables.length}건은 해당 건을 직접 카드를 클릭하여 외상미수금을 선택 후 생성하실 수 있습니다.)\`
      : \`현재 조회된 정산 대상 계약 총 \${contractsWithoutReceivables.length}건에 대해 청구를 일괄 생성하시겠습니까?\\n\\n\` +
        \`- 청구일자: \${targetBillingDate}\\n\` +
        \`- 청구귀속월: \${targetYm}\\n\\n\` +
        \`생성된 청구서는 [청구 및 수납내역] 탭에서 확인 및 출력하실 수 있습니다.\`;

    if (!window.confirm(confirmMessage)) return;`;

const replaceStr = `    const targetBillingDate = wizardSearchEndDate <= todayStr ? wizardSearchEndDate : todayStr;
    
    // 1. 귀속월 강제 프롬프트
    const userYm = window.prompt(
      '일괄 청구를 생성할 "청구 귀속월"을 입력해주세요.\\n(형식: YYYY-MM)\\n\\n※ 입력하신 월을 기준으로 각 계약별 정산 기간(시작/종료일)이 자동 산정됩니다.',
      targetYm
    );
    if (!userYm) return;
    if (!/^\\d{4}-\\d{2}$/.test(userYm)) {
      showErrorModal('YYYY-MM 형식으로 정확히 입력해주세요. (예: 2026-09)', '형식 오류');
      return;
    }
    const finalTargetYm = userYm;

    // 2. 최종 확인
    const hasExcluded = contractsWithReceivables.length > 0;
    const confirmMessage = hasExcluded
      ? \`현재 조회된 정산 대상 계약 총 \${filteredWizardContracts.length}건 중,\\n\\n\` +
        \`▶ 일괄 생성 대상: \${contractsWithoutReceivables.length}건 (외상미수금 없음)\\n\` +
        \`⚠️ 일괄 생성 제외: \${contractsWithReceivables.length}건 (외상미수금 존재 - 수동 검토 필요)\\n\\n\` +
        \`[청구 귀속월: \${finalTargetYm}]\\n\` +
        \`외상미수금이 없는 \${contractsWithoutReceivables.length}건에 대해 청구를 일괄 생성하시겠습니까?\\n\` +
        \`(제외된 \${contractsWithReceivables.length}건은 수동 생성 필요)\`
      : \`현재 조회된 정산 대상 계약 총 \${contractsWithoutReceivables.length}건에 대해 청구를 일괄 생성하시겠습니까?\\n\\n\` +
        \`- 청구일자: \${targetBillingDate}\\n\` +
        \`- 청구귀속월: \${finalTargetYm}\\n\\n\` +
        \`생성된 청구서는 [청구 및 수납내역] 탭에서 확인하실 수 있습니다.\`;

    if (!window.confirm(confirmMessage)) return;`;

// Using regex to match regardless of exact whitespace/Korean encoding
const regex = /const targetBillingDate = wizardSearchEndDate <= todayStr \? wizardSearchEndDate : todayStr;[\s\S]*?if \(!window\.confirm\(confirmMessage\)\) return;/m;

if (content.match(regex)) {
  content = content.replace(regex, replaceStr);
  
  // Update targetYm usage inside the loop
  content = content.replace(
    /await generateBillingForSingleContract\(c\.id, targetYm, targetBillingDate\);/g,
    'await generateBillingForSingleContract(c.id, finalTargetYm, targetBillingDate);'
  );

  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed handleBulkGenerateWizard');
} else {
  console.log('Target block not found');
}
