// scripts/scan_redundant_buttons_and_texts.cjs
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'src', 'pages');

function getAllTsxFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTsxFiles(fullPath));
    } else if (file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const pageFiles = getAllTsxFiles(pagesDir);
const auditResults = [];

pageFiles.forEach(filePath => {
  const relPath = path.relative(pagesDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  const issues = [];

  // --- 1. Audit Header and Redundant Title Echoes ---
  // Find h2 page title: e.g. <h2 ...> ... Title ... </h2>
  const h2Match = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  let mainTitle = '';
  let headerIndex = -1;
  if (h2Match) {
    mainTitle = h2Match[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
    headerIndex = h2Match.index + h2Match[0].length;
  }

  if (mainTitle && mainTitle.length >= 2 && headerIndex !== -1) {
    // Check content AFTER header for exact title repeats in h1, h2, h3, h4, h5 or card-title
    const afterHeader = content.substring(headerIndex);
    
    // Look for heading tags containing the exact title
    const headingRegex = /<(?:h1|h2|h3|h4|h5)[^>]*>([\s\S]*?)<\/(?:h1|h2|h3|h4|h5)>/gi;
    let match;
    const echoingHeadings = [];
    while ((match = headingRegex.exec(afterHeader)) !== null) {
      const headingText = match[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
      if (headingText === mainTitle || headingText === `[${mainTitle}]`) {
        echoingHeadings.push(match[0]);
      }
    }

    if (echoingHeadings.length > 0) {
      issues.push({
        type: 'REDUNDANT_TITLE_ECHO',
        title: mainTitle,
        count: echoingHeadings.length,
        samples: echoingHeadings
      });
    }
  }

  // --- 2. Audit Duplicate Buttons with Identical Handlers or Ambiguous Clones ---
  // Extract all button tags
  const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  const buttons = [];
  let bMatch;
  while ((bMatch = buttonRegex.exec(content)) !== null) {
    const attrs = bMatch[1];
    const body = bMatch[2];
    const onClickMatch = attrs.match(/onClick=\{([^}]+)\}/);
    const label = body.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
    const onClick = onClickMatch ? onClickMatch[1].trim() : '';
    buttons.push({
      full: bMatch[0],
      attrs,
      label,
      onClick
    });
  }

  // (a) Exact duplicate onClick handlers for global actions (e.g. refreshAllData)
  const refreshCalls = buttons.filter(b => /refreshAllData|scanLocalAgent\(true\)/.test(b.onClick));
  if (refreshCalls.length > 1) {
    issues.push({
      type: 'DUPLICATE_REFRESH_HANDLER',
      count: refreshCalls.length,
      detail: refreshCalls.map(b => `[label: "${b.label}", onClick: "${b.onClick}"]`).join(', ')
    });
  }

  // (b) Identical ambiguous "엑셀 내보내기" buttons within the same file
  const excelExportBtns = buttons.filter(b => b.label === '엑셀 내보내기' || b.label === '엑셀 다운로드');
  if (excelExportBtns.length > 1) {
    issues.push({
      type: 'AMBIGUOUS_DUPLICATE_EXCEL_LABEL',
      count: excelExportBtns.length,
      detail: excelExportBtns.map(b => `[label: "${b.label}", onClick: "${b.onClick.substring(0, 35)}"]`).join(', ')
    });
  }

  // (c) Check for identical descriptive sentences repeated verbatim in multiple places
  const descParagraphs = content.match(/<(?:p|span)[^>]*>([^<]{20,})<\/(?:p|span)>/g) || [];
  const descTexts = descParagraphs.map(p => p.replace(/<[^>]+>/g, '').trim());
  const descCounts = {};
  descTexts.forEach(t => {
    descCounts[t] = (descCounts[t] || 0) + 1;
  });
  const repeatedTexts = [];
  Object.entries(descCounts).forEach(([text, cnt]) => {
    if (cnt > 1 && !text.includes('{') && !text.includes('데이터가 없습니다') && !text.includes('등록된') && !text.includes('선택')) {
      repeatedTexts.push({ text: text.substring(0, 45), count: cnt });
    }
  });

  if (repeatedTexts.length > 0) {
    issues.push({
      type: 'DUPLICATE_DESCRIPTION_TEXT',
      items: repeatedTexts
    });
  }

  if (issues.length > 0) {
    auditResults.push({
      file: relPath,
      issues
    });
  }
});

fs.writeFileSync(
  path.join(__dirname, 'refined_redundant_ui_audit.json'),
  JSON.stringify(auditResults, null, 2),
  'utf8'
);

console.log(`\n총 ${pageFiles.length}개 페이지 검사 완료. 조정 대상 파일: ${auditResults.length}개\n`);
auditResults.forEach(r => {
  console.log(`- ${r.file}: ${r.issues.map(i => i.type).join(', ')}`);
});
