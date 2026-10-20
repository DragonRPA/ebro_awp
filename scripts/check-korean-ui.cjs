/**
 * 전사 UI 한국어 전용 표기 및 괄호 영문(한국어(English)) 영구 금지 정적 검증 스크립트 (헌장 3.7)
 * 실행: node scripts/check-korean-ui.cjs
 */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'dist', 'tests'].includes(entry.name)) {
        results = results.concat(walk(full));
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const parenEngRegex = /([가-힣][가-힣 \t/·ㆍ,0-9]{0,20}?)[ \t]*\(([A-Za-z][A-Za-z0-9_\- \t/.,&+:]{0,35})\)/g;
const bannedPhrases = [
  'ERP DISPATCH ORDER',
  'RECEIPT OF PAYMENT',
  'SYSTEM EXCEPTION LOG',
  'ASAP (최우선)',
  '[ASAP]',
  '교체(대차)',
  '대차(교체)',
  '보양 없음(NONE)',
  '보양 없음 (NONE)',
];

const files = walk(path.join(__dirname, '..', 'src'));
const violations = [];

for (const file of files) {
  const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('{/*')) {
      return;
    }

    for (const phrase of bannedPhrases) {
      if (line.includes(phrase)) {
        violations.push(`${rel}:${idx + 1} [금지 표현] "${phrase}"`);
      }
    }

    parenEngRegex.lastIndex = 0;
    let m;
    while ((m = parenEngRegex.exec(line)) !== null) {
      violations.push(`${rel}:${idx + 1} [괄호 영문 병기] "${m[0].trim()}"`);
    }
  });
}

if (violations.length > 0) {
  console.error(`❌ [헌장 3.7 위반] 한국어 UI 영문/괄호영문 표기 위반 ${violations.length}건 적발:`);
  violations.slice(0, 50).forEach(v => console.error('  -', v));
  if (violations.length > 50) {
    console.error(`  ... 외 ${violations.length - 50}건`);
  }
  process.exit(1);
} else {
  console.log(`✅ [헌장 3.7 통과] 검사 파일 ${files.length}개 내 괄호 영문 및 금지 영문 표기 0건 확인 완료.`);
  process.exit(0);
}
