with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
res = []
for line in lines:
    if "'고객사': cust?.name || '-'," in line:
        continue
    if "cust?.name" in line:
        continue
    res.append(line)
with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.writelines(res)
