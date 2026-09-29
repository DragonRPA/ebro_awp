const fs = require('fs');
let c = fs.readFileSync('src/pages/Contracts.tsx', 'utf8');

// Find the thead section and move 체결 자산 th before 월 렌탈료 th
// Current order: ...출고 진행 현황 | 월 렌탈료 | ... | 상태 | 체결 자산
// Target order:  ...출고 진행 현황 | 체결 자산 | 월 렌탈료 | ... | 상태

const lines = c.split('\n');

// Find line numbers (0-based)
let rentalFeeThLine = -1;
let assetThLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("handleSort('rentalFee')") && lines[i].includes('월 렌탈료')) {
    rentalFeeThLine = i;
  }
  if (lines[i].includes("handleSort('assets')") && lines[i].includes('체결 자산')) {
    assetThLine = i;
  }
}

console.log('rentalFeeThLine:', rentalFeeThLine + 1);
console.log('assetThLine:', assetThLine + 1);

if (rentalFeeThLine !== -1 && assetThLine !== -1 && assetThLine > rentalFeeThLine) {
  // Extract the 체결 자산 th line
  const assetThContent = lines[assetThLine];
  // Remove it from current position
  lines.splice(assetThLine, 1);
  // Insert before 월 렌탈료 (index has shifted by -1)
  lines.splice(rentalFeeThLine, 0, assetThContent);
  console.log('Header swap done');
} else {
  console.log('Could not find lines or already in correct order');
}

// -------------------------
// Now do the same for tbody <td> cells
// Current order (in each row): 출고현황td | 월렌탈료td | ... | 상태td | 체결자산td (last)
// Target order: 출고현황td | 체결자산td | 월렌탈료td | ... | 상태td

// The 체결 자산 td block spans multiple lines.
// It contains: modelSummaryText, onClick=setShowAssetsDetailModalContractId
// It's the last <td> before </tr> in each row.

// Strategy: use a regex to find the block and move it
// The asset td block:
const assetTdPattern = /(\s*<td style=\{\{ whiteSpace: 'nowrap' \}\}>\s*\n\s*<div\s*\n\s*style=\{\{ display: 'inline-flex'[^]*?setShowAssetsDetailModalContractId[^]*?<\/div>\s*\n\s*<\/td>\s*\n)(\s*<\/tr>\s*\n)/g;

// The rental fee td block (simpler, starts with <td style={{ whiteSpace: 'nowrap' }}> containing totalFee or c.contractType === 'SALE')
const rentalTdPattern = /(<td style=\{\{ whiteSpace: 'nowrap' \}\}>\s*\n\s*\{c\.contractType === 'SALE'[^]*?<\/td>\s*\n)/;

// Rather than complex regex, let's find specific marker text
const result = c.split('\n');
let rentalTdStart = -1;
let assetTdStart = -1;
let assetTdEnd = -1;

for (let i = 0; i < result.length; i++) {
  if (result[i].includes("c.contractType === 'SALE'") && result[i].includes("매각가")) {
    // Walk back to find the opening <td
    for (let j = i; j >= Math.max(0, i - 5); j--) {
      if (result[j].includes('<td') && result[j].includes('nowrap')) {
        rentalTdStart = j;
        break;
      }
    }
  }
  if (result[i].includes('setShowAssetsDetailModalContractId') && result[i].includes('체결자산 상세')) {
    // Walk back to find opening <td
    for (let j = i; j >= Math.max(0, i - 5); j--) {
      if (result[j].includes('<td') && result[j].includes('nowrap')) {
        assetTdStart = j;
        break;
      }
    }
    // Walk forward to find closing </td>
    for (let j = i; j < Math.min(result.length, i + 10); j++) {
      if (result[j].includes('</td>')) {
        assetTdEnd = j;
        break;
      }
    }
  }
}

console.log('rentalTdStart:', rentalTdStart + 1);
console.log('assetTdStart:', assetTdStart + 1, 'assetTdEnd:', assetTdEnd + 1);

if (rentalTdStart !== -1 && assetTdStart !== -1 && assetTdEnd !== -1 && assetTdStart > rentalTdStart) {
  // Extract asset td lines
  const assetTdLines = result.splice(assetTdStart, assetTdEnd - assetTdStart + 1);
  // Insert before rental td (index has shifted by -(assetTdEnd - assetTdStart + 1))
  const insertAt = rentalTdStart;
  result.splice(insertAt, 0, ...assetTdLines);
  console.log('Body td swap done, moved', assetTdLines.length, 'lines');
} else {
  console.log('Could not find td lines or already correct');
}

fs.writeFileSync('src/pages/Contracts.tsx', result.join('\n'));
console.log('Done');
