import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's remove elements that have label "폴더 일괄 등록" or "엑셀 일괄 등록"
# Often they are inside a JSON structure or JS array.
# For example: { "label": "폴더 일괄 등록", ... },
content = re.sub(r'\{[^{}]*["\']label["\']\s*:\s*["\'](폴더 일괄 등록|엑셀 일괄 등록)["\'][^{}]*\},\s*', '', content)

# Check if there are any raw mentions remaining
content = re.sub(r'\n\s*["\'][^"\']*(?:폴더 일괄 등록|엑셀 일괄 등록)[^"\']*["\'],?', '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed manual references")
