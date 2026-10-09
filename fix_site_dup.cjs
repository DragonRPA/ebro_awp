const fs = require('fs');
let c = fs.readFileSync('src/pages/Customers.tsx', 'utf8');

const validationCode = `
    const rawName = editingSite.name || '';
    const normalizedName = rawName.replace(/\\s+/g, '');
    const duplicate = (sites || []).find(s => 
      s.id !== editingSite.id && 
      (s.name || '').replace(/\\s+/g, '') === normalizedName
    );
    if (duplicate) {
      showErrorModal(\`동일한 이름의 현장이 이미 등록되어 있습니다.\\n\\n입력: [\${rawName}]\\n기존: [\${duplicate.name}]\\n소속 고객사: [\${customerMap.get(duplicate.customerId || '')?.name || '알 수 없음'}]\\n\\n띄어쓰기 등 휴먼 에러로 인한 중복 생성을 방지하기 위해 등록이 엄격히 금지됩니다. 기존에 등록된 현장을 활용해 주세요.\`);
      return;
    }
`;

c = c.replace(
  'if (!editingSite || !editingSite.name || !editingSite.customerId) return;',
  'if (!editingSite || !editingSite.name || !editingSite.customerId) return;\n' + validationCode
);

fs.writeFileSync('src/pages/Customers.tsx', c);
console.log('Added strict duplicate check to Customers.tsx');
