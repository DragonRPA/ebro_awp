const fs = require('fs');
let lines = fs.readFileSync('src/pages/Contracts.tsx', 'utf8').split('\n');

// 체결 자산 td block: lines 1827-1836 (1-based) = index 1826-1835 (0-based)
const assetTdStart = 1826;
const assetTdEnd   = 1835; // inclusive

// 월 렌탈료 td block starts: line 1762 (1-based) = index 1761 (0-based)
const rentalTdInsertBefore = 1761;

// 1. Extract the asset td lines
const assetTdLines = lines.splice(assetTdStart, assetTdEnd - assetTdStart + 1);
console.log('Extracted asset td lines:', assetTdLines.length);
console.log('First:', assetTdLines[0].trim());
console.log('Last:', assetTdLines[assetTdLines.length - 1].trim());

// 2. Insert before rental fee td (index shifted by -(assetTdEnd - assetTdStart + 1) because we removed from a later position)
lines.splice(rentalTdInsertBefore, 0, ...assetTdLines);
console.log('Inserted at index', rentalTdInsertBefore);

// 3. Verify - show lines around rental fee area
console.log('\nVerification - lines around insertion point:');
for (let i = rentalTdInsertBefore - 1; i < rentalTdInsertBefore + assetTdLines.length + 3; i++) {
  console.log(i + 1, lines[i].trim());
}

fs.writeFileSync('src/pages/Contracts.tsx', lines.join('\n'));
console.log('\nDone!');
