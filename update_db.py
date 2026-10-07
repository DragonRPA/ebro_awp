import os
import re

filepath = 'src/services/db.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = r"""        if \(tableName === 'repairs' && \(key === 'siteAddress'\)\) \{
          continue;
        \}"""

replacement = """        if (tableName === 'repairs' && (key === 'siteAddress')) {
          continue;
        }
        // DB customer_sites 스키마 불일치 방어
        if (tableName === 'customer_sites' && key in ['billingContactName', 'billingContactPhone', 'billingContactEmail', 'safetyContactName', 'safetyContactPhone', 'safetyContactEmail']) {
          continue;
        }"""

content = re.sub(target, replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated db.ts")
