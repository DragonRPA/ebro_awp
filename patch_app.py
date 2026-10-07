with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import_stmt = "import { VoiceDispatch } from './pages/voice_dispatch';\n"
if 'VoiceDispatch' not in text:
    text = text.replace("import { SmartDispatch4 } from './pages/smart_dispatch4';", "import { SmartDispatch4 } from './pages/smart_dispatch4';\n" + import_stmt)

menu_item = "          { id: 'voice_dispatch', name: 'AI 통화음성 출고(개발중)', icon: <Mic size={16} />, component: <VoiceDispatch /> },\n"
if 'voice_dispatch' not in text:
    text = text.replace("          { id: 'smart_dispatch4', name: '출고 요청', icon: <Zap size={16} />, component: <SmartDispatch4 /> },", "          { id: 'smart_dispatch4', name: '출고 요청', icon: <Zap size={16} />, component: <SmartDispatch4 /> },\n" + menu_item)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
