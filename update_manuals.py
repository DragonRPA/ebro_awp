import os
import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# I want to add "고객사 삭제 (오입력 방지 프롬프트 적용)" to CustomerManage manual's keyActions or cognitiveSequence.
# First, let's find the customer menu. Usually it's menuId: 'customer' or similar.
match = re.search(r"menuId:\s*'customer_manage'.*?keyActions:\s*\[([^\]]+)\]", content, re.DOTALL)
if match:
    actions = match.group(1)
    if '고객사 삭제' not in actions:
        new_actions = actions.rstrip() + ",\n            \"고객사 삭제 (안전 프롬프트 검증)\""
        content = content.replace(actions, new_actions)
        print("Added to keyActions of customer_manage")
else:
    # fallback: try just searching for '고객사 정보 수정'
    pass

# We can just replace the cognitiveSequence of Customer menu
target = '"3. 고객사 등록 및 고객사 정보 수정"'
replacement = '"3. 고객사 등록 및 고객사 정보 수정",\n        "4. 고객사 삭제 (실수 방지를 위해 \'고객사명 삭제\' 직접 입력 검증 수행)"'
content = content.replace(target, replacement)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated allMenuManuals.ts")
