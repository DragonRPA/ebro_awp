import os

with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

res = []
i = 0
while i < len(lines):
    line = lines[i]
    if 'const map = new Map<string, Customer>();' in line:
        i += 4 # skip the whole block
        continue
    if 'const customerMap = useMemo(() => {' in line:
        i += 5
        continue
    if 'value={selectedCustomerId}' in line:
        i += 1
        continue
    if 'onChange={e => setSelectedCustomerId(e.target.value)}' in line:
        i += 1
        continue
    if '<option value=\"ALL\">' in line and '{customers?.length' in line:
        i += 4
        continue
    if '{cust?.name ||' in line:
        i += 1
        continue
    if '{customerMap.get(activeSite.customerId)?.name ||' in line:
        i += 1
        continue
    if 'const cust = customerMap.get(site.customerId);' in line:
        i += 1
        continue
    if 'const map = new Map<string, Customer>();' in line:
        i += 1
        continue
    
    if '\'고객사\': cust?.name || \'-\',' in line:
        i += 1
        continue
    if 'import { StandardOption, CustomerSite } from \'../services/db\';' in line:
        line = 'import { StandardOption, CustomerSite, Customer } from \'../services/db\';\n'

    res.append(line)
    i += 1

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.writelines(res)
print('Fixed SiteOptionManage.tsx TS errors')
