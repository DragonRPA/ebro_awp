import re

with open('agent/studioEngine.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add logging for parameters in executeTask
patch = '''task.status = 'RUNNING';
      task.progress = 10;
      task.currentStep = '1단계: 자연어 업무 의도 분석 및 도메인 엔티티 식별';
      
      const intentResult = await parseInstructionIntent(task.instruction, task.mode);
      task.module = intentResult.module;
      
      appendTaskLog(task, `작업 시작 (모드: ${task.mode}, 도메인/의도: ${task.module})`);
      if (intentResult.parameters && Object.keys(intentResult.parameters).length > 0) {
        appendTaskLog(task, `[AI 추출 파라미터] ${JSON.stringify(intentResult.parameters)}`);
      }'''

content = re.sub(r"task\.status = 'RUNNING';.*?appendTaskLog\(task, `.*?`\);", patch, content, flags=re.DOTALL)

with open('agent/studioEngine.js', 'w', encoding='utf-8') as f:
    f.write(content)
