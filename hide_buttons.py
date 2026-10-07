import re

filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add `const isDeveloper = ...` right below `const canSave = hasPermission('customer', 'save');`
inject_point = content.find("const canSave = hasPermission('customer', 'save');")
if inject_point != -1:
    inject_point += len("const canSave = hasPermission('customer', 'save');")
    inject_code = "\n  const isDeveloper = currentUser?.id === 'sys-admin' || currentUser?.id === 'u-1' || currentUser?.loginId === 'admin' || currentUser?.position === 'D.RPA' || currentUser?.department?.includes('개발');"
    content = content[:inject_point] + inject_code + content[inject_point:]
    
    # Now replace the condition for the buttons
    # Button 1: <FolderOpen size={13} color="#ffffff" /> 폴더 일괄 등록
    # It might be `{canSave && ( ... 폴더 일괄 등록 ... )}`
    # Button 2: <FileSpreadsheet size={13} color="var(--primary)" /> 엑셀 일괄 등록
    
    # We will just replace `{canSave && (` with `{canSave && isDeveloper && (` around those specific buttons.
    # Since regex is tricky across multiple lines, let's just find the string "FolderOpen size={13}" and go back to find `{canSave && (`
    
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "FolderOpen size={13}" in line or "FileSpreadsheet size={13}" in line:
            # Go backwards to find `{canSave && (`
            for j in range(i, i-10, -1):
                if "{canSave && (" in lines[j]:
                    lines[j] = lines[j].replace("{canSave && (", "{canSave && isDeveloper && (")
                    break
    
    content = '\n'.join(lines)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected isDeveloper and hid buttons")
else:
    print("Could not find canSave")
