const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');

// 5-Color Standards:
// Light Mode:
// 1) Canvas/Bg: #f5f2eb (Paper), Card: #fbf9f5, Sidebar/Header: #ece7de, Border: #dcd5c9, #e8e2d8
// 2) Ink/Text: #0f172a (Deep Slate Ink)
// 3) Action: #1d4ed8 (Cobalt Blue)
// 4) Positive: #047857 (Forest Emerald)
// 5) Negative: #dc2626 (Crimson Red)
//
// Dark Mode:
// 1) Canvas: #0b0f19, Card: #1f2937, Sidebar/Header: #111827, Border: #374151
// 2) Ink: #f1f5f9
// 3) Action: #38bdf8
// 4) Positive: #34d399
// 5) Negative: #f87171

// Suspicious / Non-compliant color patterns (Rainbow/AI Slop):
// Purples: #4f46e5, #6366f1, #7c3aed, #8b5cf6, #a855f7, #c084fc, #818cf8, #3730a3, #1e1b4b
// Pinks: #ec4899, #f43f5e, #e11d48, #be185d, #db2777, #f472b6, #pink
// Oranges: #f97316, #ea580c, #c2410c, #fb923c, #ffedd5
// Cyans/Teals: #06b6d4, #0891b2, #14b8a6, #0d9488, #2dd4bf
// Gradients: linear-gradient(
// Stark white / slate backgrounds: #f8fafc, #f1f5f9, #f3f4f6, #ffffff inside main/cards
const SUSPICIOUS_PATTERNS = [
  { name: 'Purple/Indigo (보라/인디고)', regex: /#(?:4f46e5|6366f1|7c3aed|8b5cf6|a855f7|818cf8|3730a3|6d28d9|9333ea|c084fc|a78bfa)/gi },
  { name: 'Pink/Rose (분홍/로즈)', regex: /#(?:ec4899|f43f5e|e11d48|be185d|db2777|f472b6|fb7185|fda4af)/gi },
  { name: 'Orange/Amber (주황/앰버)', regex: /#(?:f97316|ea580c|c2410c|fb923c|f59e0b|d97706|b45309)/gi },
  { name: 'Cyan/Teal (청록/시안)', regex: /#(?:06b6d4|0891b2|14b8a6|0d9488|2dd4bf|5eead4)/gi },
  { name: 'Decorative Gradient (장식적 그라디언트)', regex: /linear-gradient\([^)]+\)/gi },
  { name: 'Hardcoded Pure White/Stark Gray Bg (단색 하드코딩 배경)', regex: /backgroundColor:\s*['"]#(?:ffffff|fff|f8fafc|f1f5f9|f3f4f6)['"]/gi },
  { name: 'Low Contrast Gray Text (저시인성 회색 글씨)', regex: /color:\s*['"]#(?:64748b|94a3b8|9ca3af|6b7280|a1a1aa)['"]/gi }
];

function getAllFiles(dir, exts = ['.tsx', '.ts', '.css']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, exts));
    } else {
      const ext = path.extname(file);
      if (exts.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function audit() {
  console.log('=== eBro 전사 UI 배색 기준 준수 여부 정밀 감사 ===\n');
  const files = getAllFiles(SRC_DIR);
  console.log(`총 검사 대상 파일 수: ${files.length}개\n`);

  const findings = {};
  for (const pat of SUSPICIOUS_PATTERNS) {
    findings[pat.name] = [];
  }

  for (const filePath of files) {
    const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
    // Ignore test scripts, manuals, mock data
    if (relPath.includes('manuals') || relPath.includes('test') || relPath.includes('.test.')) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const pat of SUSPICIOUS_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pat.regex.test(line)) {
          findings[pat.name].push({
            file: relPath,
            lineNum: i + 1,
            code: line.trim()
          });
        }
      }
    }
  }

  let totalIssues = 0;
  for (const [name, items] of Object.entries(findings)) {
    console.log(`▶ [${name}]: 총 ${items.length}건 발견`);
    totalIssues += items.length;
    // Show top 5 examples
    items.slice(0, 5).forEach(item => {
      console.log(`   - ${item.file}:${item.lineNum} -> ${item.code.substring(0, 100)}`);
    });
    if (items.length > 5) {
      console.log(`   ... 외 ${items.length - 5}건 추가`);
    }
    console.log('');
  }

  console.log(`========================================`);
  console.log(`총 비표준 배색 검출 건수: ${totalIssues}건`);
  console.log(`========================================`);
}

audit();
