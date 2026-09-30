const fs = require('fs');
const path = 'D:/01.AntiGravity/Giyuen_Lift/src/pages/inspection_checklist_manage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  '{/* 좌상단: Scope */}\n            <div style={{ display: \'flex\', alignItems: \'center\', gap: \'10px\', flexWrap: \'wrap\' }}>',
  '{/* 좌상단: Scope */}\n            <div data-mid="inspection_checklist_manage-filter" style={{ display: \'flex\', alignItems: \'center\', gap: \'10px\', flexWrap: \'wrap\' }}>'
);

code = code.replace(
  '{/* 우상단: 파이프라인 액션 (추가, 다운로드) */}\n            <div style={{ flex: 1, display: \'flex\', justifyContent: \'flex-end\', gap: \'8px\' }}>',
  '{/* 우상단: 파이프라인 액션 (추가, 다운로드) */}\n            <div data-mid="inspection_checklist_manage-pipeline" style={{ flex: 1, display: \'flex\', justifyContent: \'flex-end\', gap: \'8px\' }}>'
);

code = code.replace(
  '{/* ─── 테이블 영역 (Grid) ─── */}\n          <div className="card" style={{ padding: \'0\', overflowX: \'auto\' }}>',
  '{/* ─── 테이블 영역 (Grid) ─── */}\n          <div data-mid="inspection_checklist_manage-grid" className="card" style={{ padding: \'0\', overflowX: \'auto\' }}>'
);

code = code.replace(
  '{/* 하단 종단 바 / 터미널 영역 */}\n      <div\n        style={{',
  '{/* 하단 종단 바 / 터미널 영역 */}\n      <div\n        data-mid="inspection_checklist_manage-audit"\n        style={{'
);

fs.writeFileSync(path, code, 'utf8');
