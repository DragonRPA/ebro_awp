import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/agent-bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

# '환경설정' in unicode escape is \uD658\uACBD\uC124\uC815
idx = text.find('\uD658\uACBD\uC124\uC815')
if idx != -1:
    print('Found unicode string!')
else:
    print('Not found unicode string')
