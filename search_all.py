import sys
import io
import glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

for filepath in glob.glob('docs/*.md') + glob.glob('*.md'):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
            if '신규고객등록' in text or '초성검색' in text or '현장 옵션' in text or 'AI 통화음성' in text:
                print(f"Found in {filepath}")
    except Exception as e:
        pass
