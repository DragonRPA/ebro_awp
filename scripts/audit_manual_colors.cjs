// scripts/audit_manual_colors.cjs
// 매뉴얼 시스템 UI 색상 일관성 및 5색 고시인성 표준 규격화 감사 스크립트

const fs = require('fs');
const path = require('path');

const targetFiles = [
  'src/components/manual/manualPalette.ts',
  'src/components/manual/ManualOverlay.tsx',
  'src/components/manual/MenuBriefingBox.tsx',
  'src/components/manual/MenuSpecDocModal.tsx',
  'src/components/manual/ManualAuthorPanel.tsx',
  'src/components/manual/ManualContext.tsx',
  'src/pages/OperationManualPage.tsx',
  'src/pages/ManualsManage.tsx',
  'src/pages/ManualDictionaryPage.tsx',
  'src/data/modalManuals.ts',
  'src/data/allMenuManuals.ts',
  'src/mobile/pages/MobileManualViewer.tsx',
  'src/types/manual.ts'
];

// 전사 5색 표준 토큰
// 1. Primary (Action): #1D4ED8 (Cobalt Blue) / Dark #38BDF8
// 2. Success (Positive): #047857 (Forest Emerald) / Dark #34D399
// 3. Danger (Negative): #DC2626 (Crimson Red) / Dark #F87171
// 4. Warning (Attention): #B45309 (Deep Amber) / Dark #FBBF24
// 5. Neutral (Ink/Paper): #0F172A (Deep Slate) / #F5F2EB / #FBF9F5 / #0B0F19

// 허용되는 표준 5색 및 허용 파생 (알파 채널 및 안전 인쇄용 색상 등)
const ALLOWED_COLORS = new Set([
  '#1d4ed8', '#38bdf8', '#2563eb', // primary blue
  '#047857', '#34d399', '#059669', '#10b981', '#16a34a', // emerald / green
  '#dc2626', '#f87171', '#e53935', '#ef4444', // crimson / red
  '#b45309', '#fbbf24', '#d97706', '#f59e0b', // amber
  '#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9', '#f8fafc', '#ffffff', '#fff', '#000000', '#000', '#0b0f19', '#f5f2eb', '#fbf9f5' // monochrome / paper / slate
]);

// 명백한 위반 색상 (보라, 마젠타, 핑크, 시안, 틸 등 5색 외 무지개색)
const FORBIDDEN_RAINBOW = [
  '#7c3aed', '#6366f1', '#4f46e5', '#8b5cf6', '#a855f7', '#c084fc', // purple / violet / indigo
  '#0d9488', '#0891b2', '#06b6d4', '#14b8a6', // cyan / teal
  '#e11d48', '#f43f5e', '#ec4899', '#db2777', '#c026d3', '#d946ef' // rose / pink / fuchsia
];

console.log('=== [E-Bro ERP] 매뉴얼 시스템 UI 색상 일관성 감사 ===\n');

let totalIssues = 0;

targetFiles.forEach(relPath => {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`[SKIP] 파일 없음: ${relPath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const fileIssues = [];

  lines.forEach((line, idx) => {
    // 1. 금지 무지개색 탐지
    FORBIDDEN_RAINBOW.forEach(forbidden => {
      if (line.toLowerCase().includes(forbidden)) {
        fileIssues.push({
          lineNum: idx + 1,
          type: 'FORBIDDEN_RAINBOW_COLOR',
          detail: `금지 무지개색 (${forbidden}) 사용`,
          content: line.trim()
        });
      }
    });

    // 2. 다크모드/종이질감 파괴하는 하드코딩 배경색 탐지 (단, print 스타일 및 인라인 제외)
    if (!line.includes('@media print') && !line.includes('print-')) {
      if (
        (line.includes("backgroundColor: '#fff'") ||
         line.includes("backgroundColor: '#ffffff'") ||
         line.includes("backgroundColor: '#F8FAFC'") ||
         line.includes("backgroundColor: '#FAF5FF'") ||
         line.includes("backgroundColor: '#EFF6FF'") ||
         line.includes("backgroundColor: '#F0FDF4'") ||
         line.includes("backgroundColor: '#FFFBEB'") ||
         line.includes("background: '#fff'") ||
         line.includes("background: '#ffffff'")) &&
        !line.includes('var(')
      ) {
        fileIssues.push({
          lineNum: idx + 1,
          type: 'HARDCODED_LIGHT_BG',
          detail: '다크모드/종이질감 비호환 하드코딩 배경색 사용 (var(--bg-card) 또는 var(--bg-app) 권장)',
          content: line.trim()
        });
      }
    }
  });

  if (fileIssues.length > 0) {
    console.log(`\n❌ [${relPath}] - 결함 ${fileIssues.length}건 발견:`);
    fileIssues.forEach(iss => {
      console.log(`   L${iss.lineNum} [${iss.type}] ${iss.detail}`);
      console.log(`     > ${iss.content}`);
    });
    totalIssues += fileIssues.length;
  } else {
    console.log(`✅ [${relPath}] - 결함 없음 (5색 고시인성 규격 일치)`);
  }
});

console.log(`\n========================================`);
console.log(`총 발견된 결함: ${totalIssues}건`);
console.log(`========================================\n`);
