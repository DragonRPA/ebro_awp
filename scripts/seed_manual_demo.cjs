// scripts/seed_manual_demo.cjs
// 결재선 규칙 설정 페이지 데모 매뉴얼 생성 + 이미지 Supabase Storage 업로드
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://wywgkikkjgbnlljkkmnz.supabase.co';
let key = '';
try { const env = fs.readFileSync('.env', 'utf8'); const m = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/); if (m) key = m[1].trim(); } catch {}
const sb = createClient(SUPABASE_URL, key);

const PAGE_ID = 'approval_rules_manage';
const PAGE_TITLE = '결재선 규칙 설정';

// ── 이미지 생성 헬퍼 (canvas 없을 경우 SVG base64 대체) ─────────────
function makeSvgDataUrl(title, lines, color = '#4f46e5') {
  const h = 40 + lines.length * 28;
  const svgLines = lines.map((l, i) =>
    `<text x="20" y="${48 + i * 28}" font-family="sans-serif" font-size="14" fill="#1f2937">${escXml(l)}</text>`
  ).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${h}">
    <rect width="420" height="${h}" rx="10" fill="#f8fafc" stroke="${color}" stroke-width="2"/>
    <rect width="420" height="38" rx="10" fill="${color}"/>
    <rect x="0" y="28" width="420" height="10" fill="${color}"/>
    <text x="16" y="25" font-family="sans-serif" font-size="14" font-weight="bold" fill="white">${escXml(title)}</text>
    ${svgLines}
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
function escXml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── SVG → Buffer ────────────────────────────────────────────────────
function svgToBuf(title, lines, color) {
  const h = 40 + lines.length * 28;
  const svgLines = lines.map((l, i) =>
    `<text x="20" y="${48 + i * 28}" font-family="sans-serif" font-size="14" fill="#1f2937">${escXml(l)}</text>`
  ).join('\n');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${h}">
  <rect width="420" height="${h}" rx="10" fill="#f8fafc" stroke="${color}" stroke-width="2"/>
  <rect width="420" height="38" rx="10" fill="${color}"/>
  <rect x="0" y="28" width="420" height="10" fill="${color}"/>
  <text x="16" y="25" font-family="sans-serif" font-size="14" font-weight="bold" fill="white">${escXml(title)}</text>
  ${svgLines}
</svg>`;
  return Buffer.from(svg, 'utf8');
}

// Storage 버킷 권한 이슈 → SVG를 base64 data URL로 직접 imageUrl에 임베드
function uploadSvg(filename, title, lines, color = '#4f46e5') {
  const h = 48 + lines.length * 28;
  const svgLines = lines.map((l, i) =>
    `<text x="20" y="${56 + i * 28}" font-family="'Malgun Gothic',sans-serif" font-size="13" fill="#1f2937">${escXml(l)}</text>`
  ).join('\n');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${h}">
  <rect width="420" height="${h}" rx="10" fill="#f8fafc" stroke="${color}" stroke-width="2"/>
  <rect width="420" height="42" rx="10" fill="${color}"/>
  <rect x="0" y="32" width="420" height="10" fill="${color}"/>
  <text x="16" y="28" font-family="'Malgun Gothic',sans-serif" font-size="14" font-weight="bold" fill="white">${escXml(title)}</text>
  ${svgLines}
</svg>`;
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
  console.log('SVG data URL generated:', filename, `(${Math.round(dataUrl.length/1024)}KB)`);
  return Promise.resolve(dataUrl);
}

async function run() {
  // ── 이미지 3종 생성 후 Storage 업로드 ─────────────────────────────
  const imgSeedAll = await uploadSvg('guide_seed_all.svg', '① 전체 업무 일괄 생성', [
    '클릭 시 APPROVAL_EVENT_REGISTRY에 정의된',
    '전사 15개 업무를 approval_rules 테이블에',
    '일괄 INSERT 합니다.',
    '',
    '※ 이미 등록된 이벤트는 스킵됩니다.',
    '※ 버튼 비활성(회색) = 미등록 업무 없음',
  ], '#4f46e5');

  const imgTier = await uploadSvg('guide_tier.svg', '③ 전결 티어 선택 기준', [
    '0  사원    — 사원급 단독 결재',
    '1  대리    — 대리급 이상',
    '3  과장    — 과장급 이상 (기본값)',
    '4  차장    — 차장급 이상',
    '5  부장    — 부장급 이상',
    '6  이사    — 이사급 이상',
    '7  대표    — 대표이사 최종 결재',
    '',
    '변경 즉시 DB 자동 저장됩니다.',
  ], '#d97706');

  const imgConsensus = await uploadSvg('guide_consensus.svg', '⑤ 합의선 설정 패널', [
    '▶ 클릭 → 해당 행 아래 패널 확장',
    '',
    '결재 전 협의가 필요한 부서/직책 단계를',
    '추가합니다. (예: 법무팀 검토 → 재무팀 승인)',
    '',
    '실행 방식: SEQUENTIAL(순차) / PARALLEL(병렬)',
    '트리거 티어: 몇 티어 결재 후 합의를 시작할지',
  ], '#059669');

  // ── 매뉴얼 JSON 구성 ────────────────────────────────────────────────
  const manualPage = {
    pageId: PAGE_ID,
    pageTitle: PAGE_TITLE,
    version: 1,
    items: [
      {
        seq: 1,
        selector: '[data-mid="btn-seed-all"]',
        type: 'stamp',
        label: '전체 업무 일괄 생성',
        description: '클릭하면 전사 15개 결재 이벤트를 한 번에 등록합니다. 이미 등록된 이벤트는 중복 삽입되지 않습니다. 버튼이 회색이면 미등록 업무가 없는 상태입니다.',
        badgeColor: '#4f46e5',
        positionHint: 'bottom',
        spotlight: true,
        arrow: null,
        imageUrl: imgSeedAll,
        autoExtracted: '전체 업무 일괄 생성',
      },
      {
        seq: 2,
        selector: '[data-mid="input-event-name"]',
        type: 'callout',
        label: '업무 이벤트명 인라인 편집',
        description: '셀을 클릭하면 바로 편집 가능합니다. 입력창에서 벗어나는 순간(onBlur) DB에 즉시 저장됩니다. 예시 입력값: "고객 신규 등록 결재"',
        badgeColor: '#1d4ed8',
        positionHint: 'right',
        spotlight: false,
        arrow: { style: 'elbow', route: 'HV' },
        imageUrl: null,
        autoExtracted: '업무 이벤트명 입력창',
      },
      {
        seq: 3,
        selector: '[data-mid="select-tier"]',
        type: 'callout',
        label: '전결 티어 선택',
        description: '드롭다운에서 결재 권한 레벨을 선택합니다. 선택 즉시 저장됩니다. 기본값은 과장(3티어)이며, 계약·출고·정산 업무는 5티어(부장) 이상을 권장합니다.',
        badgeColor: '#d97706',
        positionHint: 'left',
        spotlight: false,
        arrow: null,
        imageUrl: imgTier,
        autoExtracted: '전결 티어 드롭다운',
      },
      {
        seq: 4,
        selector: '[data-mid="btn-toggle-enabled"]',
        type: 'click_ripple',
        label: '결재 사용 ON/OFF 토글',
        description: '클릭 한 번으로 결재 활성화/비활성화를 전환합니다. OFF 상태에서는 해당 이벤트 발생 시 결재 요청이 생성되지 않습니다. 초기 일괄 생성 후 사용할 업무만 ON으로 전환하세요.',
        badgeColor: '#059669',
        positionHint: 'bottom',
        spotlight: false,
        arrow: null,
        imageUrl: null,
        autoExtracted: 'ON / OFF 버튼',
      },
      {
        seq: 5,
        selector: '[data-mid="btn-expand-consensus"]',
        type: 'highlight',
        label: '합의선 확장 — ▶ 클릭',
        description: '▶ 기호를 클릭하면 해당 결재선의 합의 단계 설정 패널이 펼쳐집니다. 결재 전 협의가 필요한 부서/직책(예: 법무팀 → 재무팀)을 단계별로 추가할 수 있습니다.',
        badgeColor: '#7c3aed',
        positionHint: 'right',
        spotlight: true,
        arrow: { style: 'straight' },
        imageUrl: imgConsensus,
        autoExtracted: '▶ 합의선 확장 토글',
      },
    ],
  };

  // ── Supabase upsert ────────────────────────────────────────────────
  const { error } = await sb.from('manual_annotations').upsert({
    tenant_id: 'default',
    page_id: PAGE_ID,
    page_title: PAGE_TITLE,
    version: 1,
    annotations: manualPage,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,page_id' });

  if (error) { console.error('Upsert error:', error.message); process.exit(1); }
  console.log('✅ 매뉴얼 데모 생성 완료! page_id:', PAGE_ID);
  console.log('   어노테이션 수:', manualPage.items.length, '건');
  console.log('   이미지 업로드:', [imgSeedAll, imgTier, imgConsensus].filter(Boolean).length, '건');
}
run().catch(console.error);
