const fs = require('fs');
const path = require('path');

const file = path.join('D:', '01.AntiGravity', 'Giyuen_Lift', 'src', 'pages', 'Vendors.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<div style=\{\{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '10px' \}\}>/g,
  '<div data-subview="vendors" data-subview-title="매입처 관리" style={{ display: \'flex\', flexDirection: \'column\', height: \'100%\', minHeight: 0, gap: \'10px\' }}>'
);

content = content.replace(
  /<button\s+className="btn-secondary"\s+onClick=\{handleSyncMetrics\}/g,
  '<button data-mid="vendors-pipeline-sync" className="btn-secondary" onClick={handleSyncMetrics}'
);

content = content.replace(
  /<button\s+className="btn-secondary"\s+onClick=\{\(\) => setShowBatchLicenseModal\(true\)\}/g,
  '<button data-mid="vendors-pipeline-batch" className="btn-secondary" onClick={() => setShowBatchLicenseModal(true)}'
);

content = content.replace(
  /<button\s+className="btn-secondary"\s+onClick=\{\(\) => setShowNtsAuditModal\(true\)\}/g,
  '<button data-mid="vendors-pipeline-audit" className="btn-secondary" onClick={() => setShowNtsAuditModal(true)}'
);

content = content.replace(
  /<button className="btn-primary" onClick=\{handleOpenAddModal\}/g,
  '<button data-mid="vendors-pipeline-add" className="btn-primary" onClick={handleOpenAddModal}'
);

content = content.replace(
  /<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(160px, 1fr\)\)', gap: '10px', marginBottom: 0, flexShrink: 0 \}\}>/g,
  '<div data-mid="vendors-inspection-stats" style={{ display: \'grid\', gridTemplateColumns: \'repeat(auto-fit, minmax(160px, 1fr))\', gap: \'10px\', marginBottom: 0, flexShrink: 0 }}>'
);

content = content.replace(
  /\{\/\* 검색 및 필터 패널 \(3\.4 상하 스택 레이아웃 표준 준수\) \*\/\}\s*<div className="card" style=\{\{ padding: '12px 14px', flexShrink: 0 \}\}>/g,
  '{/* 검색 및 필터 패널 (3.4 상하 스택 레이아웃 표준 준수) */}\n      <div data-mid="vendors-scope-filter" className="card" style={{ padding: \'12px 14px\', flexShrink: 0 }}>'
);

content = content.replace(
  /\{\/\* 매입처 목록 테이블 \*\/\}\s*<div className="card" style=\{\{ padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' \}\}>/g,
  '{/* 매입처 목록 테이블 */}\n      <div data-mid="vendors-inspection-grid" className="card" style={{ padding: 0, flex: 1, minHeight: 0, display: \'flex\', flexDirection: \'column\' }}>'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Vendors updated');
