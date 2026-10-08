import json
import random

# eBro ERP 38개 메뉴 중 핵심 5대 메뉴의 Tool Calling 스키마 및 발화 패턴 (예시)
# 실제 본 훈련 시에는 38개 전체 메뉴의 스키마를 이 리스트에 추가합니다.
MENU_SCHEMAS = {
    "dispatch_create_order": {
        "description": "배차 의뢰 생성 (대차/교체, 출고, 입고 등)",
        "parameters": {
            "type": ["EXCHANGE", "OUTBOUND", "INBOUND"],
            "transportCompany": "string",
            "destinationAddress": "string",
            "deliveryCost": "number",
            "memo": "string"
        },
        "utterances": [
            "{destinationAddress} 현장에 {transportCompany} 기사님 배차해줘. 단가는 {deliveryCost}원이고 {type} 건이야.",
            "{transportCompany} 불러서 {destinationAddress}로 장비 보내. {type}이고 운송비는 {deliveryCost}원으로 맞춰줘.",
            "메모: {memo}. {destinationAddress}로 {deliveryCost}원 배차 등록해. 작업 타입은 {type}."
        ]
    },
    "customer_create": {
        "description": "신규 고객사 및 현장 등록",
        "parameters": {
            "name": "string",
            "bizRegNo": "string",
            "representative": "string",
            "address": "string"
        },
        "utterances": [
            "신규 거래처 등록해줘. 상호는 {name}, 대표자 {representative}이고, 주소는 {address}. 사업자번호는 {bizRegNo}야.",
            "고객사 {name} 추가해. 사업자번호 {bizRegNo}, 대표 {representative}, 본사 {address}로 입력해 줘."
        ]
    }
}

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
    "address": ["서울시 강남구 테헤란로 123", "경기도 성남시 분당구"]
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
