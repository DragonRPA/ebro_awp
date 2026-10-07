filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "setShowCustModal(false)" in line and "btn-secondary" in line:
        print(f"Line {i+1}: {line.strip()}")
        for j in range(i-3, i+3):
            print(f"  {j+1}: {lines[j].rstrip()}")
        print("-" * 40)
