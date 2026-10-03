"""
ebro-agent-core/stt_engine.py
NVIDIA GeForce RTX 5080 GPU 가속 기반 faster-whisper 로컬 음성인식 엔진
스마트폰 통화 자동 녹음 파일(.m4a, .mp3, .wav) 및 텔레그램 음성 메시지 전용
"""

import os
import sys
import torch
from faster_whisper import WhisperModel

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

MODEL_SIZE = "base" # base(초고속 ~0.5초), small(정밀)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"

class SttEngine:
    def __init__(self):
        self.model = None
        self._is_loading = False

    def _ensure_model(self):
        if self.model is None and not self._is_loading:
            self._is_loading = True
            print(f"🎙️ [SttEngine] Faster-Whisper '{MODEL_SIZE}' 모델 로딩 시작 (Device: {DEVICE}, Compute: {COMPUTE_TYPE})...")
            try:
                self.model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
                print("✅ [SttEngine] Faster-Whisper 로컬 GPU 모델 로드 완료")
            except Exception as e:
                print(f"⚠️ [SttEngine] GPU 로드 실패 -> CPU 폴백 시도: {e}")
                self.model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
            finally:
                self._is_loading = False

    def is_ready(self) -> bool:
        self._ensure_model()
        return self.model is not None

    def transcribe(self, audio_path: str) -> str:
        """
        오디오 파일 경로를 받아 한국어 텍스트로 고속 변환
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {audio_path}")

        self._ensure_model()

        segments, info = self.model.transcribe(
            audio_path,
            beam_size=5,
            language="ko",
            vad_filter=True, # 무음 구간 자동 필터링
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        texts = [segment.text.strip() for segment in segments]
        full_text = " ".join(texts).strip()
        return full_text

stt_engine = SttEngine()
