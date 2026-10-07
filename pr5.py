
with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if 'isSaving ?' in l:
        for j in range(max(0, i-20), min(len(lines), i+10)):
            print(f'{j+1}: {repr(lines[j])}')

