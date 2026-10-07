import json
import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Try to find '현장 삭제' and remove it
if '현장 삭제' in content:
    print("Found '현장 삭제'")
else:
    print("Not found '현장 삭제'")
    
if '현장 옵션' in content:
    print("Found '현장 옵션'")
else:
    print("Not found '현장 옵션'")
