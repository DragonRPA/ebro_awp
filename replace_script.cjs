const fs = require('fs');
const path = 'd:/01.AntiGravity/Giyuen_Lift/src/pages/Contracts.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<div>\s*<label[^>]*>현장 담당자<\/label>\s*<span>[\s\S]*?<\/span>\s*<\/div>\s*<div><label[^>]*>영업담당<\/label><span>[^<]*<\/span><\/div>/;

const match = content.match(regex);
if (match) {
  const replacement = `<div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>현장 담당자</label>
                  <span>
                    {(() => {
                      const site = sites.find(s => s.id === activeContract.siteId);
                      return site && site.contactName ? site.contactName : '-';
                    })()}
                  </span>
                </div>
                <div><label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>영업담당</label><span>{users.find(u => u.id === activeContract.salespersonId)?.name || '-'}</span></div>
                
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>담당자 연락처</label>
                  <span>{sites.find(s => s.id === activeContract.siteId)?.contact || '-'}</span>
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>담당자 이메일</label>
                  <span>{sites.find(s => s.id === activeContract.siteId)?.email || '-'}</span>
                </div>`;
  content = content.replace(regex, replacement);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully replaced via Regex');
} else {
  console.log('Regex not matched');
}
