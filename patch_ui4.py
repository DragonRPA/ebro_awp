import json

with open('agent/studioEngine.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "async function parseInstructionIntent(instruction, requestedMode = 'AUTO') {"
end_marker = "return {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

new_logic = '''async function parseInstructionIntent(instruction, requestedMode = 'AUTO') {
  let detectedModule = 'GENERAL';
  let suggestedMode = requestedMode;
  let actionSummary = instruction;
  let ollamaUsed = false;
  let parameters = {};

  try {
    const payload = {
      model: 'ebro-agent',
      messages: [
        {
          role: "system",
          content: "너는 eBro 시스템의 업무 의도 파악 및 파라미터 추출 에이전트야.\\n사용자의 자연어 요청을 분석해서 아래 JSON 형식으로만 응답해:\\n{\\n  \\\"intent\\\": \\\"파악된 업무 의도 (예: vacation_create, contract_create 등)\\\",\\n  \\\"parameters\\\": {\\n    \\\"추출된_변수명\\\": \\\"값\\\"\\n  }\\n}\\n일반적인 대화나 설명은 일절 출력하지 말고 오직 JSON만 반환해."
        },
        {
          role: "user",
          content: instruction
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    };
    
    broadcastStudioLog('INFO', `LLM 호출 준비 완료: ${instruction}`);
    
    const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    
    const res = await response.json();
    broadcastStudioLog('INFO', `LLM 응답 수신 완료`);

    if (res && res.choices && res.choices.length > 0) {
      const content = res.choices[0].message.content;
      broadcastStudioLog('INFO', `LLM 원본 응답: ${content}`);
      
      const parsed = JSON.parse(content);
      if (parsed.intent) {
        detectedModule = parsed.intent.toUpperCase();
        parameters = parsed.parameters || {};
        ollamaUsed = true;
        actionSummary = `[AI 분석됨] 의도: ${parsed.intent}, 파라미터: ${JSON.stringify(parameters)}`;
        if (suggestedMode === 'AUTO') suggestedMode = 'DIRECT_QUERY';
      }
    }
  } catch (e) {
    console.error('LLM Inference Error:', e);
    broadcastStudioLog('ERROR', `LLM 추론 실패: ${e.message}`);
  }

  '''

content = content[:start_idx] + new_logic + content[end_idx:]

with open('agent/studioEngine.js', 'w', encoding='utf-8') as f:
    f.write(content)
