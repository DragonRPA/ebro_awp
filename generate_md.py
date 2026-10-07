import os, re

res = {}

for root, _, files in os.walk('src'):
    for file in files:
        if not file.endswith('.tsx') and not file.endswith('.ts'):
            continue
        path = os.path.join(root, file)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            observes = list(set(re.findall(r'data-hs-observe=["\']([^"\']+)["\']', content)))
            scopes = list(set(re.findall(r'data-hs-scope=["\']([^"\']+)["\']', content)))
            triggers = list(set(re.findall(r'data-hs-trigger=["\']([^"\']+)["\']', content)))
            
            if observes or scopes or triggers:
                res[file] = {
                    'observes': observes,
                    'scopes': scopes,
                    'triggers': triggers
                }
        except Exception as e:
            pass

lines = ["# AWP ERP Hindsight Tracker (AI 학습용 UI 감시 요소) 현황\n"]
lines.append("이 문서는 각 메뉴(화면)별로 AI가 작업 지식을 누적하기 위해 어떤 영역을 관찰(`data-hs-observe`, `data-hs-scope`)하고, 어떤 버튼(`data-hs-trigger`)을 클릭할 때 저장되도록 설정되어 있는지 전체 목록을 보여줍니다.\n\n")

for file, data in sorted(res.items()):
    lines.append(f"## 📄 `{file}`\n")
    
    if data['observes']:
        lines.append("- **👀 관찰 대상 전체 범위 (Observe)**:\n")
        for o in data['observes']:
            lines.append(f"  - `{o}`\n")
            
    if data['scopes']:
        lines.append("- **🎯 관찰 세부 스코프 (Scope)**:\n")
        for s in data['scopes']:
            lines.append(f"  - `{s}`\n")
            
    if data['triggers']:
        lines.append("- **⚡ 작업 저장 트리거 버튼 (Trigger)**:\n")
        for t in data['triggers']:
            lines.append(f"  - `{t}`\n")
            
    lines.append("\n")

out_path = r"C:\Users\이정용\.gemini\antigravity\brain\f4b14b4f-169b-4e36-9c36-e42dd3680e74\hindsight-ui-elements.md"
with open(out_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Markdown artifact generated at:", out_path)
