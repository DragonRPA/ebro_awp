
with open('src/services/db.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if 'export interface CustomerSite {' in l or 'export interface CustomerContact {' in l:
        for j in range(i, i+3):
            print(repr(lines[j]))

