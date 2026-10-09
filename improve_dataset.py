import json
import re
import random

SYSTEM_PROMPT = """너는 eBro 시스템의 업무 의도 파악 및 파라미터 추출 에이전트야.
사용자의 자연어 요청을 분석해서 아래 JSON 형식으로만 응답해:
{
  "intent": "파악된 업무 의도 (예: vacation_create, contract_create 등)",
  "parameters": {
    "추출된_변수명": "값"
  }
}
일반적인 대화나 설명은 일절 출력하지 말고 오직 JSON만 반환해."""

def improve_dataset():
    new_data = []
    
    # 1. Load ebro_38menu_dataset.jsonl
    with open('ebro_38menu_dataset.jsonl', 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            obj = json.loads(line)
            text = obj['text']
            
            # Extract user prompt
            user_match = re.search(r'<start_of_turn>user\n(.*?)<end_of_turn>', text, re.DOTALL)
            if not user_match: continue
            user_prompt = user_match.group(1).strip()
            
            # Remove any existing system prompt if someone added it before
            if SYSTEM_PROMPT in user_prompt:
                user_prompt = user_prompt.replace(SYSTEM_PROMPT, '').strip()
                
            # Extract json
            json_match = re.search(r'```json\n(.*?)\n```', text, re.DOTALL)
            if not json_match: continue
            try:
                parsed_json = json.loads(json_match.group(1))
            except:
                continue
                
            # Change 'action' to 'intent'
            if 'action' in parsed_json:
                parsed_json['intent'] = parsed_json.pop('action')
                
            # Format the new text
            new_text = f"<bos><start_of_turn>user\n{SYSTEM_PROMPT}\n\n{user_prompt}<end_of_turn>\n<start_of_turn>model\n```json\n{json.dumps(parsed_json, ensure_ascii=False, indent=2)}\n```<end_of_turn><eos>"
            
            new_data.append({'text': new_text})

    # 2. Add ebro_finetune_dataset.jsonl items as well
    with open('ebro-agent-core/ebro_finetune_dataset.jsonl', 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            obj = json.loads(line)
            instruction = obj.get('instruction', '')
            inp = obj.get('input', '')
            user_prompt = instruction
            if inp: user_prompt += f" {inp}"
            
            try:
                parsed_json = json.loads(obj.get('output', '{}'))
                if 'action' in parsed_json:
                    parsed_json['intent'] = parsed_json.pop('action')
                elif 'tool' in parsed_json:
                    parsed_json['intent'] = parsed_json.pop('tool')
                
                # ensure it has parameters
                if 'params' in parsed_json:
                    parsed_json['parameters'] = parsed_json.pop('params')
                if 'parameters' not in parsed_json:
                    parsed_json['parameters'] = {}
                    
                # clean up
                if 'thought' in parsed_json: del parsed_json['thought']
                if 'summary' in parsed_json: del parsed_json['summary']
                
                new_text = f"<bos><start_of_turn>user\n{SYSTEM_PROMPT}\n\n{user_prompt}<end_of_turn>\n<start_of_turn>model\n```json\n{json.dumps(parsed_json, ensure_ascii=False, indent=2)}\n```<end_of_turn><eos>"
                new_data.append({'text': new_text})
            except:
                continue
                
    # shuffle
    random.shuffle(new_data)
    
    with open('ebro_38menu_dataset.jsonl', 'w', encoding='utf-8') as f:
        for item in new_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
            
    print(f"Successfully improved dataset. Total examples: {len(new_data)}")

if __name__ == '__main__':
    improve_dataset()
