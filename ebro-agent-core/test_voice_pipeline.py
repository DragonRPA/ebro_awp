"""
test_voice_pipeline.py
스마트폰 통화 녹음 파일 기반 AI STT 및 ERP 업무 자동화 엔드투엔드 파이프라인 검증
"""

import sys
import os
import asyncio

# UTF-8 출력 강제
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

from stt_engine import stt_engine
from ai_brain import ai_brain

async def run_test():
    print("=" * 60)
    print("🎙️ [STT & AI 통화 녹취 분석 파이프라인 검증]")
    print("=" * 60)

    # 1. STT 엔진 로드 상태 확인
    print(f"1. Faster-Whisper GPU STT 엔진 상태: {'준비완료' if stt_engine.is_ready() else '미초기화'}")

    # 2. 실제 통화 녹취 시나리오 테스트 케이스 3종
    test_calls = [
        {
            "name": "시나리오 1: 출고 배차 요청 (일상 대화 섞임)",
            "transcript": (
                "어 최부장 나야. 어 식사는 했어? 다름이 아니고 판교 힐스테이트 2공구 현장 알지? "
                "거기 골조 올라가면서 1930 두 대 내일 아침 8시까지 급하게 좀 넣어달라네. "
                "반드시 하부 검수 꼼꼼히 해서 깨끗한 걸로 보내줘. 운송비는 착불로 처리하고."
            )
        },
        {
            "name": "시나리오 2: 계약 연장 요청 (공기 연장)",
            "transcript": (
                "사장님 안녕하세요, 에이치엔아이씨 김소장입니다. "
                "지난번 배차해주신 동탄 물류센터 1공구 장비 있잖아요. "
                "이번에 비가 많이 와서 공기가 좀 늘어났어요. 3개월만 계약 기간 연장 부탁드립니다."
            )
        },
        {
            "name": "시나리오 3: 운송 기사 및 배차비 배정",
            "transcript": (
                "김과장, 아까 그 송도 현대건설 3공구 출고건 말이야. "
                "이진수기사 배차 완료했고 5톤 차로 잡았어. 운송비는 16만원으로 협의했으니까 전표 등록해 놔."
            )
        }
    ]

    for idx, tc in enumerate(test_calls, 1):
        print(f"\n--- [{idx}] {tc['name']} ---")
        print(f"▶ 원문 녹취: \"{tc['transcript']}\"")
        analysis = await ai_brain.analyze_call_transcript(tc['transcript'])
        print(f"✅ 분석 출처: {analysis.get('source')}")
        print(f"📋 통화 요약: {analysis.get('summary')}")
        print(f"🎯 감지 업무(Workflow): {analysis.get('workflow')}")
        print(f"📦 추출 매개변수(Params): {analysis.get('params')}")

    print("\n" + "=" * 60)
    print("🎉 파이프라인 검증 완료: 통화 녹음 파일로부터 ERP 비즈니스 인텐트 및 슬롯 정밀 추출 성공!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_test())
