# ebro-qwen:3b 재훈련 절차 및 성공판정

- 작성일: 2026-10-04 (개정: 사용자 PC 조건과 데이터셋 재사용 검토 반영)
- 대상 모델명: `ebro-qwen:3b` (이름 유지, 가중치 전면 교체)
- 베이스 모델: `Qwen/Qwen2.5-3B-Instruct` 원본에서 새로 학습 (기존 학습 결과 위에 덧씌우지 않음)
- 학습 환경: `D:\01.AntiGravity\FineTune_Studio`, RTX 5080 Laptop 16GB
- **배포 환경: GPU 없음, RAM 최대 16GB, i5급 CPU** (`ai_erp_pc.md` 6장 전제와 동일)
- 배포 형식: **GGUF Q4_K_M, 컨텍스트 4,096** (F16 등록 금지)
- 사용처: `eBro/ebro-agent-core/ai_brain.py` (`DEFAULT_MODEL = "ebro-qwen:3b"`), 텔레그램 봇, 웹 확장 에이전트

---

## 1. 판단 요약

| 질문 | 판단 | 근거 |
|---|---|---|
| 훈련 데이터셋을 다시 만드는가 | **다시 만든다.** 기존 파일은 학습 데이터로 재사용하지 않는다. 밴드 대화 원문(입력)만 정제해 재활용한다 | 2장 |
| 양자화를 적용하는가 | **필수.** 정확도를 높이는 수단은 아니고, 사용자 PC에서 구동하기 위한 조건이다 | 3장 |
| 양자화 수준 | **Q4_K_M.** Q8_0과 F16은 사용자 PC에 부적합 | 3장 |
| 모델이 하는 일 | **짧은 출력의 분류와 값 추출만.** 긴 문장 생성은 코드가 담당 | 4장 |

---

## 2. 기존 자료 검토 결과 (재사용 판정)

### 2.1 실측 근거

| 번호 | 측정 항목 | 결과 | 측정 방법 |
|---|---|---|---|
| E1 | 밴드 학습 데이터 720건 중 입력 원문에 없는 이메일이 정답에 있는 건 | 513건 (71%) | 전수 검사 |
| E2 | 같은 데이터에서 입력에 없는 전화번호가 정답에 있는 건 | 148건 (21%) | 전수 검사 |
| E3 | 현재 모델이 검증 30건에서 입력에 없는 값을 출력한 건 | 23건 (이메일 23, 청구담당 4) | 현행 모델 직접 추론 |
| E4 | 메뉴 기능정의서(57개 메뉴) 버튼 426개 중 실제 UI 소스에 같은 문자열이 있는 것 | 120개 (28.2%) | `src`에서 매뉴얼 데이터 파일을 제외하고 문자열 검색 |
| E5 | 기존 학습셋 200건의 `click_element` 대상 86개 중 실제 UI 소스에 있는 것 | 17개 (19.8%) | 같은 방법 |
| E6 | 기존 학습셋 200건의 구성 | 이동 57 / 목적 설명 57 / 버튼 클릭 86. 지시문은 3종 템플릿에 메뉴명만 교체 | 파일 분석 |
| E7 | 매뉴얼 패치 42개의 `data-mid` 선택자 297개 중 실제 UI 소스에 있는 것 | 1개 (0.3%) | 같은 방법 |
| E8 | 실제 텔레그램·브라우저 지시 기록 | 8건 (`ebro_audit.db`), 1건 성공 / 7건 실패 | DB 조회 |
| E9 | 밴드 변환 1건의 출력 길이 | 약 1,800토큰 | 추론 로그 |

E4~E7의 해석: 기능정의서의 `buttons`는 실제 화면 문자열이 아니라 설명용 이름이 대부분이다. 이 문자열을 클릭 대상으로 학습하면 존재하지 않는 버튼을 누르도록 가르치게 된다.

### 2.2 파일별 판정

| 자료 | 판정 | 사유 | 사용 방법 |
|---|---|---|---|
| `band_dispatch_1000_*` 출력(정답) | **폐기** | E1, E2, E3. 지어낸 값이 정답으로 학습되어 있음 | 사용 금지 |
| `band_dispatch_1000_*` 입력(대화 원문 3종: 녹취, 카카오톡, 현장 메모) | **재활용** | 실제 말투와 형식이 담긴 자료 | 입력만 사용. 정답은 코드가 원문에서 다시 추출해 새로 작성 |
| `ebro_finetune_dataset.jsonl` 200건 | **폐기** | E5, E6. 템플릿 반복, 존재하지 않는 버튼 | 사용 금지 |
| `ebro_menu_knowledge.json`의 `buttons` | **학습 사용 금지** | E4 | 사용 금지 |
| `ebro_menu_knowledge.json`의 메뉴 ID, 메뉴명, 부서, 목적 | **사용** | 메뉴 ID 57개 닫힌 집합으로 사용 가능 | 메뉴 분류 라벨과 안내문 원천 |
| `src/data/allMenuManuals.ts` (58개 메뉴: 목적, 인지 순서, 규칙, 주의사항) | **사용** | 메뉴 안내문의 원천 | 모델이 생성하지 않고 코드가 메뉴 ID로 조회해 회신 |
| `manual_patches/*.json` | **학습 사용 금지** | E7. 선택자가 실제 화면과 맞지 않음 | 사용 금지 |
| 실제 UI 소스의 JSX 문자열 | **신규 원천** | 실제 화면에 존재하는 문자열 | T2 노출 버튼 목록 생성 |
| `ebro_audit.db` 실제 지시 8건 | **평가셋에 포함** | 실제 말투 (거래처 약칭, 오타) | 학습에는 사용하지 않음 |

### 2.3 결론

기존 학습 데이터는 지어낸 값과 존재하지 않는 UI 문자열을 가르치는 상태라, 일부를 고쳐 쓰는 방식으로는 신뢰할 수 없다. 원천이 되는 입력 문장과 실제 UI 문자열만 가져오고 정답은 새로 작성한다.

---

## 3. 양자화 판단 (실측)

### 3.1 정확도 (밴드 변환 검증 30건, 정답은 원문 근거 기준으로 정제, 이 PC의 GPU)

| 형식 | 필드 정확도 | 원문에 없는 값 | 파일 크기 | 생성 속도 |
|---|---|---|---|---|
| F16 (현재) | 92.9% | 27건 | 6.2GB | 79 토큰/초 |
| Q8_0 | 92.8% | 26건 | 3.3GB | 119 토큰/초 |
| Q4_K_M | 92.8% | 27건 | 1.9GB | 158 토큰/초 |

- 세 형식의 정확도 차이는 0.2%p 이내다. 이 측정에서 양자화에 따른 정확도 손실은 확인되지 않았다.
- 양자화는 원문에 없는 값 생성을 줄여 주지 않는다. 해당 문제는 학습 데이터에서 해결한다.
- 출력 문자열은 F16과 완전히 같지 않다. Q8_0 17/30건, Q4_K_M 10/30건만 동일했다. 따라서 **최종 평가는 배포할 Q4_K_M 파일로 수행**한다. F16 평가 결과로 대체하지 않는다.

### 3.2 CPU 전용 구동 (GPU 끔, 6스레드, 컨텍스트 4,096, 업무지시 해석 크기 프롬프트)

| 형식 | 생성 속도 | 응답 시간 평균 | 최대 | 사용자 PC 적합성 |
|---|---|---|---|---|
| F16 | 8.9 토큰/초 | 8.49초 | 15.76초 | 부적합 (6.2GB 상주, 느림) |
| Q8_0 | 14.2 토큰/초 | 5.98초 | 11.38초 | 부적합 (3.3GB 상주, 느림) |
| **Q4_K_M** | **25.4 토큰/초** | **4.48초** | **8.44초** | **적합** |

- 첫 호출 8.44초, 이후 호출 2.99~4.53초. 같은 시스템 프롬프트가 반복될 때 앞부분 재사용으로 빨라진 것으로 보인다 (프롬프트 440토큰, 출력 44~67토큰).
- 측정 PC(Core Ultra 9 275HX, 24코어)는 i5보다 빠르다. 6스레드 제한으로 보정했어도 **사용자 PC 값은 이보다 느리다고 가정**한다. 실제 사용자 PC 측정은 P10에서 수행한다.
- 이 측정은 현재 모델로 한 것이라 출력 내용은 틀렸다 (업무지시 형식을 학습한 적 없음). 시간 측정용이다. 현행 모델이 업무지시 형식을 따르지 못한다는 점도 이 결과에서 확인됐다.

### 3.3 메모리 (16GB 사용자 PC)

| 항목 | 값 | 비고 |
|---|---|---|
| Q4_K_M 가중치 | 1.9GB | 실측 파일 크기 |
| 컨텍스트 4,096 캐시 | 약 0.15GB | 모델 구성값에서 계산한 추정 (36층, KV 헤드 2, 차원 128) |
| 합계 | 약 2.1~2.5GB | 추정. P10에서 실측 |
| Ollama 기본 컨텍스트 | 32,768 | 이 PC 확인값. 이 경우 Q4 상주 4.3GB, F16 8.5GB로 증가 |

- Modelfile에 `PARAMETER num_ctx 4096`을 명시한다.
- 동시 적재 모델은 1개로 제한한다 (`OLLAMA_MAX_LOADED_MODELS=1`).
- OS, 브라우저, 음성 인식(`faster-whisper` 약 0.8GB)과 함께 쓰는 환경이므로 AI 모델 합계는 3GB 이하로 둔다.

### 3.4 소형 모델 비교

업무지시 해석은 닫힌 집합 분류와 값 추출이라 3B가 필요 이상일 수 있다. P7에서 `Qwen2.5-1.5B-Instruct` 원본으로도 같은 데이터를 학습해 비교하고, **성공판정을 통과하는 가장 작은 모델**을 채택한다. 1.5B가 통과하면 모델명은 같게 유지하되 `ebro-qwen:3b`의 크기 표기가 실제와 달라지므로, 그 경우 사장님께 이름 변경 여부를 확인한다.

---

## 4. 모델 담당 작업 범위

CPU 전용 환경에서는 출력 토큰 수가 응답 시간을 결정한다 (Q4_K_M 25토큰/초 기준 100토큰에 약 4초). 모델은 짧은 출력만 담당한다.

| 코드 | 작업 | 모델 출력 | 출력 상한 | 코드 담당 |
|---|---|---|---|---|
| T1 | 업무지시 해석 (텔레그램) | `{type, slots, missing}` | 80토큰 | 날짜 정규화, DB 대조, 권한, 확인, 실행, 되묻기 문장 |
| T2 | 웹 화면 조작 | `{tool, params}` (`thought` 없음). `navigate_menu`는 메뉴 ID 57개 중 택1. `click_element` 대상은 입력에 주어진 노출 버튼 목록 중 택1 | 60토큰 | 노출 버튼 목록 수집(확장 프로그램), DOM 텍스트 매칭, 실행 |
| T3 | 통화 녹취 분석 | `{workflow, customer, site, model, quantity, target_date, duration_months}` (`summary` 제외) | 100토큰 | 요약 문장은 코드 템플릿 또는 생략 |
| T4 | 밴드 출고요청 변환 | `band_dispatch_json` 필드만 (원문 근거 없는 값은 빈 문자열) | 400토큰 | `band_post_text`는 JSON으로 코드가 생성 |
| T5 | 메뉴 사용법 안내 | `{type: "MENU_GUIDE", menuId}` | 30토큰 | 안내문은 `allMenuManuals.ts`에서 코드가 조회 |

- 기존의 긴 문장 생성(`thought`, `summary`, `band_post_text`, 조작 순서 설명 700토큰)은 모델 출력에서 제거한다. 근거: E9, 3.2의 생성 속도.
- T4(밴드 변환)는 전체 업무 중 일부(보조 작업)이며, 사용자 PC(CPU)에서 실행하기로 확정됐다 (10장). JSON 약 17개 필드로 400토큰 안팎이라 CPU에서 16초 이상 걸릴 수 있다. 응답 시간 기준 M14(60초)로 관리하고, 학습 데이터와 평가 비중은 줄인다 (P2, P5).

### 4.1 모델과 코드의 역할 분리

| 담당 | 내용 |
|---|---|
| 모델 | 업무유형 분류, 원문에서 값 추출, 누락 값 표시 |
| 코드 | 날짜·수량 정규화, DB 대조로 대상 확정, 역할 권한 검사, 확인 버튼, 실행 단계, 저장 검증, 되묻기 문장, 안내문 조회 |

---

## 5. T1 업무유형 정의서

### 5.1 정의서 파일

- 경로: `eBro/ebro-agent-core/playbooks/directive_types.yaml`
- 단일 원천(SSOT): 학습 데이터 생성, 평가셋 라벨, 런타임 실행이 모두 이 파일을 참조한다.

```yaml
- type: EXCHANGE_REQUEST
  label: 교환 의뢰
  group: REQUEST            # QUERY | REQUEST | CHANNEL_FORBIDDEN | OUT_OF_SCOPE
  allowedRoles: [SALES, MANAGER]
  slots:
    siteHint:    {required: true,  label: 현장}
    assetHint:   {required: true,  label: 장비}
    reason:      {required: true,  label: 교환 사유}
    requestDate: {required: true,  label: 희망일}
  forbiddenSlots: [newAssetId]     # 영업의 자산 지정 금지 (헌장 2.1). 코드가 차단
  steps:
    - validate_contract_active
    - create_delivery: {type: EXCHANGE, count: 1}   # 헌장 2.3
    - inherit_contract_properties                   # 헌장 2.2
    - write_history: {changeType: EXCHANGE}         # 헌장 4.2
  confirm: required
  manualRef: ebro_menu_knowledge.json#delivery
```

### 5.2 T1 입출력 규격

입력 (user 메시지): 지시 원문만 넣는다. 되묻기 응답은 코드가 원 지시문과 이어 붙여 다시 호출한다.

출력:

```json
{"type": "EXCHANGE_REQUEST",
 "slots": {"siteHint": "평택 삼성", "assetHint": "35호기", "reason": "유압 새요"},
 "missing": ["requestDate"]}
```

규칙:
1. `slots`의 모든 값은 지시 원문의 **연속된 부분 문자열**이어야 한다 (공백 정규화만 허용). 정규화는 코드가 한다.
2. `slots`의 키는 해당 유형에 정의된 키만 사용한다. 키에 `*` 등 표시를 붙이지 않는다 (3.2 측정에서 현행 모델이 `requestDate*` 형태로 출력함).
3. `missing`은 필수 슬롯 중 원문에 없는 항목이다. 추측해서 채우지 않는다.
4. 필수 슬롯이 하나도 없는 지시에 빈 슬롯 객체를 채워 내보내지 않는다. 지시가 모호하면 `missing`을 채운다.
5. `OUT_OF_SCOPE`, `CHANNEL_FORBIDDEN`은 `slots`에 `targetAction`만 허용한다.
6. `thought` 필드는 두지 않는다.

### 5.3 시스템 프롬프트 길이

- 유형 코드와 슬롯 키만 나열한 한 줄 형식으로 작성한다. 목표 300토큰 이하 (3.2 측정 프롬프트는 440토큰).
- 호출 때마다 같은 문자열을 맨 앞에 두고 지시 원문은 뒤에 붙인다 (앞부분 재사용).
- `keep_alive`를 길게 지정해 모델을 상주시킨다 (첫 호출 지연 8.44초 방지).

### 5.4 업무유형 (2026-10-04 `directive_types.yaml` 17종, YAML이 우선)

초안 대비 변경: `DISPATCH_ASSIGN`은 `권한관리.md`의 `dispatch_assign`(장비 할당)과 의미가 충돌하여 `DRIVER_ASSIGN`으로 변경(헌장 1.4). `VEHICLE_LOG`는 ERP에 대응 메뉴가 없어 제외. T3 통화 분석 코드는 YAML `callWorkflows`로 통일.

| 그룹 | 유형 코드 | 표시명 | 주요 슬롯 | 확인 |
|---|---|---|---|---|
| QUERY | ASSET_STATUS_QUERY | 자산 상태 조회 | assetHint, modelHint | 불필요 |
| QUERY | CONTRACT_QUERY | 계약 조회 | customerHint, siteHint | 불필요 |
| QUERY | DISPATCH_STATUS_QUERY | 배차 현황 조회 | dateHint, siteHint | 불필요 |
| QUERY | RECEIVABLE_QUERY | 미수금 조회 | customerHint | 불필요 |
| QUERY | MENU_GUIDE | 메뉴 사용법 안내 | menuHint | 불필요 |
| REQUEST | OUTBOUND_REQUEST | 출고 의뢰 | customer, site, model, quantity, requestDate | 필수 |
| REQUEST | EXCHANGE_REQUEST | 교환 의뢰 | siteHint, assetHint, reason, requestDate | 필수 |
| REQUEST | RETURN_REQUEST | 반납 의뢰 | siteHint, assetHint, requestDate | 필수 |
| REQUEST | CONTRACT_EXTEND | 계약 연장 | contractHint, extendUntil | 필수 |
| REQUEST | CONTRACT_SHORTEN | 계약 단축 | contractHint, endDate | 필수 |
| REQUEST | AS_REQUEST | AS 접수 | siteHint, assetHint, symptom | 필수 |
| REQUEST | DRIVER_ASSIGN | 배차 기사 배정 | deliveryHint, driver, fee | 필수 |
| REQUEST | REPAIR_LOG | 정비 기록 | assetHint, action, parts | 필수 |
| REQUEST | CONSUMABLE_OUT | 소모품 출고 | item, quantity, assetHint | 필수 |
| REQUEST | LEAVE_APPLICATION | 휴가 신청 | startDate, endDate, leaveType | 필수 |
| CHANNEL_FORBIDDEN | CHANNEL_FORBIDDEN | 텔레그램 실행 불가 | targetAction | 거절 후 ERP 화면 안내 |
| OUT_OF_SCOPE | OUT_OF_SCOPE | 범위 밖 | — | 거절 |

텔레그램 실행 불가 업무 (초안): 출고 검수 승인(`RENTED` 전환, 현장 물리 검수 필요), 청구 확정·마감, 급여, 권한 변경, 감가상각 실행, 초기 DB 업로드, 자산 매각·폐기 승인.

역할 코드는 `권한관리.md`의 역할 체계와 대조하여 확정한다.

---

## 6. 삭제 대상 및 보존 대상

### 6.1 삭제 대상 (가중치)

| 대상 | 경로 / 이름 | 비고 |
|---|---|---|
| Ollama 모델 | `ebro-qwen:3b` | 같은 이름으로 재등록 |
| Ollama 모델 | `qwen2.5-3b-tuned_v1:latest` | `ebro-qwen:3b`의 상위 모델 |
| 병합 가중치 | `FineTune_Studio\models\qwen2.5-3b-tuned_v1\` (약 6.2GB) | |
| LoRA 어댑터 | `FineTune_Studio\outputs\runs\RUN_20260908_203841\adapter\` | |
| LoRA 어댑터 | `FineTune_Studio\outputs\runs\RUN_20260908_231552\adapter\` | |

양자화 비교용으로 만든 `ebro-qtest:q8_0`, `ebro-qtest:q4_K_M`은 삭제했다.

### 6.2 보존 대상

| 대상 | 사유 |
|---|---|
| `outputs\runs\*\manifest.json` | 학습 이력 기록 (헌장 1.2). 삭제 사실을 manifest에 추가 기록 |
| `models\hub\Qwen--Qwen2.5-3B-Instruct\` | 재훈련 베이스 |
| `datasets\band_dispatch_1000_*` | 입력 원문의 원천. 원본은 수정하지 않음 |
| `ebro-agent-core\ebro_finetune_dataset.jsonl` | 보관만 함. 학습에 사용하지 않음 |
| `qwen2.5:0.5b` | `ai_brain.py` 대체 모델 (`FALLBACK_MODEL`) |

---

## 7. 절차

| 단계 | 내용 | 산출물 | 소요 (추정) |
|---|---|---|---|
| P0 | 사전 점검 | 점검 기록 | 10분 |
| P1 | 업무유형 정의서 확정 | `playbooks/directive_types.yaml` | 0.5일 + 검토 |
| P2 | 평가셋 작성 및 사람 검수 | `FineTune_Studio/eval/ebro_v2_eval.jsonl` | 0.5일 + 검수 |
| P3 | 기준선 측정 (현행 모델) | `eval/results/baseline_20261004.json` | 1시간 |
| P4 | 기존 가중치 삭제 | 삭제 기록 | 10분 |
| P5 | 학습 데이터 생성 | `datasets/ebro_v2/` | 3~5시간 |
| P6 | 데이터 검증 게이트 | `datasets/ebro_v2/data_report.json` | 30분 |
| P7 | 학습 (3B, 비교용 1.5B) | `outputs/runs/RUN_<ID>/adapter/` | 각 3~6시간 (미측정 추정) |
| P8 | 병합, Q4_K_M 양자화, 동일 이름 등록 | `models/ebro-qwen-3b/`, `ollama: ebro-qwen:3b` | 30분 |
| P9 | 연동 코드 정비 | `ai_brain.py`, `telegram_bot.py`, `Modelfile` | 0.5일 |
| P10 | 평가 (Q4_K_M 파일, 이 PC + 사용자 PC급) 및 판정 | `eval/results/candidate_<ID>.json`, 판정 보고서 | 반나절 |
| P11 | 기록 | 스켈톤 경험 기록, manifest 갱신 | 30분 |

> [!WARNING]
> P4 삭제부터 P8 등록까지(약 9~16시간) 텔레그램 AI 해석은 규칙 엔진으로만 동작한다. `parse_instruction()`은 Ollama 응답이 없으면 `_rule_based_fallback()`으로 넘어가도록 되어 있다 (코드 확인). `analyze_call_transcript()`의 대체 경로는 P0에서 확인한다.

### P0. 사전 점검

```powershell
nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv
ollama list
Get-PSDrive D | Select-Object Used, Free
Test-Path D:\01.AntiGravity\FineTune_Studio\models\hub\Qwen--Qwen2.5-3B-Instruct
```

- 여유 공간 30GB 이상
- 학습 중 VRAM을 쓰는 다른 프로세스 종료 (`ollama stop <model>`)
- `eBro` 작업 트리 커밋 상태 확인 (`git status`)
- `analyze_call_transcript()`가 모델 부재 시 오류 없이 대체 경로로 넘어가는지 확인
- 사용자 PC급 측정은 별도 일정으로 진행한다 (10장 결정 6). 일정 확정 전까지 이 PC에서 GPU 끄고 6스레드 조건으로 측정한다.
- 양자화 경로 확인: `ollama create --quantize q4_K_M`이 병합 모델 디렉토리에서 동작하는지 (이번 검토에서 기존 모델 대상으로 q8_0, q4_K_M 생성 확인)

### P1. 업무유형 정의서 확정

- 원천 자료: `allMenuManuals.ts`(58개 메뉴), `ebro_menu_knowledge.json`의 메뉴 ID·메뉴명, `권한관리.md`, `PROJECT_REQUIREMENTS.md`, 전사 표준 헌장
- 5.4 초안에서 유형 추가·삭제 여부와 텔레그램 실행 불가 업무 경계를 확정한다.
- 동의어는 단일 유형으로 수렴한다 (헌장 1.4). 예: 교체·대차·바꿔 → `EXCHANGE_REQUEST`
- T3 통화 분석 유형 코드를 T1 코드로 통일한다: `DISPATCH_REQUEST` → `OUTBOUND_REQUEST`, `GENERAL_INQUIRY` → `OUT_OF_SCOPE`
- **사장님 승인 후 다음 단계 진행**

### P2. 평가셋 작성

| 작업 | 문항 수 | 구성 조건 |
|---|---|---|
| T1 | 300 | 유형별 최소 10건, 누락 값 포함 30% 이상, 실행 불가 업무 10% 이상, 범위 밖 5% 이상, 거래처 약칭·오타 10% 이상 |
| T2 | 60 | 메뉴 이동, 버튼 클릭(노출 버튼 목록 포함), 입력, 화면 읽기 고르게 포함 |
| T3 | 40 | 통화 녹취 유형별 고르게 포함 |
| T4 (보조) | 20 | 밴드 검증 분할(val)의 입력에서 추출. 정답은 코드가 원문 근거로 작성하고 사람이 검수 |
| T5 | 30 | 메뉴 57개에서 고르게 추출. 메뉴 별칭 포함 |

- 실제 지시 기록 8건(`ebro_audit.db`)과 사장님이 제공하는 텔레그램 로그를 T1 평가셋에 우선 포함한다.
- 정답 라벨은 초안 생성 후 **사람이 전수 검수**한다. 검수자와 검수 일시를 파일에 기록한다.
- 평가셋은 학습 데이터 생성 전에 고정하며, 이후 학습에 절대 넣지 않는다.

### P3. 기준선 측정

- 현행 `ebro-qwen:3b`로 평가셋을 실행하고 결과를 그대로 저장한다.
- 호출 조건은 운영 코드와 동일하게 맞춘다: `/api/chat`, `format: "json"`, `temperature: 0.1`
- T1은 현행 모델이 규격을 모르므로 점수가 낮게 나오는 것이 정상이다. 개선 폭 비교용으로 기록한다.
- 측정 스크립트: `FineTune_Studio/scripts/eval_ebro.py --model ebro-qwen:3b --out eval/results/baseline_20261004.json`

### P4. 기존 가중치 삭제

```powershell
ollama rm ebro-qwen:3b
ollama rm qwen2.5-3b-tuned_v1:latest
Remove-Item -Recurse -Force D:\01.AntiGravity\FineTune_Studio\models\qwen2.5-3b-tuned_v1
Remove-Item -Recurse -Force D:\01.AntiGravity\FineTune_Studio\outputs\runs\RUN_20260908_203841\adapter
Remove-Item -Recurse -Force D:\01.AntiGravity\FineTune_Studio\outputs\runs\RUN_20260908_231552\adapter
```

삭제 확인:

```powershell
ollama list | Select-String "ebro-qwen|tuned_v1"      # 출력 없음
Test-Path D:\01.AntiGravity\FineTune_Studio\models\qwen2.5-3b-tuned_v1   # False
```

- 두 manifest.json에 `weightsDeletedAt`, `weightsDeletedReason` 필드를 추가해 삭제 사실을 기록한다.

### P5. 학습 데이터 생성

구성:

| 작업 | 건수 (목표) | 생성 방법 |
|---|---|---|
| T1 | 약 1,800 | 정의서 기반. 코드가 슬롯 값을 정하고, 로컬 대형 모델(`qwen3:30b`)은 문장 표현만 작성. 정답 라벨은 코드가 구성 |
| T2 | 약 450 | 메뉴 이동은 메뉴 ID 57개 기반. 클릭은 **실제 UI 소스에서 추출한 문자열**로 노출 버튼 목록을 구성하고 대상은 그 목록 안에서만 선택. 지시문 표현은 다양화 |
| T3 | 약 300 | 통화 녹취 형식. 유형 코드는 P1 통일 코드 사용 |
| T4 (보조) | 약 150 | 밴드 입력 원문 재활용. 정답은 코드가 원문에서 추출한 값, 원문에 없으면 빈 문자열. 평가셋 20건 제외 |
| T5 | 약 300 | 메뉴 57개 × 표현 변형 (별칭, 약칭, 줄임말) |

T1 구성 비율:
- 누락 값이 있어 되물어야 하는 문항: 30% 이상
- 텔레그램 실행 불가 업무: 10% 이상
- 범위 밖 질문: 5% 이상
- 되묻기 후 원 지시문과 응답을 이어 붙인 재호출 문항: 5% 이상
- 거래처 약칭·오타·띄어쓰기 변형: 10% 이상
- 유형별 최소 50건

공통 규칙:
- 슬롯 값은 합성 값을 사용한다. 실제 거래처 개인정보(전화번호, 이메일)가 포함된 원천 자료는 가명으로 치환한다.
- 생성 모델이 만든 문장에 정답에 없는 날짜·전화번호·수량이 들어가면 해당 샘플을 폐기한다 (수정하지 않음).
- 모든 샘플의 모델 출력은 4장의 출력 상한 이내여야 한다.
- 생성 결과와 폐기 사유를 모두 보존한다 (헌장 5.6).
- 분할: 학습 90% / 검증 10%

### P6. 데이터 검증 게이트

검증 스크립트 `FineTune_Studio/scripts/validate_dataset.py`가 아래 항목을 전수 검사하고 `data_report.json`을 출력한다. 하나라도 미달하면 P7로 넘어가지 않는다.

| 코드 | 항목 | 기준 |
|---|---|---|
| D1 | 슬롯 값이 입력 원문의 부분 문자열이 아닌 샘플 | 0건 |
| D2 | 출력 JSON 파싱 실패 또는 작업별 스키마 위반 | 0건 |
| D3 | 평가셋과 동일하거나 거의 같은 문장 (정규화 후 완전 일치, 문자 5-gram 유사도 0.9 이상) | 0건 |
| D4 | 5.4 정의서에 없는 유형 코드, 슬롯 키 | 0건 |
| D5 | T1 구성 비율 (P5 기준) | 전 항목 충족 |
| D6 | T4 정답에서 입력에 없는 이메일·전화번호 | 0건 (기존 513건 / 148건) |
| D7 | T2 `click_element` 대상이 입력의 노출 버튼 목록에 없는 샘플, 또는 노출 버튼 목록이 실제 UI 소스 문자열이 아닌 샘플 | 0건 |
| D8 | 모델 출력 토큰 수가 4장 상한을 넘는 샘플 (Qwen 토크나이저 기준) | 0건 |
| D9 | 시스템 프롬프트(T1) 토큰 수 | 300 이하 |

### P7. 학습

기존 `train_worker.py`를 그대로 사용한다.

```powershell
cd D:\01.AntiGravity\FineTune_Studio
python core\train_worker.py `
  --run_id RUN_EBRO_V2_<YYYYMMDD_HHMMSS> `
  --base_model Qwen/Qwen2.5-3B-Instruct `
  --data_file datasets\ebro_v2\train.jsonl `
  --val_file datasets\ebro_v2\val.jsonl `
  --output_dir outputs\runs\RUN_EBRO_V2_<ID>\adapter `
  --epochs 3 --batch_size 4 --grad_accum 4 `
  --learning_rate 2e-4 --lora_r 16 --lora_alpha 32 `
  --max_seq_length 2048 --use_4bit
```

- 손실은 assistant 응답에만 계산한다 (`assistant_only_loss=True`, 기존 설정).
- 체크포인트는 검증 손실이 가장 낮은 것을 선택한다. 검증 손실이 연속 2회 평가에서 상승하면 중단하고 직전 체크포인트를 사용한다.
- 손실값이 낮다는 것 자체는 성공 기준이 아니다. 판정은 P10 평가셋 결과로만 한다.
- **비교 학습**: `Qwen/Qwen2.5-1.5B-Instruct` 원본(다운로드 필요)으로 같은 데이터와 같은 조건에서 한 번 더 학습한다. P10에서 두 모델을 같은 기준으로 판정하고, 통과한 모델 중 가장 작은 것을 채택한다 (3.4).

### P8. 병합, 양자화, 동일 이름 등록

1. LoRA 병합: `core/export_pipeline.merge_lora_weights()` → `models\ebro-qwen-3b\` (F16 병합본, 학습 PC 내부용)
2. Modelfile 작성 (`FROM`은 병합 디렉토리):

```
FROM D:\01.AntiGravity\FineTune_Studio\models\ebro-qwen-3b
PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
PARAMETER stop "<|im_end|>"
PARAMETER stop "<|endoftext|>"
```

   `SYSTEM`은 비워 둔다. 작업별 시스템 프롬프트는 호출 측이 넘긴다.
3. 양자화하여 등록: `ollama create ebro-qwen:3b --quantize q4_K_M -f Modelfile`
   - 배포 모델은 Q4_K_M 하나만 등록한다. F16, Q8_0은 Ollama에 등록하지 않는다.
4. 생성된 Modelfile로 `eBro/ebro-agent-core/Modelfile`을 교체한다.
5. 등록 확인:

```powershell
ollama list | Select-String "ebro-qwen:3b"       # 크기 약 1.9GB
ollama show ebro-qwen:3b --modelfile             # num_ctx 4096 확인
```

6. 사용자 PC 배포 시 환경 변수 `OLLAMA_MAX_LOADED_MODELS=1`, 호출 시 `keep_alive` 지정.

### P9. 연동 코드 정비

| 대상 | 변경 |
|---|---|
| `ai_brain.py` | `interpret_directive()` 신설 (T1 규격, `format`에 JSON 스키마 지정, 출력 토큰 상한 `num_predict` 80, `num_ctx` 4096, `keep_alive` 지정) |
| `ai_brain.py` | 값 지어내기 기본값 제거: `"GS-1930"`, `"익일 오전"`, `quantity` 기본 1 → 값이 없으면 빈 값과 `missing` 처리 |
| `ai_brain.py` | T3 유형 코드를 P1 통일 코드로 변경, `summary`를 모델 출력에서 제거 |
| `ai_brain.py` | `_call_ollama()`: 메뉴 지식 청크 주입 제거(현재 시스템 프롬프트에 메뉴 정의를 덧붙임), 노출 버튼 목록 주입으로 대체, `num_predict` 256 → 60 |
| `ai_brain.py` | 메뉴 안내(T5)는 모델이 문장을 생성하지 않고 `allMenuManuals.ts` 내용을 메뉴 ID로 조회하여 회신 |
| `telegram_bot.py` | 업무지시 경로를 `interpret_directive()`로 연결, 기본값 `"GS-1930"` 제거 |
| `telegram_bot.py` | 흐름: 해석 → 되묻기 → DB 대조 → 역할 권한 검사 → 요약 카드와 `[확인]` 버튼 → 정의서 `steps` 실행 → 저장 검증 → 완료 회신 |
| `telegram_bot.py` | 지시마다 고유 ID를 부여해 중복 실행 방지. 모델 응답 대기 중 "처리 중" 메시지 즉시 회신 (응답 지연 대응) |
| `Modelfile` | P8 생성본으로 교체 |

T3 유형 코드 변경은 `telegram_bot.py` 등 하위 처리부에 영향이 있으므로 참조 위치를 전수 검색한 뒤 함께 변경한다.

### P10. 평가 및 판정

```powershell
python scripts\eval_ebro.py --model ebro-qwen:3b --out eval\results\candidate_<ID>.json
```

- **평가 대상은 P8에서 등록한 Q4_K_M 모델이다.** F16 병합본의 평가 결과로 대신하지 않는다.
- 기준선과 같은 평가셋, 같은 호출 조건으로 실행한다.
- 정확도(M1~M9)는 이 PC에서 측정한다.
- 응답 시간과 메모리(M10~M12)는 **GPU를 끄고 6스레드, 컨텍스트 4,096** 조건으로 이 PC에서 측정한 뒤, **실제 사용자 PC급 장비에서 재측정**한다. 이 PC의 CPU는 i5보다 빠르므로 이 PC 값만으로 통과 판정하지 않는다.
- 사용자 PC 측정은 별도 일정으로 보류되어 있다 (10장 결정 6). 측정 전에는 M10~M12, M14를 "이 PC 값 통과, 사용자 PC 미측정"으로 기록하고 PASS가 아닌 **조건부 PASS**로 판정한다.
- 6장 성공판정 기준에 따라 판정 보고서 `eBro/docs/EBRO_QWEN_3B_판정_<ID>.md`를 작성한다.
- 평가 결과 파일과 문항별 원 출력은 삭제하지 않고 보존한다 (헌장 5.6).

### P11. 기록

- 스켈톤 `경험/`에 재훈련 결과 기록 (`2026-10_ebro-qwen_3b_재훈련.md`)
- `outputs/runs/RUN_EBRO_V2_<ID>/manifest.json`에 판정 결과 기록
- 변경 코드 커밋

---

## 8. 성공판정

### 8.1 모델 판정 (평가셋: T1 300, T2 60, T3 40, T4 20, T5 30)

| 코드 | 지표 | 산식 | 기준 |
|---|---|---|---|
| M1 | 업무유형 분류 정확도 (T1) | 유형 일치 문항 / T1 문항 | **90% 이상** |
| M2 | 슬롯 추출 정확도 (T1) | 일치 슬롯 / (정답 슬롯 + 정답에 없는 예측 슬롯) | **90% 이상** |
| M3 | 원문에 없는 값 생성 (T1~T4 전체) | 추출 값 중 입력 원문 부분 문자열이 아닌 값의 개수 | **0건** |
| M4 | 되묻기 재현율 (T1) | 정답에 누락 값이 있는 문항 중, 예측 `missing`이 정답 누락 항목을 모두 포함하고 해당 슬롯을 채우지 않은 비율 | **95% 이상** |
| M5 | 텔레그램 실행 불가 업무 분류 (T1) | `CHANNEL_FORBIDDEN` 정답 문항 중 정확히 분류한 비율 | **100%** |
| M6 | JSON 파싱 실패 (전체) | 파싱 실패 문항 수 | **0건** |
| M7 | 웹 도구 호출 정확도 (T2) | `tool`과 핵심 파라미터(`menuId`, `target`) 일치 비율. `target`이 입력 노출 버튼 목록에 없는 출력은 오답 | **90% 이상** |
| M8 | 통화 분석 유형 정확도 (T3) | `workflow` 일치 비율 | **90% 이상** |
| M9 | 밴드 변환 필드 정확도 (T4, 보조 작업) | 정제 정답 대비 필드 일치 비율 | **P3 기준선 이상**, 단 M3 0건 충족 필수 |
| M14 | 밴드 변환 응답 시간 (T4, 사용자 PC CPU) | p95 | **60초 이하** (텔레그램은 비동기 회신이므로 "처리 중" 회신 후 결과 전달) |
| M9-2 | 메뉴 분류 정확도 (T5) | `menuId` 일치 비율 | **95% 이상** |
| M10 | 응답 시간 (T1, 컨텍스트 4,096, CPU 6스레드) | 모델 상주 상태에서 지시 해석 1건 p95 | **10초 이하** (이전 기준 3초는 GPU 전제였으므로 폐기) |
| M11 | 첫 호출 응답 시간 (모델 적재 후 시스템 프롬프트 미재사용) | 최대값 | **20초 이하** |
| M12 | 모델 프로세스 메모리 | Ollama 모델 상주 후 실측 | **3GB 이하** |
| M13 | 출력 토큰 수 (T1) | p95 | **80 이하** |

M10~M12는 3.2의 이 PC 측정(Q4_K_M 평균 4.48초, 최대 8.44초)을 참고한 기준이며, 사용자 PC 장비에서 재측정한 값으로 판정한다.

### 8.2 연동 판정

| 코드 | 지표 | 기준 |
|---|---|---|
| I1 | `ai_brain.py`, `telegram_bot.py`의 값 대입용 기본값(`"GS-1930"`, `"익일 오전"`, 수량 기본 1) | 0건 (프롬프트 안의 예시 문구는 제외) |
| I2 | 텔레그램 종단 시나리오 20건: `[확인]` 없이 실행된 쓰기 작업 | 0건 |
| I3 | 같은 시나리오: 저장 실패인데 완료로 회신한 건 (무음 실패, 헌장 5.2) | 0건 |
| I4 | 같은 시나리오: 메시지 재전송으로 인한 중복 생성 | 0건 |
| I5 | 같은 시나리오: 역할 권한 밖 지시 거절 | 100% |
| I6 | `ollama list`: `ebro-qwen:3b` 존재(크기 2.5GB 이하), `qwen2.5-3b-tuned_v1` 없음, F16·Q8_0 모델 없음, `ai_brain.DEFAULT_MODEL` 변경 없음 | 충족 |
| I7 | 평가 결과, 문항별 원 출력, 데이터 생성·폐기 기록 보존 | 충족 |
| I8 | `Modelfile`에 `num_ctx 4096` 명시, 호출 코드에 `num_predict` 상한과 `keep_alive` 지정 | 충족 |
| I9 | 모델 응답 대기 중 텔레그램 "처리 중" 회신이 즉시 발송 | 충족 |

### 8.3 판정 규칙

1. D1~D9, M1~M14(M9-2 포함), I1~I9 전 항목 충족 시 **PASS**
2. M10~M12, M14를 사용자 PC에서 측정하지 못한 경우, 나머지가 모두 충족되면 **조건부 PASS**. 사용자 PC 측정 후 PASS로 전환한다.
3. 하나라도 미달하면 **FAIL**. 미달 항목, 문항별 오답 유형, 원인 분석을 판정 보고서에 기록한다.
4. FAIL 시 원인에 따라 P1(정의서) 또는 P5(데이터)부터 다시 수행한다.
5. 재시도 3회째에도 FAIL이면 진행을 멈추고 원인과 대안을 사장님께 보고한다 (헌장 5.4).
6. 측정 불가(스크립트 오류, Ollama 미기동 등)는 PASS로 간주하지 않고 FAIL로 기록한다 (헌장 5.6).
7. 기준선 대비 수치는 같은 평가셋, 같은 호출 조건에서 측정한 값만 비교한다.
8. 3B와 1.5B를 모두 학습한 경우, 전 항목을 충족한 모델 중 가장 작은 것을 채택한다.

---

## 9. 산출물 목록

| 산출물 | 경로 |
|---|---|
| 업무유형 정의서 | `eBro/ebro-agent-core/playbooks/directive_types.yaml` |
| 평가셋 (학습 사용 금지) | `FineTune_Studio/eval/ebro_v2_eval.jsonl` |
| 기준선 결과 | `FineTune_Studio/eval/results/baseline_20261004.json` |
| 학습 데이터 | `FineTune_Studio/datasets/ebro_v2/train.jsonl`, `val.jsonl` |
| 데이터 검증 보고 | `FineTune_Studio/datasets/ebro_v2/data_report.json` |
| 생성·검증·평가 스크립트 | `FineTune_Studio/scripts/build_ebro_v2_dataset.py`, `extract_ui_labels.py`, `validate_dataset.py`, `eval_ebro.py` |
| 실제 UI 문자열 목록 | `FineTune_Studio/datasets/ebro_v2/ui_labels.json` |
| LoRA 어댑터 | `FineTune_Studio/outputs/runs/RUN_EBRO_V2_<ID>/adapter/` |
| 병합 가중치 (F16, 학습 PC 내부용) | `FineTune_Studio/models/ebro-qwen-3b/` |
| Ollama 모델 (배포용 Q4_K_M) | `ebro-qwen:3b` |
| Modelfile | `eBro/ebro-agent-core/Modelfile` |
| 후보 평가 결과 | `FineTune_Studio/eval/results/candidate_<ID>.json` |
| 판정 보고서 | `eBro/docs/EBRO_QWEN_3B_판정_<ID>.md` |
| 경험 기록 | `000.skelton/경험/2026-10_ebro-qwen_3b_재훈련.md` |

---

## 10. 결정 사항 (2026-10-04 사장님 답변 반영)

| 번호 | 항목 | 상태 | 내용 |
|---|---|---|---|
| 1 | 업무유형 목록 | 승인 | 5.4 초안으로 진행. P1에서 정의서로 확정 |
| 2 | 텔레그램 실행 불가 업무 경계 | 승인 | 5.4 초안(출고 검수 승인, 청구 확정·마감, 급여, 권한 변경, 감가상각 실행, 초기 DB 업로드, 자산 매각·폐기 승인)으로 진행 |
| 3 | 평가셋 정답 검수자 | **미정** | T1 300문항 정답 라벨을 검수할 담당자 필요. P2 완료 전까지 확정 |
| 4 | 실제 지시 로그 | **미정** | 텔레그램 지시 원문 로그 제공 가능 여부와 위치. 없으면 `ebro_audit.db`의 8건만 사용 |
| 5 | 역할 코드 | 진행 | `권한관리.md`의 5개 직무(직할, 영업부, 출고팀, AS팀, 관리부)를 기준으로 P1에서 매핑하고 사장님께 확인 |
| 6 | 사용자 PC 측정 | **일정 보류** | 측정은 가능하나 당일은 불가. 일정은 추후 확정. 그때까지 M10~M12는 조건부 PASS로 처리 |
| 7 | 업무 해석·변환 실행 위치 | 확정 | **사용자 PC(CPU)에서 실행**. 모델 출력 상한(4장)과 응답 시간 기준(M10, M11, M14)은 사용자 PC 기준으로 적용 |
| 8 | 1.5B 비교 학습 | 승인 | `Qwen2.5-1.5B-Instruct`를 같은 데이터로 학습해 비교. 1.5B 채택 시 모델 이름 처리는 채택이 결정된 시점에 확인 |


---

## 11. 버전 비교 운영 (2026-10-04 사장님 지시: 검수·로그 없이 먼저 제작, 답변 후 추가 제작해 비교)

### 11.1 판단

두 결과물은 비교할 수 있다. 조건은 아래 3가지다.

1. **같은 평가셋으로 둘 다 채점한다.** 서로 다른 평가셋으로 각자 채점하면 점수를 비교할 수 없다.
2. **내일 추가하는 평가 자료(검수 완료 라벨, 실제 로그)는 v1·v2 어느 쪽 학습에도 넣지 않는다.** 한쪽이 정답을 미리 본 상태가 되면 비교가 무효가 된다.
3. **검수 전 결과는 잠정 판정으로 표시한다.** PASS 확정은 검수 후 평가셋에서 한다.

### 11.2 검수 전 제작의 위험과 보완

| 위험 | 보완 |
|---|---|
| 정답 라벨의 오류가 점수에 섞임 | T1 정답은 코드가 슬롯 값을 정하고 문장은 생성 모델이 쓰는 구조이므로, 값 오류는 D1(원문 부분 문자열 검사)이 자동으로 걸러낸다. 사람 검수는 유형 적합성과 문장의 자연스러움을 확인하는 추가 층이다 |
| 합성 문장만으로는 실제 말투 부족 | v1은 합성 문장만 사용한다. 실제 지시 8건(`ebro_audit.db`)은 평가셋 B에 둔다 |
| 검수에서 라벨이 정정됨 | 정정 전·후 평가셋(A, A')을 둘 다 보존하고, v1과 v2를 A'로 다시 채점한다 |

### 11.3 평가셋 구성

| 평가셋 | 내용 | 작성 시점 | 사용 |
|---|---|---|---|
| A | 합성 문항 (T1 300, T2 60, T3 40, T4 20, T5 30). 검수 전 | 2026-10-04 (P2) | v1·v2 공통 채점. 학습 사용 금지 |
| A' | A에 사람 검수 정정을 반영한 판 | 검수자 확정 후 | v1·v2 재채점 |
| B | 실제 텔레그램 지시 (`ebro_audit.db` 8건 + 내일 제공되는 로그). 사람이 정답 작성 | 로그 제공 후 | v1·v2 공통 채점. 학습 사용 금지 |

### 11.4 모델 버전과 이름

| 버전 | 학습 데이터 | 후보 이름 | 비고 |
|---|---|---|---|
| v1 (3B) | 합성 데이터 (P5 구성) | `ebro-cand:3b-v1` | 2026-10-04 제작 |
| v1 (1.5B) | 같은 데이터 | `ebro-cand:1.5b-v1` | 비교 학습 (승인됨) |
| v2 | v1 데이터 + 실제 로그의 말투를 반영해 추가한 합성 데이터 | `ebro-cand:3b-v2`, `ebro-cand:1.5b-v2` | 로그 제공 후 제작. 평가셋 A, A', B에 포함된 문항은 제외 |

- 후보는 위 이름으로 등록해 비교한다. 최종 채택본만 `ollama cp`로 **`ebro-qwen:3b`**에 복사해 배포 이름을 유지한다.
- `ai_brain.py`의 `DEFAULT_MODEL`은 채택 전까지 바꾸지 않는다.
- 후보 모델의 등록 형식은 P8과 같다 (Q4_K_M, 컨텍스트 4,096).

### 11.5 채택 규칙

1. 후보 전체(3B/1.5B × v1/v2)를 평가셋 A', B로 채점한다. 8장 판정 기준이 모두 적용된다.
2. 8장 기준을 충족한 후보 중 **평가셋 B의 M1, M2, M4 합계가 가장 높은 후보**를 채택한다. 동점이면 모델 크기가 작은 쪽을 채택한다.
3. M3(원문에 없는 값 생성) 0건을 충족하지 못한 후보는 점수와 관계없이 제외한다.
4. v1 단계의 판정은 검수 전이므로 **잠정 PASS / 잠정 FAIL**로 기록한다. A', B 채점 결과로 확정한다.
5. 채택되지 않은 후보의 어댑터, 평가 결과, 문항별 원 출력은 삭제하지 않고 보존한다 (헌장 5.6).

### 11.6 일정

| 시점 | 작업 |
|---|---|
| 2026-10-04 (오늘) | P0 ~ P8 진행. v1 후보(3B, 1.5B) 등록. 평가셋 A로 잠정 판정 |
| 2026-10-05 (답변 후) | 검수자 확정, 로그 수령 → 평가셋 A', B 작성 → v2 데이터 생성, 학습, 등록 → 전 후보 비교 채점 → 채택 → `ebro-qwen:3b` 복사 → P9, P11 |
| 사용자 PC 측정 일정 확정 후 | M10~M12, M14 측정, 조건부 PASS 해소 |
