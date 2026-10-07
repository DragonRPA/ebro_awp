import re

filepath = 'src/pages/SiteOptionManage.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const optionToSave: StandardOption = {", "const optionToSave: any = {")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed TS error")
