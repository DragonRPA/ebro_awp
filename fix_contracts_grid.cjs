const fs = require('fs');

let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

// 1. Move 체결 자산 th before 월 렌탈료 th
const oldThead = `                    <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>출고 진행 현황</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('rentalFee')}>월 렌탈료{sortConfig?.key === 'rentalFee' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    {showPeriodCol && <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('period')}>계약 기간{sortConfig?.key === 'period' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>}
                    {showLastBilledCol && <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('billingPeriod')}>최근 청구 기간{sortConfig?.key === 'billingPeriod' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>}
                    {showBillingCountCol && <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('billingCount')}>청구 건수{sortConfig?.key === 'billingCount' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>}
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('dday')}>만료 D-Day{sortConfig?.key === 'dday' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('billingDay')}>청구 마감일{sortConfig?.key === 'billingDay' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('salesperson')}>영업담당{sortConfig?.key === 'salesperson' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('status')}>상태{sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('assets')}>체결 자산{sortConfig?.key === 'assets' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>`;

const newThead = `                    <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>출고 진행 현황</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('assets')}>체결 자산{sortConfig?.key === 'assets' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('rentalFee')}>월 렌탈료{sortConfig?.key === 'rentalFee' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    {showPeriodCol && <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('period')}>계약 기간{sortConfig?.key === 'period' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>}
                    {showLastBilledCol && <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('billingPeriod')}>최근 청구 기간{sortConfig?.key === 'billingPeriod' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>}
                    {showBillingCountCol && <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('billingCount')}>청구 건수{sortConfig?.key === 'billingCount' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>}
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('dday')}>만료 D-Day{sortConfig?.key === 'dday' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('billingDay')}>청구 마감일{sortConfig?.key === 'billingDay' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('salesperson')}>영업담당{sortConfig?.key === 'salesperson' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                    <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('status')}>상태{sortConfig?.key === 'status' ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''}</th>`;

if (c.includes(oldThead)) {
  c = c.replace(oldThead, newThead);
  console.log('Successfully reordered thead th elements!');
} else {
  // Let's do line-based replace to avoid whitespace mismatch
  const lines = c.split(/\r?\n/);
  let feeIdx = -1;
  let assetIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("handleSort('rentalFee')") && lines[i].includes('월 렌탈료')) feeIdx = i;
    if (lines[i].includes("handleSort('assets')") && lines[i].includes('체결 자산') && i < 1700) assetIdx = i;
  }
  console.log('feeIdx:', feeIdx, 'assetIdx:', assetIdx);
  if (feeIdx !== -1 && assetIdx !== -1 && assetIdx > feeIdx) {
    const assetLine = lines[assetIdx];
    lines.splice(assetIdx, 1);
    lines.splice(feeIdx, 0, assetLine);
    c = lines.join('\n');
    console.log('Reordered thead via line search!');
  }
}

// 2. Add maxHeight, overflowY: 'auto' and sticky header to the grid container in Contracts.tsx
const oldContainer = `<div className="card" style={{ padding: 0, margin: 0, overflowX: 'auto' }}>
            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead>`;

const newContainer = `<div className="card" style={{ padding: 0, margin: 0, overflow: 'hidden' }}>
            <div className="table-container" style={{ maxHeight: 'calc(100vh - 410px)', minHeight: '380px', overflowY: 'auto', overflowX: 'auto', position: 'relative' }}>
              <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-app)' }}>`;

if (c.includes(oldContainer)) {
  c = c.replace(oldContainer, newContainer);
  console.log('Successfully updated grid container scroll and sticky thead!');
} else {
  console.log('oldContainer string not found directly, checking parts...');
  c = c.replace(
    `<div className="table-container" style={{ overflowX: 'auto' }}>`,
    `<div className="table-container" style={{ maxHeight: 'calc(100vh - 410px)', minHeight: '380px', overflowY: 'auto', overflowX: 'auto', position: 'relative' }}>`
  );
  c = c.replace(
    `<thead>\n                  <tr style={{ backgroundColor: 'var(--bg-app)', whiteSpace: 'nowrap' }}>`,
    `<thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-app)' }}>\n                  <tr style={{ backgroundColor: 'var(--bg-app)', whiteSpace: 'nowrap' }}>`
  );
}

fs.writeFileSync('src/pages/Contracts.tsx', c);
console.log('Saved Contracts.tsx');
