with open('src/components/LocalAiLoadingIndicator.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('width: \\%, backgroundColor: \'#10b981\',', 'width: f\"{progress}%\", backgroundColor: \'#10b981\',')
text = text.replace('f\"{progress}%\"', '${progress}%')

with open('src/components/LocalAiLoadingIndicator.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
