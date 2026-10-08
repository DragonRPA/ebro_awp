import json
import random

# eBro ERP 핵심 액션 스키마 로드
with open("ebro_core_actions.json", "r", encoding="utf-8") as f:
    MENU_SCHEMAS = json.load(f)

# 랜덤 데이터 생성용 더미 사전
DUMMY_DATA = {
    "destinationAddress": ["삼성전기 수원현장", "SK하이닉스 이천공장", "판교 카카오 신사옥", "평택 고덕 2공장"],
    "transportCompany": ["호남고속화물", "전국24시콜화물", "로지스틱스K", "기연직영트럭"],
    "type": ["EXCHANGE", "OUTBOUND"],
    "deliveryCost": [140000, 60000, 200000, 150000],
    "memo": ["S-45 고장 대차", "신규 출고건", "VIP 고객 빠른 배송 요망"],
    "name": ["(주)가나건설", "에이텍엔지니어링", "비젼테크"],
    "bizRegNo": ["123-45-67890", "234-56-78901", "345-67-89012"],
    "representative": ["김대표", "이사장", "박소장"],
    "address": ["서울시 강남구 테헤란로 123", "경기도 성남시 분당구"],
    "customerName": ["(주)가나건설", "에이텍엔지니어링"],
    "siteName": ["수원현장", "이천공장", "판교현장"],
    "options": ["협착방지대", "안전센서", "무논마스킹", "방폭작업"],
    "model": ["SJ-3219", "GS-1930", "S-45", "Z-45"],
    "quantity": [1, 2, 5, 10],
    "unitPrice": [30000, 45000, 150000],
    "startDate": ["2026-10-10", "2026-10-15", "다음주 월요일"],
    "endDate": ["2026-11-10", "1개월 뒤", "종료일 미정"],
    "billingMonth": ["10", "11", "9"],
    "amount": [1500000, 3000000, 450000],
    "orderId": ["ORD-2610-001", "ORD-2610-002"],
    "driverName": ["김철수", "박기사", "최운송"],
    "driverPhone": ["010-1234-5678", "010-9876-5432"],
    "truckNumber": ["경기80바1234", "서울99사9876"],
    "assetNumber": ["G-1001", "G-1002", "S-45-001"],
    "inspectorName": ["이대리", "김과장"],
    "isPassed": ["true", "false"],
    "mechanicName": ["정비팀장", "박주임"],
    "repairDetails": ["모터 소손 교체", "유압 호스 누유 수리", "배터리 방전 교체"],
    "partsUsed": ["컨트롤러 Assy", "24V 딥사이클 배터리", "O링"],
    "keyword": ["SJ-3219", "G-1001", "가나건설"],
    "status": ["임대가능", "대여중", "수리중"],
    "query": ["가나건설", "123-45", "김대표"],
    "employeeName": ["김철수", "박영희", "이과장", "최사원"],
    "vacationType": ["연차", "오전반차", "오후반차", "경조휴가"],
    "reason": ["개인 사정", "집안 행사", "병원 진료", "가족 여행"]
}

def generate_synthetic_data(num_samples=100):
    dataset = []
    
    for _ in range(num_samples):
        # 38개 메뉴 중 하나를 랜덤으로 선택
        action_name = random.choice(list(MENU_SCHEMAS.keys()))
        schema = MENU_SCHEMAS[action_name]
        
        # 발화 패턴 랜덤 선택
        utterance_template = random.choice(schema["utterances"])
        
        # 파라미터 랜덤 채우기
        filled_params = {}
        utterance = utterance_template
        
        for param_key in schema["parameters"].keys():
            if "{" + param_key + "}" in utterance_template:
                val = random.choice(DUMMY_DATA[param_key])
                utterance = utterance.replace("{" + param_key + "}", str(val))
                filled_params[param_key] = val
        
        # 프롬프트 포맷 (Gemma 4 E4B Chat 포맷)
        # 자연어 -> JSON 파싱
        prompt = f"<bos><start_of_turn>user\n{utterance}<end_of_turn>\n"
        
        json_output = {
            "action": action_name,
            "parameters": filled_params
        }
        
        response = f"<start_of_turn>model\n```json\n{json.dumps(json_output, ensure_ascii=False, indent=2)}\n```<end_of_turn><eos>"
        
        dataset.append({"text": prompt + response})
        
    return dataset

def main():
    output_file = "ebro_38menu_dataset.jsonl"
    print(f"eBro ERP 38개 메뉴 기반 훈련 데이터 생성 중...")
    
    # 예시로 1000개의 다채로운 자연어-JSON 데이터 생성
    samples = generate_synthetic_data(1000)
    
    with open(output_file, "w", encoding="utf-8") as f:
        for sample in samples:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")
            
    print(f"✅ 총 {len(samples)}개의 고품질 Text-to-JSON 훈련 데이터가 [{output_file}]에 생성되었습니다!")
    print("이제 이 데이터셋으로 본 훈련(Main Training)을 돌리면 완벽한 Web Agent 라우터가 탄생합니다.")

if __name__ == "__main__":
    main()
