import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/data/allMenuManuals.ts', 'r', encoding='utf-8') as f:
    text = f.read()

old_code = '''  return {
    pageId: manual.menuId,
    pageTitle: manual.menuName,
    version: manual.version || 1,
    basicGuide: manual.basicGuide || manual.annotations || [],
    processes: manual.processes || [],
    items: manual.annotations,
  };'''

new_code = '''  return {
    pageId: manual.menuId,
    pageTitle: manual.menuName,
    version: manual.version || 1,
    basicGuide: manual.annotations || manual.basicGuide || [],
    processes: manual.processes || [],
    items: manual.annotations,
  };'''

if old_code in text:
    text = text.replace(old_code, new_code)
    with open('src/data/allMenuManuals.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed getManualPageForMenu successfully!")
else:
    print("Code not found. Here is what is actually there:")
    idx = text.find('export function getManualPageForMenu')
    print(text[idx:idx+300])
