with open('src/pages/voice_dispatch.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('export default function SmartDispatch4()', 'export default function VoiceDispatch()')
text = text.replace('smart_dispatch4_active_tab', 'voice_dispatch_active_tab')
text = text.replace('출고 요청 (초안)', 'AI 통화음성 출고')

with open('src/pages/voice_dispatch.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
