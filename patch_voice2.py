with open('src/pages/voice_dispatch.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('SmartDispatch4', 'VoiceDispatch')

with open('src/pages/voice_dispatch.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
