const fs = require('fs');
const path = 'src/pages/Receivables.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `<div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>`,
  `<div data-subview="receivable" data-subview-title="외상미수금 대장" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>`
);

content = content.replace(
  `<div className="card" style={{ margin: 0, padding: '10px 14px' }}>`,
  `<div data-mid="receivable-scope" className="card" style={{ margin: 0, padding: '10px 14px' }}>`
);

content = content.replace(
  `<button className="btn-secondary" onClick={handleExportExcel}`,
  `<button data-mid="receivable-pipeline-excel" className="btn-secondary" onClick={handleExportExcel}`
);

content = content.replace(
  `<button className="btn-primary" onClick={() => setShowAddModal(true)}`,
  `<button data-mid="receivable-pipeline-add" className="btn-primary" onClick={() => setShowAddModal(true)}`
);

content = content.replace(
  `<div className="card" style={{ padding: 0, margin: 0, overflow: 'hidden', flex: 1 }}>`,
  `<div data-mid="receivable-inspection-grid" className="card" style={{ padding: 0, margin: 0, overflow: 'hidden', flex: 1 }}>`
);

content = content.replace(
  `onClick={() => handleStandaloneIssue(r.id)}`,
  `data-mid="receivable-inspection-issue" onClick={() => handleStandaloneIssue(r.id)}`
);

const auditSearch = `{/* 헌장 3.5 대차대조 검증 및 우하단 종결 액션 바 */}
      <div style={{`;
const auditReplace = `{/* 헌장 3.5 대차대조 검증 및 우하단 종결 액션 바 */}
      <div data-mid="receivable-terminal-audit" style={{`;

if (content.includes(auditSearch)) {
  content = content.replace(auditSearch, auditReplace);
} else {
  console.log("Could not find the exact audit block, attempting fallback.");
  content = content.replace(
    `      <div style={{
        padding: '12px 16px',
        backgroundColor: 'var(--bg-card)',`,
    `      <div data-mid="receivable-terminal-audit" style={{
        padding: '12px 16px',
        backgroundColor: 'var(--bg-card)',`
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done patching Receivables.tsx!');
