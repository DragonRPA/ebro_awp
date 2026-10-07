filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "onClick={() => handleOpenEditSite(cs)}" in line:
        for j in range(i-15, i+15):
            print(f"{j}: {lines[j].rstrip()}")
        break
