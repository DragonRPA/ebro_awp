/**
 * scripts/generate_ai_training_data.cjs
 * eBro ERP 전사 57개 메뉴 기능정의서 기반 AI 지식 베이스 및 파인튜닝 데이터셋 자동 생성기
 */

const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// 1. allMenuManuals.ts 로드 및 트랜스파일
const manualTsPath = path.resolve(__dirname, '../src/data/allMenuManuals.ts');
const code = fs.readFileSync(manualTsPath, 'utf8');
const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
const fn = new Function('module', 'exports', 'require', js);
fn(mod, mod.exports, require);
const manuals = mod.exports.ALL_MENU_MANUALS || [];

console.log(`📖 로드된 메뉴 기능정의서: 총 ${manuals.length}개 메뉴`);

// 2. ebro_menu_knowledge.json (경량 지식 베이스 생성)
const knowledgeBase = {};
const finetuneSamples = [];

manuals.forEach(m => {
  const buttons = (m.annotations || []).map(a => a.label || a.title || '').filter(Boolean);
  const modals = (m.modalWorkflows || []).map(mw => ({
    name: mw.modalName,
    trigger: mw.triggerButton,
    action: mw.terminalAction
  }));
  const subTabs = (m.subTabs || []).map(t => ({ id: t.tabId, name: t.tabName, purpose: t.purpose }));

  // 지식 베이스 항목
  knowledgeBase[m.menuId] = {
    menuId: m.menuId,
    menuName: m.menuName,
    group: m.groupName,
    dept: m.department,
    archetype: m.archetype,
    objective: m.objective,
    scope: m.scopeInfo,
    steps: m.cognitiveSequence,
    buttons: buttons.slice(0, 15),
    subTabs: subTabs,
    modals: modals,
    rules: m.rulesCompliance || [],
    precautions: m.precautions || []
  };

  // 3. 파인튜닝 데이터셋 합성 (메뉴당 3~6개 질의응답 샘플 생성)
  // 샘플 A: 메뉴 진입 및 이동 지시
  finetuneSamples.push({
    instruction: `${m.menuName} 화면으로 이동해줘.`,
    input: "현재 위치: 대시보드 (dashboard)",
    output: JSON.stringify({
      thought: `사용자가 ${m.menuName} 업무를 시작하고자 하므로 menuId='${m.menuId}'로 전환한다.`,
      tool: "navigate_menu",
      params: { menuId: m.menuId }
    }, null, 2)
  });

  // 샘플 B: 업무 목적 및 처리 방법 질문
  finetuneSamples.push({
    instruction: `${m.menuName}의 업무 목적과 기본 조작 순서는 어떻게 됩니까?`,
    input: `메뉴 식별자: ${m.menuId}`,
    output: JSON.stringify({
      thought: `${m.menuName} 기능정의서에 기반하여 업무 목적과 조작 동선을 브리핑한다.`,
      summary: `[${m.menuName}] 업무 목적: ${m.objective}\n표준 조작 순서:\n${(m.cognitiveSequence || []).map((s, i) => `${i+1}. ${s}`).join('\n')}`
    }, null, 2)
  });

  // 샘플 C: 버튼 조작 지시
  if (buttons.length > 0) {
    const mainBtn = buttons[0];
    finetuneSamples.push({
      instruction: `${m.menuName}에서 ${mainBtn} 버튼 눌러줘.`,
      input: `현재 위치: ${m.menuName} (${m.menuId}), 노출 버튼: [${buttons.join(', ')}]`,
      output: JSON.stringify({
        thought: `${m.menuName} 화면에서 사용자가 요청한 '${mainBtn}' 요소를 찾아 클릭한다.`,
        tool: "click_element",
        params: { target: mainBtn }
      }, null, 2)
    });
  }

  // 샘플 D: 하위 탭 또는 모달 조작
  if (subTabs.length > 0) {
    const tab = subTabs[0];
    finetuneSamples.push({
      instruction: `${m.menuName}에서 ${tab.name} 탭 열어줘.`,
      input: `현재 위치: ${m.menuName} (${m.menuId}), 하위 탭: ${subTabs.map(t => t.name).join(', ')}`,
      output: JSON.stringify({
        thought: `하위 탭 '${tab.name}'을 선택하여 목적(${tab.purpose})에 맞는 화면을 띄운다.`,
        tool: "click_element",
        params: { target: tab.name }
      }, null, 2)
    });
  }
});

// 파일 저장 대상 디렉토리
const coreDir = path.resolve(__dirname, '../ebro-agent-core');
if (!fs.existsSync(coreDir)) fs.mkdirSync(coreDir, { recursive: true });

// 1. JSON 지식 베이스 저장
const kbPath = path.join(coreDir, 'ebro_menu_knowledge.json');
fs.writeFileSync(kbPath, JSON.stringify(knowledgeBase, null, 2), 'utf8');
console.log(`✅ [1/3] ebro_menu_knowledge.json 생성 완료 (${Object.keys(knowledgeBase).length}개 메뉴 지식)`);

// 2. 파인튜닝 JSONL 저장
const jsonlPath = path.join(coreDir, 'ebro_finetune_dataset.jsonl');
const jsonlLines = finetuneSamples.map(s => JSON.stringify(s, { ensure_ascii: false })).join('\n');
fs.writeFileSync(jsonlPath, jsonlLines, 'utf8');
console.log(`✅ [2/3] ebro_finetune_dataset.jsonl 생성 완료 (${finetuneSamples.length}개 학습 샘플)`);

// 3. Ollama Modelfile 생성
const modelfileContent = `# Ollama Modelfile for eBro ERP Specialized AI Agent
FROM qwen2.5-3b-tuned_v1:latest

PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER stop "<|im_end|>"
PARAMETER stop "<|endoftext|>"

SYSTEM """당신은 eBro ERP의 전사 57개 메뉴를 완벽히 숙지한 전문 AI 에이전트 'ebro web agent'의 두뇌입니다.
사용자의 자연어 업무 지시를 분석하여 아래 JSON 규격의 단일 Tool Call만을 응답하십시오.

[핵심 도구 규격]
1. {"tool": "navigate_menu", "params": {"menuId": "..."}}
2. {"tool": "click_element", "params": {"target": "..."}}
3. {"tool": "type_text", "params": {"target": "...", "text": "...", "pressEnter": true/false}}
4. {"tool": "get_page_content", "params": {}}
5. {"tool": "read_table", "params": {"selector": "table"}}
6. {"tool": "toggle_som", "params": {"enable": true/false}}
7. {"tool": "finish_task", "params": {"summary": "..."}}

전사 시스템 개발 표준 헌장을 준수하여 감성적 수식어를 배제하고, 결정론적이며 안전하게 업무를 수행하십시오.
"""
`;

const modelfilePath = path.join(coreDir, 'Modelfile');
fs.writeFileSync(modelfilePath, modelfileContent, 'utf8');
console.log(`✅ [3/3] Ollama Modelfile 생성 완료 (${modelfilePath})`);

console.log('🎉 AI 지식 베이스 및 훈련 데이터셋 구축 완료!');
