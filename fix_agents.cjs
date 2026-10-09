const fs = require('fs');
let c = fs.readFileSync('.agents/AGENTS.md', 'utf8');

c = c.replace('\\n- **이름 중복 저장', '\n- **이름 중복 저장');
c = c.replace('테이블(customer_sites)에는', '테이블(`customer_sites`)에는');
c = c.replace('여부(isActive)', '여부(`isActive`)');
c = c.replace('유상옵션(paidOptions)', '유상옵션(`paidOptions`)');
c = c.replace('보양작업(protection)', '보양작업(`protection`)');
c = c.replace('현장요구사양(checkedSpecs)', '현장요구사양(`checkedSpecs`)');
c = c.replace('원천인 SiteMaster에만', '원천인 `SiteMaster`에만');

fs.writeFileSync('.agents/AGENTS.md', c);
console.log('Fixed formatting');
