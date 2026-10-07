import re

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "setShowBatchLicenseModal(true)" in line:
        # Go up 10 lines
        for j in range(i, i-15, -1):
            if "{canSave && (" in lines[j]:
                lines[j] = lines[j].replace("{canSave && (", "{canSave && isDeveloper && (")
                break
    
    if "setCustExcelModalOpen(true)" in line:
        for j in range(i, i-15, -1):
            if "{canSave && (" in lines[j]:
                lines[j] = lines[j].replace("{canSave && (", "{canSave && isDeveloper && (")
                break

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Updated conditions")
