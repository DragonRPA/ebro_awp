
const fs = require('fs');
let content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

content = content.replace(/const \\\[selectedCustomerId, setSelectedCustomerId\\\] = useState<string>\\('ALL'\\);\\n?/, '');
content = content.replace(/\\} else if \\(navigationPayload\\.customerId\\) \\{[\\s\\S]*?setSelectedCustomerId\\(navigationPayload\\.customerId\\);\\s*\\}/, '');
content = content.replace(/const targetSite = \\(sites \\|\\| \\\[\\\]\\)\\.find\\(s => s\\.id === navigationPayload\\.siteId\\);\\s*if \\(targetSite\\) \\{\\s*setSelectedCustomerId\\(targetSite\\.customerId\\);\\s*\\}/, '');

content = content.replace(/\\s*\\/\\/ 📌 고속 조회를 위한 ID -> 고객사 매핑 맵\\s*const customerMap = useMemo\\(\\(\\) => \\{[\\s\\S]*?\\}, \\\[customers\\\]\\);\\n?/, '');

content = content.replace(/const filteredSites = useMemo\\(\\(\\) => \\{[\\s\\S]*?\\}, \\\[sites, selectedCustomerId, searchSiteKeyword, customerMap\\\]\\);/, 
  'const filteredSites = useMemo(() => {\\n' +
  '  return (sites || []).filter(s => {\\n' +
  '    if (searchSiteKeyword.trim()) {\\n' +
  '      const kw = searchSiteKeyword.trim().toLowerCase();\\n' +
  '      const matchName = (s.name || \\'\\').toLowerCase().includes(kw);\\n' +
  '      const matchAddr = (s.address || \\'\\').toLowerCase().includes(kw);\\n' +
  '      if (!matchName && !matchAddr) return false;\\n' +
  '    }\\n' +
  '    return true;\\n' +
  '  });\\n' +
  '}, [sites, searchSiteKeyword]);'
);

content = content.replace(/const rows = filteredSites\\.map\\(s => \\{[\\s\\S]*?return \\{[\\s\\S]*?'고객사': cust\\?\\.name \\|\\| '-',[\\s\\S]*?'현장명': s\\.name,/, 
  'const rows = filteredSites.map(s => {\\n' +
  '  return {\\n' +
  '    \\'현장명\\': s.name,'
);

content = content.replace(/<div style=\\{\\{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px', flex: 1 \\}\\}>[\\s\\S]*?<\\/select>\\s*<\\/div>/, '');

content = content.replace(/const cust = customerMap\\.get\\(site\\.customerId\\);\\n?/, '');
content = content.replace(/<div style=\\{\\{ fontSize: '11\\.5px', fontWeight: 600, color: 'var\\(--primary\\)', marginBottom: '4px' \\}\\}>\\s*\\{cust\\?\\.name \\|\\| '고객사 없음'\\}\\s*<\\/div>/, '');

content = content.replace(/<span style=\\{\\{ fontSize: '12px', fontWeight: 700, color: 'var\\(--text-muted\\)' \\}\\}>\\s*\\(\\{customerMap\\.get\\(activeSite\\.customerId\\)\\?\\.name \\|\\| '미지정'\\}\\)\\s*<\\/span>/, '');

const emptyPaid = {workingOptionItems.filter(item => item.category === 'PAID').length === 0 && (
  <tr>
    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <AlertCircle size={16} style={{ display: 'inline-block', marginBottom: '-3px', marginRight: '4px' }} />
      등록된 유상 옵션 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
    </td>
  </tr>
)};
content = content.replace(/<tbody>\\s*\\{workingOptionItems\\.filter\\(item => item\\.category === 'PAID'\\)\\.map\\(item => \\{/, '<tbody>\\n' + emptyPaid + '\\n{workingOptionItems.filter(item => item.category === \\'PAID\\').map(item => {');

const emptyProt = {workingOptionItems.filter(item => item.category === 'PROTECTION').length === 0 && (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    등록된 보양 작업 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
  </div>
)};
content = content.replace(/<div style=\\{\\{ display: 'flex', flexWrap: 'wrap', gap: '8px' \\}\\}>\\s*\\{workingOptionItems\\.filter\\(item => item\\.category === 'PROTECTION'\\)\\.map/, '<div style={{ display: \\'flex\\', flexWrap: \\'wrap\\', gap: \\'8px\\' }}>\\n' + emptyProt + '\\n{workingOptionItems.filter(item => item.category === \\'PROTECTION\\').map');

const emptySpec = {workingOptionItems.filter(item => item.category === 'SPEC').length === 0 && (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    등록된 현장 요구 사양 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
  </div>
)};
content = content.replace(/<div style=\\{\\{ display: 'flex', flexWrap: 'wrap', gap: '8px' \\}\\}>\\s*\\{workingOptionItems\\.filter\\(item => item\\.category === 'SPEC'\\)\\.map/, '<div style={{ display: \\'flex\\', flexWrap: \\'wrap\\', gap: \\'8px\\' }}>\\n' + emptySpec + '\\n{workingOptionItems.filter(item => item.category === \\'SPEC\\').map');

content = content.replace(/CustomerSite, Customer/, 'CustomerSite');
content = content.replace(/customers, /g, '');

fs.writeFileSync('src/pages/SiteOptionManage.tsx', content, 'utf8');
console.log('Done!');

