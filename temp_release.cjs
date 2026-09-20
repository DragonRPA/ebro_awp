const fs = require('fs');
const path = 'RELEASE_NOTES.md';
let content = fs.readFileSync(path, 'utf8');

const newNote = `
## [v1.5.3.Build.1] - 2026-09-20 18:56
- **대시보드 권한 개편**:
  - 출고팀(Outbound) 대시보드 피드를 "장비 할당 대기", "출고 검수 대기", "입고 검수 대기" 3가지로 엄격히 제한.
  - 배차 대기 피드는 관리부에만 표출되도록 접근 권한 캡슐화.
  - 불필요한 소모품 출고 및 미출력 문서 대기 피드 관념 제거.
`;

// Insert the new note after the main header
content = content.replace(/# Giyuen Lift Release Notes\n/, "# Giyuen Lift Release Notes\n" + newNote);
fs.writeFileSync(path, content, 'utf8');
console.log('Updated RELEASE_NOTES.md');
