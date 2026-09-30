// scripts/audit_manual_alignment.ts
import fs from 'fs';
import path from 'path';

// 재귀적으로 src 내 모든 .tsx, .ts 파일의 텍스트 수집
function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        getAllSourceFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = getAllSourceFiles('src');
const fileContentsMap = new Map<string, string>();
for (const f of allFiles) {
  fileContentsMap.set(f, fs.readFileSync(f, 'utf8'));
}

// allMenuManuals.ts 파싱
const manualsContent = fs.readFileSync('src/data/allMenuManuals.ts', 'utf8');
const menuBlocks = manualsContent.split(/menuId:\s*'/).slice(1);

interface AuditResult {
  menuId: string;
  menuName: string;
  version: number;
  totalSteps: number;
  matchedCount: number;
  matchRate: number;
  foundInFiles: string[];
  missingSelectors: string[];
  matchedSelectors: string[];
}

const results: AuditResult[] = [];

for (const block of menuBlocks) {
  const idMatch = block.match(/^([^']+)'/);
  if (!idMatch) continue;
  const menuId = idMatch[1];
  const verMatch = block.match(/version:\s*([0-9]+)/);
  const version = verMatch ? parseInt(verMatch[1], 10) : 0;
  const nameMatch = block.match(/menuName:\s*'([^']+)'/);
  const menuName = nameMatch ? nameMatch[1] : menuId;

  // annotations 파싱
  const annBlockMatch = block.match(/annotations:\s*\[([\s\S]*?)\]\s*(?:},\s*\n|},\s*$)/);
  const selectors: string[] = [];
  if (annBlockMatch) {
    const selMatches = [...annBlockMatch[1].matchAll(/selector:\s*'([^']+)'/g)];
    selMatches.forEach(s => selectors.push(s[1]));
  }

  let matchedCount = 0;
  const missingSelectors: string[] = [];
  const matchedSelectors: string[] = [];
  const foundFilesSet = new Set<string>();

  for (const sel of selectors) {
    const midMatch = sel.match(/data-mid="([^"]+)"/);
    const targetKey = midMatch ? midMatch[1] : sel;
    
    let isFound = false;
    for (const [filePath, content] of fileContentsMap.entries()) {
      if (filePath.includes('allMenuManuals.ts') || filePath.includes('audit_manual_alignment.ts')) continue;
      if (content.includes(targetKey)) {
        isFound = true;
        foundFilesSet.add(path.basename(filePath));
        break;
      }
    }

    if (isFound) {
      matchedCount++;
      matchedSelectors.push(targetKey);
    } else {
      missingSelectors.push(targetKey);
    }
  }

  results.push({
    menuId,
    menuName,
    version,
    totalSteps: selectors.length,
    matchedCount,
    matchRate: selectors.length > 0 ? Math.round((matchedCount / selectors.length) * 100) : 0,
    foundInFiles: Array.from(foundFilesSet),
    missingSelectors,
    matchedSelectors
  });
}

console.log('========================================================================================');
console.log('       [전사 55개 전 메뉴] 매뉴얼 Selector vs 실제 소스코드 data-mid 전수 스캔 감사 보고서     ');
console.log('========================================================================================');

const perfect = results.filter(r => r.totalSteps > 0 && r.matchRate === 100);
const high = results.filter(r => r.matchRate >= 70 && r.matchRate < 100);
const partial = results.filter(r => r.matchRate > 0 && r.matchRate < 70);
const zero = results.filter(r => r.matchRate === 0);

console.log(`총 메뉴 수: ${results.length}개`);
console.log(`- 🟢 100% 완전 정합 (모든 DOM 앵커 존재): ${perfect.length}개`);
console.log(`- 🟡 70% 이상 양호 (일부 누락): ${high.length}개`);
console.log(`- 🟠 부분 매칭 (심각한 누락): ${partial.length}개`);
console.log(`- 🔴 0% 완전 불일치 (가짜 선택자 방치 / 전면 불일치): ${zero.length}개`);
console.log('----------------------------------------------------------------------------------------');

console.log('\n🟢 [1. 100% 완전 정합 메뉴 (안전)]');
perfect.forEach(r => {
  console.log(`  ✓ [${r.menuId}] ${r.menuName} (v${r.version}, ${r.totalSteps}단계, 파일: ${r.foundInFiles.join(', ')})`);
});

console.log('\n🟡 [2. 70% 이상 정합 메뉴]');
high.forEach(r => {
  console.log(`  ▲ [${r.menuId}] ${r.menuName} (v${r.version}, ${r.totalSteps}단계 중 ${r.matchedCount}개 일치, 정합률 ${r.matchRate}%)`);
  console.log(`     누락 키: ${r.missingSelectors.join(', ')}`);
});

console.log('\n🟠 [3. 부분 매칭 메뉴]');
partial.forEach(r => {
  console.log(`  ! [${r.menuId}] ${r.menuName} (v${r.version}, ${r.totalSteps}단계 중 ${r.matchedCount}개 일치, 정합률 ${r.matchRate}%)`);
  console.log(`     누락 키: ${r.missingSelectors.join(', ')}`);
});

console.log('\n🔴 [4. 0% 완전 불일치 메뉴 (전면 개편 대상)]');
zero.forEach(r => {
  console.log(`  ✗ [${r.menuId}] ${r.menuName} (v${r.version}, ${r.totalSteps}단계 등록됨, 가짜선택자 예: ${r.missingSelectors.slice(0, 3).join(', ')})`);
});

