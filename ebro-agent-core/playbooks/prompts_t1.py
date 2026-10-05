"""T1 업무지시 해석 (텔레그램) 프롬프트와 출력 검증기.

단일 원천: playbooks/directive_types.yaml
출력 규격: {"type":..., "slots":{...}, "missing":[...]}  (thought 없음, 키에 * 금지)

규약
- TASK, OUTPUT_CAP_TOKENS
- build_system_prompt(**ctx) -> str   호출마다 동일한 고정 문자열 (role 정보 없음)
- build_user_message(**ctx) -> str    지시 원문 (되묻기 재호출이면 원문 + 줄바꿈 + 응답)
- validate_output(obj, user_message, ctx) -> list[str]   위반 사유 목록 (빈 목록이면 통과)

택1 필수 슬롯(requireAnyOf) 규칙: 후보 슬롯이 모두 원문에 없으면 missing 에 후보 목록의 첫 번째 키를 넣는다.
CHANNEL_FORBIDDEN 의 targetAction 은 YAML targetActionValues 의 코드값(닫힌 집합)이며 원문 부분 문자열 검사에서 제외한다.
OUT_OF_SCOPE 는 slots 를 빈 객체로 출력한다.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

import yaml

TASK = "T1"
OUTPUT_CAP_TOKENS = 80
YAML_PATH = Path(__file__).resolve().parent / "directive_types.yaml"
FOLLOWUP_JOINER = "\n"


@lru_cache(maxsize=1)
def load_spec(path: str | None = None) -> dict:
    p = Path(path) if path else YAML_PATH
    with open(p, encoding="utf-8") as f:
        return yaml.safe_load(f)


def type_table(spec: dict | None = None) -> dict:
    spec = spec or load_spec()
    return {t["type"]: t for t in spec["types"]}


def required_keys(t: dict) -> list[str]:
    return [k for k, v in t.get("slots", {}).items() if v.get("required")]


def expected_missing(t: dict, slots: dict) -> list[str]:
    """YAML 규칙으로 계산한 정답 missing (YAML 슬롯 순서)."""
    miss = [k for k in required_keys(t) if k not in slots]
    any_of = t.get("requireAnyOf")
    if any_of and not any(k in slots for k in any_of):
        miss.append(any_of[0])
    return miss


def canonical_output(type_code: str, slots: dict, missing: list[str]) -> str:
    return json.dumps(
        {"type": type_code, "slots": slots, "missing": missing},
        ensure_ascii=False, separators=(",", ":"),
    )


def build_system_prompt(**ctx) -> str:
    """고정 문자열. 유형 코드와 슬롯 키만 한 줄로 나열한다."""
    spec = load_spec()
    parts = []
    for t in spec["types"]:
        code = t["type"]
        if code == "CHANNEL_FORBIDDEN":
            parts.append(code + ":targetAction=" + "/".join(t["targetActionValues"]))
            continue
        if code == "OUT_OF_SCOPE":
            parts.append(code + ":-")
            continue
        req = required_keys(t)
        opt = [k for k in t["slots"] if k not in req]
        any_of = t.get("requireAnyOf")
        if any_of:
            body = "[" + "/".join(any_of) + "]"
            opt = [k for k in opt if k not in any_of]
        else:
            body = ",".join(req)
        if opt:
            body += "|" + ",".join(opt)
        parts.append(code + ":" + body)
    head = (
        "업무지시를 JSON 한 줄 {\"type\",\"slots\",\"missing\"}로만 출력한다. "
        "slots 값은 지시 원문에서 그대로 복사하고, 없는 값은 지어내지 않고 필수 키를 missing 에 적는다. "
        "자산번호 지정은 slots 에 넣지 않는다. "
        "유형:필수키|선택키, [a/b]는 택1. "
    )
    return head + " ".join(parts)


def build_user_message(text: str = "", followup: str | None = None, **ctx) -> str:
    """지시 원문. 되묻기 응답이 있으면 원문과 응답을 줄바꿈으로 이어 붙인다."""
    text = (text or "").strip()
    if followup:
        return text + FOLLOWUP_JOINER + followup.strip()
    return text


def _norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def validate_output(obj, user_message: str, ctx: dict | None = None) -> list[str]:
    ctx = ctx or {}
    errs: list[str] = []
    if not isinstance(obj, dict):
        return ["출력이 객체가 아님"]
    extra = set(obj) - {"type", "slots", "missing"}
    lack = {"type", "slots", "missing"} - set(obj)
    if extra:
        errs.append("허용되지 않은 최상위 키: " + ",".join(sorted(extra)))
    if lack:
        errs.append("누락된 최상위 키: " + ",".join(sorted(lack)))
        return errs
    table = type_table()
    code = obj["type"]
    if not isinstance(code, str) or code not in table:
        return errs + [f"정의서에 없는 유형: {code!r}"]
    t = table[code]
    slots, missing = obj["slots"], obj["missing"]
    if not isinstance(slots, dict):
        return errs + ["slots 가 객체가 아님"]
    if not isinstance(missing, list) or not all(isinstance(m, str) for m in missing):
        return errs + ["missing 이 문자열 목록이 아님"]
    allowed = set(t.get("slots", {}))
    if t["group"] == "OUT_OF_SCOPE" and slots:
        errs.append("OUT_OF_SCOPE 는 slots 가 비어 있어야 함")
    norm_msg = _norm_ws(user_message)
    for k, v in slots.items():
        if "*" in k:
            errs.append(f"키에 * 포함: {k}")
        if k not in allowed:
            errs.append(f"{code} 에 허용되지 않은 슬롯 키: {k}")
            continue
        if not isinstance(v, str) or not v.strip():
            errs.append(f"슬롯 값이 빈 문자열이거나 문자열이 아님: {k}")
            continue
        if code == "CHANNEL_FORBIDDEN" and k == "targetAction":
            if v not in t["targetActionValues"]:
                errs.append(f"targetAction 이 정의서 코드값이 아님: {v}")
            continue
        if _norm_ws(v) not in norm_msg:
            errs.append(f"슬롯 값이 원문의 부분 문자열이 아님: {k}={v!r}")
    if len(set(missing)) != len(missing):
        errs.append("missing 중복")
    exp = expected_missing(t, slots)
    if set(missing) != set(exp):
        errs.append(f"missing 불일치: 출력={missing} 기대={exp}")
    for m in missing:
        if m in slots:
            errs.append(f"missing 키가 slots 에도 있음: {m}")
    return errs
