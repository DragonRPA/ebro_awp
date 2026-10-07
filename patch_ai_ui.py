import os
import re

with open('src/pages/AgenticDispatchStudioPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('import { Play, Sparkles, Send, MapPin, Truck, ChevronRight } from \'lucide-react\';', 
                    'import { Play, Sparkles, Send, MapPin, Truck, ChevronRight } from \'lucide-react\';\nimport { LocalAiLoadingIndicator } from \'../components/LocalAiLoadingIndicator\';')

# Insert before the dispatch queue
text = text.replace('{dispatchQueue.length === 0 && (', '<LocalAiLoadingIndicator isVisible={loading} />\n          {dispatchQueue.length === 0 && (')

# Remove the old text status that mentions 5~15 seconds to avoid duplication
text = text.replace('setStatusMessage(\'아직 AI가 명령을 분석하고 약 2~3 단계를 수행중입니다... (첫 로딩 시 모델 불러오느라 5~15초 정도 소요될 수 있습니다)\');', 'setStatusMessage(\'AI 에이전트가 로컬 모델 기반으로 작업을 분석 및 수행 중입니다...\');')

with open('src/pages/AgenticDispatchStudioPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

with open('src/pages/AgenticAiLabPage.tsx', 'r', encoding='utf-8') as f:
    text2 = f.read()

if 'import { LocalAiLoadingIndicator }' not in text2:
    text2 = text2.replace('import { Search, BrainCircuit, RefreshCw, Play, MessageSquare, ListTodo, Send, Copy, Check } from \'lucide-react\';',
                          'import { Search, BrainCircuit, RefreshCw, Play, MessageSquare, ListTodo, Send, Copy, Check } from \'lucide-react\';\nimport { LocalAiLoadingIndicator } from \'../components/LocalAiLoadingIndicator\';')
    
    text2 = text2.replace('<div style={{ display: \'flex\', flexDirection: \'column\', gap: \'12px\' }}>', 
                          '<LocalAiLoadingIndicator isVisible={isRunning} />\n            <div style={{ display: \'flex\', flexDirection: \'column\', gap: \'12px\' }}>')

with open('src/pages/AgenticAiLabPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text2)

