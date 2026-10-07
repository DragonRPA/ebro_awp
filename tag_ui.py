import os
import re

filepath = 'src/pages/TenantManagementPage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's tag the Tenant edit form.
# We will add data-hs-scope="tenant_edit_form"
target1 = r"""<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '20px' \}\}>"""
replacement1 = """<div data-hs-scope="tenant_edit_form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>"""

# Tag the Tenant Name input
target2 = r"""value=\{editingTenant\.tenantName\}"""
replacement2 = """value={editingTenant.tenantName} data-hs-observe="tenant_name" """

# Tag the Business No input
target3 = r"""value=\{editingTenant\.businessNo\}"""
replacement3 = """value={editingTenant.businessNo} data-hs-observe="business_no" """

# Tag the Rep Name input
target4 = r"""value=\{editingTenant\.repName\}"""
replacement4 = """value={editingTenant.repName} data-hs-observe="rep_name" """

# Tag the Save button
target5 = r"""onClick=\{saveTenant\}"""
replacement5 = """onClick={saveTenant} data-hs-trigger="TENANT_SAVE" """

content = re.sub(target1, replacement1, content)
content = re.sub(target2, replacement2, content)
content = re.sub(target3, replacement3, content)
content = re.sub(target4, replacement4, content)
content = re.sub(target5, replacement5, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated TenantManagementPage.tsx with tags")
