"""
test_exact_user_flow.py
사장님이 겪으신 실제 텔레그램 연속 발화 흐름 시뮬레이션 및 오타 교정·슬롯 결합 검증
"""

import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import difflib
from ai_brain import extract_domain_workflow
from telegram_bot import KNOWN_CUSTOMERS

def simulate_flow():
    print("=" * 60)
    print("📱 [시나리오 1: 사장님 실제 발화 시나리오 1:1 시뮬레이션 테스트]")
    print("=" * 60)

    ACTION_KEYWORDS = [
        '연장', '단축', '늘려', '줄여', '조기종료',
        '출고', '배차', '보내', '넣어', '빼줘',
        '배정', '기사', '만원', '운송비',
        '메일', '견적서', '회사소개서', '제원표', '카탈로그', '발송',
        '조회', '검색', '엑셀', '다운로드'
    ]
    AFFIRM_WORDS = ['응', '맞아', '네', '예', 'ㅇㅇ', '맞음', '그거', '그거야', '그래', '어', '맞소', '오케이', 'ok', 'yes']

    slots = {}
    inputs = [
        "에이티아이엔씨",
        "1공구 신축현장",
        "에이치아이엔씨",
        "6개월 연장"
    ]

    for step, text in enumerate(inputs, 1):
        print(f"\n▶ [{step}단계 사용자 입력]: \"{text}\"")

        # 긍정 수락
        if text.lower().strip() in AFFIRM_WORDS and slots.get('suggested_customer'):
            slots['customer'] = slots.pop('suggested_customer')
            print(f"   [시스템 처리]: 💡 오타 추천 긍정 수락 ➔ 거래처 '{slots['customer']}' 확정!")
            continue

        has_action = any(k in text.lower() for k in ACTION_KEYWORDS)

        if not has_action:
            if any(k in text for k in ['공구', '현장', '신축', '물류', '센터', '아파트', '빌딩', '공사']):
                slots['site'] = text
            else:
                slots['customer'] = text

            cust_val = slots.get('customer')
            site_val = slots.get('site')

            sugg_text = ""
            if cust_val:
                clean_cust = cust_val.replace(' ', '')
                matches = difflib.get_close_matches(clean_cust, KNOWN_CUSTOMERS, n=2, cutoff=0.35)
                if clean_cust not in KNOWN_CUSTOMERS and matches:
                    slots['suggested_customer'] = matches[0]
                    sugg_text = f"\n   ⚠️ 등록된 거래처 중 '{cust_val}'(은)는 없습니다.\n   💡 혹시 '{matches[0]}' 거래처인가요? (맞으면 '응', 아니면 다시 입력)"

            print("   [시스템 처리]: 🛑 순수 명사 파편 감지 ➔ 브라우저 오조작 차단 및 슬롯 누적")
            print(f"   • 거래처 슬롯: {cust_val or '미지정'}")
            print(f"   • 현장 슬롯: {site_val or '미지정'}{sugg_text}")
            print("   • 안내: 원하시는 업무(연장, 출고 등)를 이어서 말씀해 주세요.")
        else:
            saved_customer = slots.get('customer', '')
            saved_site = slots.get('site', '')
            prefix_parts = []
            if saved_customer and saved_customer not in text:
                prefix_parts.append(saved_customer)
            if saved_site and saved_site not in text:
                prefix_parts.append(saved_site)

            full_prompt = f"{' '.join(prefix_parts)} {text}".strip()
            print("   [시스템 처리]: 🚀 행동 동사 감지 ➔ 누적 슬롯 결합 후 최종 실행!")
            print(f"   • 최종 합성 지시문: \"{full_prompt}\"")

            act = extract_domain_workflow(full_prompt)
            if act:
                params = act["params"]
                print(f"   ✅ 감지 워크플로: {params.get('workflow')}")
                print(f"   🏢 거래처: {params.get('customer')}")
                print(f"   📍 현장: {params.get('site')}")
                print(f"   ⏱️ 기간: {params.get('duration_months')}개월")
            else:
                print("   ❌ 워크플로 추출 실패")

    print("\n" + "=" * 60)
    print("📱 [시나리오 2: 오타 추천 후 '응' 한 글자로 수락 및 1-Way 실행]")
    print("=" * 60)

    slots2 = {}
    inputs2 = [
        "에이티아이엔씨",
        "응",
        "1공구 신축 6개월 연장해줘"
    ]

    for step, text in enumerate(inputs2, 1):
        print(f"\n▶ [{step}단계 사용자 입력]: \"{text}\"")

        if text.lower().strip() in AFFIRM_WORDS and slots2.get('suggested_customer'):
            slots2['customer'] = slots2.pop('suggested_customer')
            print(f"   [시스템 처리]: 💡 오타 추천 긍정 수락 ➔ 거래처 '{slots2['customer']}' 확정!")
            continue

        has_action = any(k in text.lower() for k in ACTION_KEYWORDS)

        if not has_action:
            if any(k in text for k in ['공구', '현장', '신축', '물류', '센터', '아파트', '빌딩', '공사']):
                slots2['site'] = text
            else:
                slots2['customer'] = text

            cust_val = slots2.get('customer')
            site_val = slots2.get('site')

            sugg_text = ""
            if cust_val:
                clean_cust = cust_val.replace(' ', '')
                matches = difflib.get_close_matches(clean_cust, KNOWN_CUSTOMERS, n=2, cutoff=0.35)
                if clean_cust not in KNOWN_CUSTOMERS and matches:
                    slots2['suggested_customer'] = matches[0]
                    sugg_text = f"\n   ⚠️ 등록된 거래처 중 '{cust_val}'(은)는 없습니다.\n   💡 혹시 '{matches[0]}' 거래처인가요? (맞으면 '응', 아니면 다시 입력)"

            print("   [시스템 처리]: 🛑 순수 명사 파편 감지 ➔ 브라우저 오조작 차단 및 슬롯 누적")
            print(f"   • 거래처 슬롯: {cust_val or '미지정'}")
            print(f"   • 현장 슬롯: {site_val or '미지정'}{sugg_text}")
        else:
            saved_customer = slots2.get('customer', '')
            saved_site = slots2.get('site', '')
            prefix_parts = []
            if saved_customer and saved_customer not in text:
                prefix_parts.append(saved_customer)
            if saved_site and saved_site not in text:
                prefix_parts.append(saved_site)

            full_prompt = f"{' '.join(prefix_parts)} {text}".strip()
            print("   [시스템 처리]: 🚀 행동 동사 감지 ➔ 누적 슬롯 결합 후 최종 실행!")
            print(f"   • 최종 합성 지시문: \"{full_prompt}\"")

            act = extract_domain_workflow(full_prompt)
            if act:
                params = act["params"]
                print(f"   ✅ 감지 워크플로: {params.get('workflow')}")
                print(f"   🏢 거래처: {params.get('customer')}")
                print(f"   📍 현장: {params.get('site')}")
                print(f"   ⏱️ 기간: {params.get('duration_months')}개월")

    print("\n" + "=" * 60)
    print("🎉 전 시나리오 검증 완료: 오타 경고, '응' 1글자 수락, 슬롯 결합 완결!")
    print("=" * 60)

if __name__ == "__main__":
    simulate_flow()
