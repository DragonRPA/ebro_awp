
const fs = require('fs');
let content = fs.readFileSync('src/pages/SiteOptionManage.tsx', 'utf8');

// Use string replace instead of regex where complex
const lines = content.split('\n');

const res = [];
let skipCustomerMap = false;
let skipFilteredSites = false;
let skipRows = false;
let skipCustFilter = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes('const [selectedCustomerId')) continue;
  if (line.includes('setSelectedCustomerId(targetSite.customerId)')) continue;
  if (line.includes('setSelectedCustomerId(navigationPayload.customerId)')) continue;
  
  if (line.includes('고속 조회를 위한 ID -> 고객사 매핑 맵')) {
    skipCustomerMap = true;
    continue;
  }
  if (skipCustomerMap) {
    if (line.includes('}, [customers]);')) {
      skipCustomerMap = false;
    }
    continue;
  }

  if (line.includes('const filteredSites = useMemo(() => {')) {
    skipFilteredSites = true;
    res.push('  const filteredSites = useMemo(() => {');
    res.push('    return (sites || []).filter(s => {');
    res.push('      if (searchSiteKeyword.trim()) {');
    res.push('        const kw = searchSiteKeyword.trim().toLowerCase();');
    res.push('        const matchName = (s.name || \\'\\').toLowerCase().includes(kw);');
    res.push('        const matchAddr = (s.address || \\'\\').toLowerCase().includes(kw);');
    res.push('        if (!matchName && !matchAddr) return false;');
    res.push('      }');
    res.push('      return true;');
    res.push('    });');
    res.push('  }, [sites, searchSiteKeyword]);');
    continue;
  }
  if (skipFilteredSites) {
    if (line.includes('}, [sites, selectedCustomerId, searchSiteKeyword, customerMap]);')) {
      skipFilteredSites = false;
    }
    continue;
  }

  if (line.includes('const rows = filteredSites.map(s => {')) {
    skipRows = true;
    res.push('      const rows = filteredSites.map(s => {');
    res.push('        return {');
    res.push('          \\'현장명\\': s.name,');
    continue;
  }
  if (skipRows) {
    if (line.includes('\\'현장명\\': s.name,')) {
      skipRows = false;
    }
    continue;
  }

  if (line.includes('<div style={{ display: \\'flex\\', flexDirection: \\'column\\', gap: \\'4px\\', minWidth: \\'150px\\', flex: 1 }}>')) {
    skipCustFilter = true;
    continue;
  }
  if (skipCustFilter) {
    if (line.includes('</select>')) {
      // skip two more lines: </div> and the empty space if any
      i += 1;
      skipCustFilter = false;
    }
    continue;
  }

  if (line.includes('const cust = customerMap.get(site.customerId);')) continue;
  if (line.includes('{cust?.name || \\'고객사 없음\\'}')) continue;
  if (line.includes('({customerMap.get(activeSite.customerId)?.name || \\'미지정\\'})')) continue;

  if (line.includes('<tbody>')) {
    if (lines[i+1] && lines[i+1].includes('workingOptionItems.filter(item => item.category === \\'PAID\\')')) {
      res.push(line);
      res.push({workingOptionItems.filter(item => item.category === 'PAID').length === 0 && (
  <tr>
    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <AlertCircle size={16} style={{ display: 'inline-block', marginBottom: '-3px', marginRight: '4px' }} />
      등록된 유상 옵션 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
    </td>
  </tr>
)});
      continue;
    }
  }

  if (line.includes('<div style={{ display: \\'flex\\', flexWrap: \\'wrap\\', gap: \\'8px\\' }}>')) {
    if (lines[i+1] && lines[i+1].includes('workingOptionItems.filter(item => item.category === \\'PROTECTION\\')')) {
      res.push(line);
      res.push({workingOptionItems.filter(item => item.category === 'PROTECTION').length === 0 && (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    등록된 보양 작업 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
  </div>
)});
      continue;
    }
    if (lines[i+1] && lines[i+1].includes('workingOptionItems.filter(item => item.category === \\'SPEC\\')')) {
      res.push(line);
      res.push({workingOptionItems.filter(item => item.category === 'SPEC').length === 0 && (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    등록된 현장 요구 사양 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
  </div>
)});
      continue;
    }
  }

  res.push(line);
}

const finalStr = res.join('\n')
  .replace(/CustomerSite, Customer/, 'CustomerSite')
  .replace(/customers, /g, '');

fs.writeFileSync('src/pages/SiteOptionManage.tsx', finalStr, 'utf8');
console.log('Success');

