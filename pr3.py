
with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for n in [61, 62, 64, 213, 310, 311, 325, 326, 530, 597]:
    print(f'{n}: {repr(lines[n-1])}')

