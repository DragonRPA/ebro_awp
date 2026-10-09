import re

with open('agent/studioEngine.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_logic = '''async function parseInstructionIntent(instruction, requestedMode = 'AUTO') {
  const ollama = await checkOllamaStatus();
  
  let detectedModule = 'GENERAL';
  let suggestedMode = requestedMode;
  let actionSummary = instruction;
  let ollamaUsed = false;
  let parameters = {};

  if (ollama && ollama.available) {
    try {
      const payload = {
        model: ollama.model,
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
      
      const res = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port: 8080,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }, response => {
          let body = '';
          response.on('data', chunk => body += chunk);
          response.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(JSON.stringify(payload));
        req.end();
      });

      if (res && res.choices && res.choices.length > 0) {
        const content = res.choices[0].message.content;
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
    }
  }

  // Fallback
  if (!ollamaUsed) {
'''

# Find the start of the function and the start of the if/else regex block
content = re.sub(r"async function parseInstructionIntent.*?if \(\/\(.*?\)\.test\(instruction\)\) \{", new_logic + "    if (/(배차|운송|기사|화물|차량|상차|하차)/.test(instruction)) {", content, flags=re.DOTALL)

# Add the parameters field to the return object
content = content.replace("ollamaUsed: false", "ollamaUsed: ollamaUsed,\n      parameters: parameters")

with open('agent/studioEngine.js', 'w', encoding='utf-8') as f:
    f.write(content)
