import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/utils/menuSpecMarkdown.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    '''buttons: manual.annotations.map(a => ({ seq: a.seq, label: a.label, color: a.badgeColor })),''',
    '''buttons: (manual.basicGuide || manual.annotations || []).map(a => ({ seq: a.seq, label: a.label, color: a.badgeColor })),'''
)

with open('src/utils/menuSpecMarkdown.ts', 'w', encoding='utf-8') as f:
    f.write(text)
