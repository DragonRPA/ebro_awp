filepath = 'src/services/db.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "if (tableName === 'repairs' && (key === 'siteAddress')) {" in line:
        lines.insert(i+3, "        if (tableName === 'customer_sites' && ['billingContactName', 'billingContactPhone', 'billingContactEmail', 'safetyContactName', 'safetyContactPhone', 'safetyContactEmail'].includes(key)) { continue; }\n")
        break

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Updated db.ts line-by-line")
