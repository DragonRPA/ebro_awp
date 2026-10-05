"""T3 통화 녹취 분석 프롬프트와 출력 검증기.

단일 원천: playbooks/directive_types.yaml (callWorkflows, types.label)
출력 규격: {"workflow","customer","site","model","quantity","target_date","duration_months"} 7개 키만 (summary, memo 없음)
값은 녹취 원문의 부분 문자열이거나 빈 문자열 (원문에 없으면 빈 값, 기본값 금지). 값은 모두 문자열이다.
수량·기간·날짜 정규화는 코드가 한다.

규약: TASK, OUTPUT_CAP_TOKENS, build_system_prompt(**ctx), build_user_message(**ctx), validate_output(obj, user_message, ctx)
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

import yaml

TASK = "T3"
OUTPUT_CAP_TOKENS = 100
YAML_PATH = Path(__file__).resolve().parent / "directive_types.yaml"
FIELDS = ["workflow", "customer", "site", "model", "quantity", "target_date", "duration_months"]
VALUE_FIELDS = FIELDS[1:]
USER_HEADER = "[통화 녹취록]\n"


@lru_cache(maxsize=1)
def load_spec() -> dict:
    with open(YAML_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def workflows() -> list[str]:
    return list(load_spec()["callWorkflows"])


def canonical_output(workflow: str, **values) -> str:
    obj = {"workflow": workflow}
    for k in VALUE_FIELDS:
        obj[k] = values.get(k, "")
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def build_system_prompt(**ctx) -> str:
    spec = load_spec()
    labels = {t["type"]: t["label"] for t in spec["types"]}
    wf = " ".join(f"{c}={labels[c]}" for c in spec["callWorkflows"] if c in labels)
    return (
        "통화 녹취록을 읽고 JSON 한 줄로만 출력한다. 키: " + ",".join(FIELDS) + ". "
        "workflow 는 다음 중 하나: " + wf + ". "
        "나머지 값은 녹취 원문에서 그대로 복사하고, 원문에 없으면 빈 문자열로 둔다. 정정된 말은 정정 후 값을 쓴다. 추측과 기본값 금지."
    )


def build_user_message(text: str = "", **ctx) -> str:
    return USER_HEADER + (text or "").strip()


def _norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def validate_output(obj, user_message: str, ctx: dict | None = None) -> list[str]:
    ctx = ctx or {}
    errs: list[str] = []
    if not isinstance(obj, dict):
        return ["출력이 객체가 아님"]
    extra = set(obj) - set(FIELDS)
    lack = set(FIELDS) - set(obj)
    if extra:
        errs.append("허용되지 않은 키: " + ",".join(sorted(extra)))
    if lack:
        errs.append("누락된 키: " + ",".join(sorted(lack)))
    wf = obj.get("workflow")
    if not isinstance(wf, str) or wf not in workflows():
        errs.append(f"정의서에 없는 workflow: {wf!r}")
    body = user_message[len(USER_HEADER):] if user_message.startswith(USER_HEADER) else user_message
    norm_body = _norm_ws(body)
    for k in VALUE_FIELDS:
        if k not in obj:
            continue
        v = obj[k]
        if not isinstance(v, str):
            errs.append(f"값이 문자열이 아님: {k}")
            continue
        if v == "":
            continue
        if _norm_ws(v) not in norm_body:
            errs.append(f"값이 원문의 부분 문자열이 아님: {k}={v!r}")
    return errs
