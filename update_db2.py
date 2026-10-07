import os

filepath = 'src/services/db.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = "if (tableName === 'repairs' && (key === 'siteAddress')) {\n          continue;\n        }"
replacement = """if (tableName === 'repairs' && (key === 'siteAddress')) {
          continue;
        }
        if (tableName === 'customer_sites' && key in ['billingContactName', 'billingContactPhone', 'billingContactEmail', 'safetyContactName', 'safetyContactPhone', 'safetyContactEmail']) {
          continue;
        }"""

content = content.replace(target, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated db.ts properly")
