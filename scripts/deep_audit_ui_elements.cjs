// scripts/deep_audit_ui_elements.cjs
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'src', 'pages');
const scanData = JSON.parse(fs.readFileSync(path.join(__dirname, 'ui_consistency_scan_result.json'), 'utf8'));

console.log('=' .repeat(90));
console.log('DEEP COMPONENT-BY-COMPONENT UI/UX SCAN AUDIT');
console.log('='.repeat(90));

const categorized = {
  missingStandardHeader: [],
  excessiveRootPadding: [],
  tableNoWrapMissing: [],
  formSpacingInconsistent: [],
  cleanAndStandard: []
};

scanData.forEach(item => {
  const filePath = path.join(PAGES_DIR, item.file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Check Root Padding
  // Look for the first return statement and its top-level div's padding
  const returnMatch = content.match(/return\s*\(\s*(<[\s\S]*?>)/);
  let rootPadding = null;
  if (returnMatch) {
    const rootTag = returnMatch[1];
    const padMatch = rootTag.match(/padding:\s*['"]([^'"]+)['"]/);
    if (padMatch) {
      rootPadding = padMatch[1];
    }
  }

  // 2. Check Header
  // A standard header should have h1 or h2 (or h3) with page title and icon
  const hasStandardHeading = /<(?:h1|h2)[^>]*>[\s\S]*?<\/(?:h1|h2)>/i.test(content);
  const headerMatch = content.match(/<(?:h1|h2)[^>]*>([\s\S]*?)<\/(?:h1|h2)>/i);
  const titleText = headerMatch ? headerMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  // 3. Check Table nowrap
  const hasTable = /<table/i.test(content);
  const hasThWithoutNoWrap = hasTable && !/whiteSpace:\s*['"]nowrap['"]|className=["'][^"']*whitespace-nowrap[^"']*["']/.test(content);

  const report = {
    menuId: item.menuId,
    name: item.name,
    file: item.file,
    group: item.group,
    rootPadding,
    titleText,
    hasStandardHeading,
    hasTable,
    hasThWithoutNoWrap
  };

  let hasIssue = false;

  if (!hasStandardHeading || !titleText || titleText.length < 2) {
    categorized.missingStandardHeader.push(report);
    hasIssue = true;
  }

  if (rootPadding && rootPadding !== '0' && rootPadding !== '0px') {
    // If root padding is >= 16px, it creates double padding with main
    if (/([1-9]\dpx|2\dpx|3\dpx|4\dpx)/.test(rootPadding)) {
      categorized.excessiveRootPadding.push(report);
      hasIssue = true;
    }
  }

  if (hasThWithoutNoWrap) {
    categorized.tableNoWrapMissing.push(report);
    hasIssue = true;
  }

  if (!hasIssue) {
    categorized.cleanAndStandard.push(report);
  }
});

console.log(`\n📌 1. 헤더/제목 표시 미비 또는 표준 h1/h2 부재 (${categorized.missingStandardHeader.length}개):`);
categorized.missingStandardHeader.forEach(p => {
  console.log(`  - [${p.group}] ${p.name} (${p.menuId}) in ${p.file}: Title="${p.titleText}"`);
});

console.log(`\n📌 2. 최상위 루트 과도한 여백(Double Padding) 감지 (${categorized.excessiveRootPadding.length}개):`);
categorized.excessiveRootPadding.forEach(p => {
  console.log(`  - [${p.group}] ${p.name} (${p.menuId}) in ${p.file}: rootPadding="${p.rootPadding}"`);
});

console.log(`\n📌 3. 테이블 셀 줄바꿈 방지(nowrap) 누락 의심 (${categorized.tableNoWrapMissing.length}개):`);
categorized.tableNoWrapMissing.forEach(p => {
  console.log(`  - [${p.group}] ${p.name} (${p.menuId}) in ${p.file}`);
});

console.log(`\n✅ 4. 표준에 완벽히 부합하는 균일 페이지 (${categorized.cleanAndStandard.length}개):`);
categorized.cleanAndStandard.forEach(p => {
  console.log(`  - [${p.group}] ${p.name} (${p.menuId})`);
});
