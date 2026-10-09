import json
import asyncio
import aiohttp
import time
import os
import re

SYSTEM_PROMPT = """너는 eBro 시스템의 업무 의도 파악 및 파라미터 추출 에이전트야.
사용자의 자연어 요청을 분석해서 아래 JSON 형식으로만 응답해:
{
  "intent": "파악된 업무 의도 (예: vacation_create, contract_create 등)",
  "parameters": {
    "추출된_변수명": "값"
  }
}
일반적인 대화나 설명은 일절 출력하지 말고 오직 JSON만 반환해."""

async def send_request(session, prompt, expected_intent, index):
    payload = {
        'model': 'ebro-agent',
        'messages': [
            {'role': 'user', 'content': f'{SYSTEM_PROMPT}\n\n{prompt}'}
        ],
        'response_format': {'type': 'json_object'},
        'temperature': 0.1
    }
    
    start_time = time.time()
    try:
        async with session.post('http://127.0.0.1:8080/v1/chat/completions', json=payload, timeout=20) as resp:
            data = await resp.json()
            content = data['choices'][0]['message']['content']
            latency = time.time() - start_time
            
            try:
                parsed = json.loads(content)
                actual_intent = parsed.get('intent', '').upper()
                if not actual_intent and 'action' in parsed:
                    actual_intent = parsed['action'].upper()
                    
                expected = expected_intent.upper()
                
                is_correct = (expected == actual_intent)
                return {
                    'index': index,
                    'prompt': prompt,
                    'expected': expected,
                    'actual': actual_intent,
                    'parsed_json': parsed,
                    'is_correct': is_correct,
                    'latency': latency,
                    'error': None
                }
            except json.JSONDecodeError:
                return {
                    'index': index,
                    'prompt': prompt,
                    'expected': expected_intent.upper(),
                    'actual': 'JSON_ERROR',
                    'parsed_json': content,
                    'is_correct': False,
                    'latency': latency,
                    'error': 'JSON Decode Error'
                }
    except Exception as e:
        return {
            'index': index,
            'prompt': prompt,
            'expected': expected_intent.upper(),
            'actual': 'API_ERROR',
            'parsed_json': None,
            'is_correct': False,
            'latency': time.time() - start_time,
            'error': str(e)
        }

async def main():
    dataset = []
    
    # Load ebro_38menu_dataset.jsonl (1000 items)
    try:
        with open('ebro_38menu_dataset.jsonl', 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                obj = json.loads(line)
                text = obj.get('text', '')
                
                # Extract user prompt
                user_match = re.search(r'<start_of_turn>user\n(.*?)<end_of_turn>', text, re.DOTALL)
                if not user_match: continue
                prompt = user_match.group(1).strip()
                
                # Extract expected JSON
                json_match = re.search(r'```json\n(.*?)\n```', text, re.DOTALL)
                if not json_match: continue
                expected_json_str = json_match.group(1)
                try:
                    expected_json = json.loads(expected_json_str)
                    expected_intent = expected_json.get('action', expected_json.get('intent', ''))
                    dataset.append({
                        'prompt': prompt,
                        'expected_intent': expected_intent
                    })
                except:
                    continue
    except Exception as e:
        print("Error loading ebro_38menu_dataset.jsonl:", e)

    # Load ebro_finetune_dataset.jsonl (up to 100 items to make it 1100)
    try:
        with open('ebro-agent-core/ebro_finetune_dataset.jsonl', 'r', encoding='utf-8') as f:
            for line in f:
                if len(dataset) >= 1100: break
                if not line.strip(): continue
                obj = json.loads(line)
                
                instruction = obj.get('instruction', '')
                inp = obj.get('input', '')
                prompt = instruction
                if inp: prompt += f" {inp}"
                
                out_str = obj.get('output', '')
                try:
                    out_json = json.loads(out_str)
                    expected_intent = out_json.get('action', out_json.get('intent', out_json.get('tool', '')))
                    dataset.append({
                        'prompt': prompt,
                        'expected_intent': expected_intent
                    })
                except:
                    continue
    except Exception as e:
        print("Error loading ebro_finetune_dataset.jsonl:", e)

    dataset = dataset[:1100]
    print(f"Total dataset loaded: {len(dataset)}")

    results = []
    correct_count = 0
    error_count = 0
    
    # Process sequentially or with small concurrency to not overwhelm llama-server
    concurrency = 4
    semaphore = asyncio.Semaphore(concurrency)
    
    async def bound_send(session, prompt, expected, idx):
        async with semaphore:
            return await send_request(session, prompt, expected, idx)

    start_time = time.time()
    
    with open('evaluation_log.jsonl', 'w', encoding='utf-8') as out_f:
        async with aiohttp.ClientSession() as session:
            tasks = []
            for i, item in enumerate(dataset):
                tasks.append(bound_send(session, item['prompt'], item['expected_intent'], i))
            
            # Use as_completed for progress tracking
            for i, future in enumerate(asyncio.as_completed(tasks)):
                res = await future
                results.append(res)
                
                out_f.write(json.dumps(res, ensure_ascii=False) + '\n')
                out_f.flush()
                
                if res['is_correct']:
                    correct_count += 1
                if res['error']:
                    error_count += 1
                
                if (i + 1) % 50 == 0 or (i + 1) == len(dataset):
                    acc = (correct_count / (i + 1)) * 100
                    print(f"Progress: {i+1}/{len(dataset)} | Accuracy: {acc:.2f}% | Errors: {error_count}")
                    
    total_time = time.time() - start_time
    final_acc = (correct_count / len(dataset)) * 100
    
    print("\n--- EVALUATION COMPLETE ---")
    print(f"Total Items: {len(dataset)}")
    print(f"Correct: {correct_count}")
    print(f"Incorrect: {len(dataset) - correct_count - error_count}")
    print(f"Errors: {error_count}")
    print(f"Accuracy: {final_acc:.2f}%")
    print(f"Total Time: {total_time:.2f} seconds")
    
    # Save a summary report
    summary = {
        'total': len(dataset),
        'correct': correct_count,
        'incorrect': len(dataset) - correct_count - error_count,
        'errors': error_count,
        'accuracy': final_acc,
        'total_time_seconds': total_time,
        'failed_cases': [r for r in results if not r['is_correct'] and not r['error']][:50] # save up to 50 failed cases
    }
    with open('evaluation_summary.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    asyncio.run(main())
