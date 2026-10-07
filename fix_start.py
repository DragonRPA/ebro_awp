import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/studioEngine.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_start = '''startTelegramBot(async (text, onComplete) => {
  return await addTask(text, 'BROWSER', onComplete);
});'''

new_start = '''if (isAiEnabled()) {
  startTelegramBot(async (text, onComplete) => {
    return await addTask(text, 'BROWSER', onComplete);
  });
}'''

if old_start in text:
    text = text.replace(old_start, new_start)
    with open('agent/studioEngine.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed startTelegramBot successfully!")
else:
    print("startTelegramBot not found.")

