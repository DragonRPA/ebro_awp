import os

with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

res = []
skipCustomerMap = False
skipFilteredSites = False
skipRows = False
skipCustFilter = False

for i in range(len(lines)):
    line = lines[i]

    if 'const [selectedCustomerId' in line: continue
    if 'setSelectedCustomerId(targetSite.customerId)' in line: continue
    if 'setSelectedCustomerId(navigationPayload.customerId)' in line: continue
    
    if '고속 조회를 위한 ID -> 고객사 매핑 맵' in line:
        skipCustomerMap = True
        continue
    
    if skipCustomerMap:
        if '}, [customers]);' in line:
            skipCustomerMap = False
        continue
    
    if 'const filteredSites = useMemo(() => {' in line:
        skipFilteredSites = True
        res.append('  const filteredSites = useMemo(() => {\n')
        res.append('    return (sites || []).filter(s => {\n')
        res.append('      if (searchSiteKeyword.trim()) {\n')
        res.append('        const kw = searchSiteKeyword.trim().toLowerCase();\n')
        res.append('        const matchName = (s.name || \"\").toLowerCase().includes(kw);\n')
        res.append('        const matchAddr = (s.address || \"\").toLowerCase().includes(kw);\n')
        res.append('        if (!matchName && !matchAddr) return false;\n')
        res.append('      }\n')
        res.append('      return true;\n')
        res.append('    });\n')
        res.append('  }, [sites, searchSiteKeyword]);\n')
        continue
    
    if skipFilteredSites:
        if '}, [sites, selectedCustomerId, searchSiteKeyword, customerMap]);' in line:
            skipFilteredSites = False
        continue
    
    if 'const rows = filteredSites.map(s => {' in line:
        skipRows = True
        res.append('      const rows = filteredSites.map(s => {\n')
        res.append('        return {\n')
        res.append('          \"현장명\": s.name,\n')
        continue
    
    if skipRows:
        if '\"현장명\": s.name,' in line or '\'현장명\': s.name,' in line:
            skipRows = False
        continue
    
    if '<div style={{ display: \'flex\', flexDirection: \'column\', gap: \'4px\', minWidth: \'150px\', flex: 1 }}>' in line:
        skipCustFilter = True
        continue
    
    if skipCustFilter:
        if '</select>' in line:
            skipCustFilter = False
            # We skip this line and the next line (</div>)
            lines[i+1] = ""
        continue
    
    if 'const cust = customerMap.get(site.customerId);' in line: continue
    if '{cust?.name || \'고객사 없음\'}' in line: continue
    if '({customerMap.get(activeSite.customerId)?.name || \'미지정\'})' in line: continue

    if '<tbody>' in line:
        if i+1 < len(lines) and 'workingOptionItems.filter(item => item.category === \'PAID\')' in lines[i+1]:
            res.append(line)
            res.append('''{workingOptionItems.filter(item => item.category === 'PAID').length === 0 && (
  <tr>
    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <AlertCircle size={16} style={{ display: 'inline-block', marginBottom: '-3px', marginRight: '4px' }} />
      등록된 유상 옵션 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
    </td>
  </tr>
)}\n''')
            continue
            
    if '<div style={{ display: \'flex\', flexWrap: \'wrap\', gap: \'8px\' }}>' in line:
        if i+1 < len(lines) and 'workingOptionItems.filter(item => item.category === \'PROTECTION\')' in lines[i+1]:
            res.append(line)
            res.append('''{workingOptionItems.filter(item => item.category === 'PROTECTION').length === 0 && (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    등록된 보양 작업 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
  </div>
)}\n''')
            continue
        if i+1 < len(lines) and 'workingOptionItems.filter(item => item.category === \'SPEC\')' in lines[i+1]:
            res.append(line)
            res.append('''{workingOptionItems.filter(item => item.category === 'SPEC').length === 0 && (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    등록된 현장 요구 사양 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.
  </div>
)}\n''')
            continue

    res.append(line)

content = "".join(res)
content = content.replace('CustomerSite, Customer', 'CustomerSite')
content = content.replace('customers, ', '')

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
