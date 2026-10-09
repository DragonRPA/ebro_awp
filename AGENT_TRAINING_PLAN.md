# eBro AI 에이전트 훈련 및 데이터셋 구축 계획 (AGENT_TRAINING_PLAN.md)

## 1. 훈련 목표
- **목적**: 사용자의 자연어 요청을 분석하여 eBro 시스템의 13개 핵심 업무 의도(Intent)와 파라미터를 정확히 추출하는 로컬 LLM 에이전트(Gemma-4 기반) 파인튜닝.
- **성공 기준**: 테스트 데이터셋 기준 의도 파악 정확도 95% 이상 달성.

## 2. 과거 실패 사례 및 교훈 (2026-10-09)
이전 훈련에서 약 14시간의 파인튜닝을 진행했음에도 정확도가 10~12%대에 머물렀던 치명적인 원인이 발견되었습니다.

### 🛑 실패 원인: 시스템 프롬프트의 모호성으로 인한 '환각(Hallucination)' 유발
- **문제점**: 훈련 데이터셋의 시스템 프롬프트에 `"(예: vacation_create, contract_create 등)"` 이라고만 명시되어 있었습니다.
- **결과**: Gemma-4와 같이 지시 따르기(Instruction Following) 능력이 뛰어난 똑똑한 모델일수록, 시스템 프롬프트의 지시를 최우선으로 따르려 합니다. 그 결과, 훈련 데이터에서 정답으로 `customer_create`를 수천 번 학습했음에도 불구하고, 실전에서 모호한 프롬프트를 보자 **"아, 정해진 단어(customer_create)를 그대로 쓰는 게 아니라, 내 마음대로 영어 단어(vendor_create, search_client_list 등)를 문맥에 맞게 조합해서 만들어 내라는 거구나!"** 라고 오판하여 '환각(Hallucination)'을 일으켰습니다.

## 3. 데이터셋 구축 및 시스템 프롬프트 작성 지침 (필수 반영)

향후 재훈련을 위한 데이터셋 구축 및 시스템 프롬프트 작성 시 **반드시 아래 지침을 준수하여 데이터셋을 명시적으로 생성**해야 합니다.

### ✅ 해결 방안: 허용된 모든 Intent의 명시적 나열
시스템 프롬프트에 eBro 시스템이 사용하는 정확한 13개의 업무 의도 목록을 모두 추출하여 명시적으로 박아두어야 합니다. 이렇게 하면 모델은 스스로 영어 단어를 지어내지 않고, 반드시 정해진 13개 중에서만 정답을 고르게 됩니다.

**[올바른 시스템 프롬프트 예시]**
```text
너는 eBro 시스템의 업무 의도 파악 및 파라미터 추출 에이전트야.
사용자의 자연어 요청을 분석해서 아래 JSON 형식으로만 응답해:
{
  "intent": "파악된 업무 의도. 반드시 다음 중 하나만 선택해: [asset_search, billing_request_create, click_element, contract_create, customer_create, customer_search, dispatch_assign_driver, dispatch_create_order, maintenance_create, navigate_menu, pdi_approve, site_option_update, vacation_create]",
  "parameters": {
    "추출된_변수명": "값"
  }
}
일반적인 대화나 설명은 일절 출력하지 말고 오직 JSON만 반환해.
```

### 💡 훈련 데이터셋(JSONL) 포맷 룰
1. **역할(Role) 일치**: 훈련 데이터의 입력 포맷은 실전 인퍼런스 서버(llama-server)가 렌더링하는 포맷과 완벽히 일치해야 합니다. (System Role과 User Role의 분리 여부 100% 동일화)
2. **Key 일치**: 훈련 데이터의 정답 JSON Key는 반드시 `intent` 로 통일해야 합니다. (과거 `action` 혼용 금지)
3. **명시성**: 데이터셋 생성 스크립트(`improve_dataset.py` 등)를 짤 때, 위에서 확정한 13개의 리스트가 포함된 '올바른 시스템 프롬프트'를 모든 훈련 Row에 공통으로 주입해야 합니다.
