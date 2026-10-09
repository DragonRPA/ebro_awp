const fs = require('fs');
let c = fs.readFileSync('RELEASE_NOTES.md', 'utf8');

const newEntry = `## [v1.16.0.Build.1] - 2026-10-09 22:45
### ✨ 현장 마스터(M) 중심의 N:M 아키텍처 대개편 및 UI/UX 동기화
- **논리적 모순 제거 (역정규화 영구 금지)**: 고객-현장 조인 테이블(\`CustomerSite\`)에 잘못 보관되던 물리적 현장(M) 고유의 속성들(\`isActive\`, \`paidOptions\`, \`protection\`, \`checkedSpecs\`)을 스키마에서 완전히 삭제했습니다.
- **가동 여부(isActive) SSOT 일원화**: 개별 고객사마다 현장의 가동(완공) 상태를 다르게 쥐고 있던 오류를 바로잡아, 모든 가동/종료 상태는 오직 단일 진실의 원천인 \`SiteMaster\`를 실시간 메모리 조인하여 판별하도록 전면 리팩토링했습니다.
- **[현장별 옵션 관리] UI 개편**: 우측 작업대 패널에 현장의 \`[🟢 가동중]\` / \`[⚫ 종료(완공)]\` 상태 뱃지를 노출하고, **[🔌 현장 완공(종료) 처리]** 퀵 버튼을 신설하여 버튼 하나로 현장을 닫고 모든 고객사의 현장 리스트에서 자동 배제되도록 연동을 완결했습니다.
- **[개발자 전용 현장 마스터 강제 병합] UI 개선**: 현장 A, B 선택 드롭다운 리스트의 아이템을 오름차순(가나다순)으로 정렬(\`localeCompare\`)하여 편의성을 극대화했습니다.

`;

c = newEntry + c;
fs.writeFileSync('RELEASE_NOTES.md', c);
console.log('Updated RELEASE_NOTES.md');
