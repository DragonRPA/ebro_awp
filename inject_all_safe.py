import os
import re

pages_dir = 'src/pages'
files = [f for f in os.listdir(pages_dir) if f.endswith('.tsx')]

def inject_tags(filepath, filename):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    observe_id = filename.replace('.tsx', '').lower()
    
    # 1. Inject Observer into the primary return div safely
    # find first occurrence of `return (` followed by `<div`
    # We want to replace `<div` with `<div data-hs-observe="{observe_id}"`
    return_match = re.search(r'return\s*\(\s*<div', content)
    if return_match:
        idx = return_match.end() - 4 # points to '<div'
        div_tag_end = content.find('>', idx)
        if div_tag_end != -1:
            div_tag = content[idx:div_tag_end]
            if 'data-hs-observe' not in div_tag:
                content = content[:idx] + f'<div data-hs-observe="{observe_id}"' + div_tag[4:] + content[div_tag_end:]
    
    # 2. Inject triggers based on button text ONLY
    parts = content.split('<button')
    for i in range(1, len(parts)):
        part = parts[i]
        close_idx = part.find('>')
        if close_idx != -1:
            end_btn = part.find('</button>', close_idx)
            if end_btn != -1:
                btn_text = part[close_idx+1:end_btn]
                if any(x in btn_text for x in ['저장', '등록', '승인', '확인', '삭제', '처리', '적용', '결재']):
                    if 'data-hs-trigger' not in part[:close_idx]:
                        trigger_name = "Action"
                        if '저장' in btn_text: trigger_name = "Save"
                        elif '등록' in btn_text: trigger_name = "Register"
                        elif '승인' in btn_text: trigger_name = "Approve"
                        elif '삭제' in btn_text: trigger_name = "Delete"
                        elif '처리' in btn_text: trigger_name = "Process"
                        elif '결재' in btn_text: trigger_name = "Approve"
                        elif '확인' in btn_text: trigger_name = "Confirm"
                        elif '적용' in btn_text: trigger_name = "Apply"
                        
                        parts[i] = f' data-hs-trigger="{trigger_name}"' + part
    
    content = '<button'.join(parts)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

modified_count = 0
for file in files:
    filepath = os.path.join(pages_dir, file)
    if inject_tags(filepath, file):
        modified_count += 1

print(f"Successfully injected tags into {modified_count} files.")
