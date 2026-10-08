const fs = require('fs');
let code = fs.readFileSync('D:/01.AntiGravity/eBro/src/pages/Contracts.tsx', 'utf8');
code = code.replace(
  \"계약 목록 ({filteredContracts.length})\\n            </button>\",
  \"계약 목록 ({filteredContracts.length})\\n            </button>\\n            <button className={activeTab === 'CREATE' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('CREATE')} style={{ padding: '7px 14px', fontSize: '12px' }}>신규 계약 등록</button>\"
);
fs.writeFileSync('D:/01.AntiGravity/eBro/src/pages/Contracts.tsx', code, 'utf8');
