const fs = require('fs');
let content = fs.readFileSync('D:/01.AntiGravity/Giyuen_Lift/src/pages/CashFlowPage.tsx', 'utf8');

// Subview
content = content.replace(
  /<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '1080px', paddingBottom: '60px' \}\}>/,
  `<div data-subview="cash_flow" data-subview-title="자금 흐름 분석" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '1080px', paddingBottom: '60px' }}>`
);

// Scope
content = content.replace(
  /\{\/\* 필터 1: 기준일 \*\/\}\s*<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '4px' \}\}>/g,
  `{/* 필터 1: 기준일 */}\n                <div data-mid="cash_flow-scope" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>`
);

// Pipeline Sync
content = content.replace(
  /onClick=\{async \(\) => \{\s*refreshAllData\(\);\s*showToast\('전사 실데이터 동기화가 완료되었습니다.'\);\s*\}\}/g,
  `data-mid="cash_flow-pipeline-sync"\n                  onClick={async () => {\n                    refreshAllData();\n                    showToast('전사 실데이터 동기화가 완료되었습니다.');\n                  }}`
);

// Pipeline Snapshot
content = content.replace(
  /onClick=\{\(\) => setShowSnapModal\(true\)\}/g,
  `data-mid="cash_flow-pipeline-snapshot"\n                    onClick={() => setShowSnapModal(true)}`
);

// Pipeline Export
content = content.replace(
  /onClick=\{handleExportCashFlowExcel\}/g,
  `data-mid="cash_flow-pipeline-export"\n                  onClick={handleExportCashFlowExcel}`
);

// We need inspection grid/charts
// Let's add them to the summary section
content = content.replace(
  /\{\/\* ─── 3. 대차대조식 검증 요약 ─── \*\/\}\s*<div style=\{\{/,
  `{/* ─── 3. 대차대조식 검증 요약 ─── */}\n          <div data-mid="cash_flow-inspection-summary" style={{`
);
content = content.replace(
  /\{\/\* ─── 대차대조식 검증 요약 \(종단 보존 법칙 차액 ₩0 무결성\) ─── \*\/\}\s*<div style=\{\{/,
  `{/* ─── 대차대조식 검증 요약 (종단 보존 법칙 차액 ₩0 무결성) ─── */}\n          <div data-mid="cash_flow-inspection-summary" style={{`
);

// SVG Chart
content = content.replace(
  /\{\/\* ─── 4. 슬림 SVG 유동성 밴드 차트 ─── \*\/\}\s*<div style=\{\{/,
  `{/* ─── 4. 슬림 SVG 유동성 밴드 차트 ─── */}\n          <div data-mid="cash_flow-inspection-chart" style={{`
);

// Grid
content = content.replace(
  /\{\/\* ─── 5. 일별 유동성 전망 그리드 ─── \*\/\}\s*<div style=\{\{/,
  `{/* ─── 5. 일별 유동성 전망 그리드 ─── */}\n          <div data-mid="cash_flow-inspection-grid" style={{`
);

// Audit History tab
content = content.replace(
  /\{activeSubTab === 'HISTORY' && \(\s*<div/,
  `{activeSubTab === 'HISTORY' && (\n        <div data-mid="cash_flow-audit-history"`
);


fs.writeFileSync('D:/01.AntiGravity/Giyuen_Lift/src/pages/CashFlowPage.tsx', content);
