const fs = require('fs');
const path = require('path');

const file = path.join('D:', '01.AntiGravity', 'Giyuen_Lift', 'src', 'data', 'allMenuManuals.ts');
let content = fs.readFileSync(file, 'utf8');

// replace version
content = content.replace(
  /menuId: 'vendors',\s*version: 4,/,
  "menuId: 'vendors',\n    version: 5,"
);

// We need to replace the annotations array for vendors exactly.
const newAnnotations = `annotations: [
      {
        seq: 1,
        selector: '[data-mid="vendors-scope-filter"]',
        type: 'stamp',
        label: '매입처 분류 스코프',
        description: '부품사, 정비공장, 유류사, 운송사별로 매입처를 스코핑합니다.',
        badgeColor: '#1D4ED8',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 2,
        selector: '[data-mid="vendors-pipeline-sync"]',
        type: 'click_ripple',
        label: '누적거래액 동기화',
        description: '당사 자산 취득 및 매입정산 대장을 전수 스캔하여 거래개시일 및 누적거래액을 일괄 동기화합니다.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: true,
      },
      {
        seq: 3,
        selector: '[data-mid="vendors-pipeline-batch"]',
        type: 'callout',
        label: '폴더 일괄 등록',
        description: '사업자등록증 폴더를 지정하여 내부 모든 파일 일괄 등록 및 보완합니다.',
        badgeColor: '#D97706',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 4,
        selector: '[data-mid="vendors-pipeline-audit"]',
        type: 'highlight',
        label: '국세청 휴폐업 점검',
        description: '국세청 홈택스 사업자 휴폐업 상태 전수 점검을 수행합니다.',
        badgeColor: '#7C3AED',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 5,
        selector: '[data-mid="vendors-pipeline-add"]',
        type: 'stamp',
        label: '신규 매입처 등록',
        description: '신규 공급자 및 외주처를 등록하기 위해 진입합니다.',
        badgeColor: '#2563EB',
        positionHint: 'top',
        spotlight: false,
      },
      {
        seq: 6,
        selector: '[data-mid="vendors-inspection-stats"]',
        type: 'stamp',
        label: '매입처 현황 통계',
        description: '총 매입 협력처, 전사 매입 누적거래액 등 핵심 지표를 확인합니다.',
        badgeColor: '#4F46E5',
        positionHint: 'bottom',
        spotlight: false,
      },
      {
        seq: 7,
        selector: '[data-mid="vendors-inspection-grid"]',
        type: 'click_ripple',
        label: '매입처 목록 그리드',
        description: '전체 매입처 목록과 매입 누적거래액, 통장사본 등 관련 서류를 확인하고 대사합니다.',
        badgeColor: '#10B981',
        positionHint: 'top',
        spotlight: true,
      }
    ]`;

const regex = /menuId: 'vendors',[\s\S]*?annotations: \[[\s\S]*?\}\s*\]\s*\n\s*\}/;
const match = content.match(regex);
if (match) {
  const block = match[0];
  const updatedBlock = block.replace(/annotations: \[\s*\{[\s\S]*\}\s*\]/, newAnnotations);
  content = content.replace(block, updatedBlock);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Vendors manuals updated');
} else {
  console.log('Could not find vendors block');
}
