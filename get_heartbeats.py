import json
with open('src/pages/TenantManagementPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
for i, line in enumerate(lines):
    if 'tenantHeartbeats' in line:
        print(f"Line {i+1}: {line.strip()}")
