
with open('src/pages/smart_dispatch4.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if '출고 요청 작성' in l or '임시 보관함' in l or 'viewFilter' in l or 'activeTab' in l:
        print(f'{i}: {l.strip()}')

