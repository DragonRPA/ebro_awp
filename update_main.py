import os
import re

filepath = 'src/main.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

if 'initializeHindsightTracker' not in content:
    target = r"""import App from './App.tsx'"""
    replacement = """import App from './App.tsx'\nimport { initializeHindsightTracker } from './utils/hindsightTracker'"""
    content = re.sub(target, replacement, content)
    
    target2 = r"""ReactDOM.createRoot\(document.getElementById\('root'\)!\).render\("""
    replacement2 = """// Hindsight AI 스텔스 메모리 트래커 초기화\ninitializeHindsightTracker();\n\nReactDOM.createRoot(document.getElementById('root')!).render("""
    content = re.sub(target2, replacement2, content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated main.tsx")
else:
    print("Already updated main.tsx")
