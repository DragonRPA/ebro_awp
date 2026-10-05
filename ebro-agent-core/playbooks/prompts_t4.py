# -*- coding: utf-8 -*-
"""
T4 밴드 출고요청 변환 (보조 작업)

모델 출력: {"band_dispatch_json":{...17개 필드...}} 한 줄. 출력 상한 400토큰.
band_post_text 는 출력하지 않는다 (코드가 band_dispatch_json 으로 생성).
원문 근거 없는 값은 빈 문자열. 값은 user 원문의 연속 부분 문자열(공백 정규화만 허용).
"""
import re

TASK = "T4"
OUTPUT_CAP_TOKENS = 400

# (필드 키, 표시명). 순서는 출력 순서와 같다.
FIELDS = (
    ("customer_name", "고객명"),
    ("site_name", "현장명"),
    ("site_contact", "현장 담당자"),
    ("site_email", "담당자 메일"),
    ("site_address", "현장 주소"),
    ("loading_time", "상차시간"),
    ("unloading_time", "하차시간"),
    ("model_name", "모델명"),
    ("paid_options", "유상옵션"),
    ("free_options", "무상옵션"),
    ("attachments", "부착물"),
    ("billing_contact", "청구 담당자"),
    ("statement_email", "거래명세서 메일"),
    ("tax_email", "계산서 메일"),
    ("closing_date", "마감일"),
    ("payment_date", "결제일"),
    ("remarks", "특이사항"),
)
FIELD_KEYS = tuple(k for k, _ in FIELDS)
EMAIL_FIELDS = ("site_email", "statement_email", "tax_email")
WRAPPER_KEY = "band_dispatch_json"

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+")
PHONE_RE = re.compile(r"0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}")


def build_system_prompt(**ctx):
    fields = " ".join("%s(%s)" % (k, n) for k, n in FIELDS)
    return (
        "출고요청 대화 원문에서 값을 추출해 JSON 한 줄로 출력한다. 설명 문장 금지.\n"
        "출력: {\"band_dispatch_json\":{필드:값}}\n"
        "필드: " + fields + "\n"
        "규칙: 값은 원문의 연속 부분 문자열. 원문에 없는 필드는 빈 문자열. 이메일은 원문 이메일 그대로."
    )


def build_user_message(conversation, **ctx):
    return conversation.strip()


def _norm(s):
    return re.sub(r"\s+", " ", s).strip()


def validate_output(obj, user_message, ctx=None):
    """위반 사유 목록. 빈 리스트면 통과."""
    errs = []
    if not isinstance(obj, dict):
        return ["NOT_OBJECT"]
    if set(obj.keys()) != {WRAPPER_KEY}:
        errs.append("KEYS:%s" % sorted(obj.keys()))
        return errs
    body = obj[WRAPPER_KEY]
    if not isinstance(body, dict):
        return ["BODY_NOT_OBJECT"]
    missing = [k for k in FIELD_KEYS if k not in body]
    extra = [k for k in body if k not in FIELD_KEYS]
    if missing:
        errs.append("MISSING_FIELDS:%s" % missing)
    if extra:
        errs.append("EXTRA_FIELDS:%s" % extra)
    norm_msg = _norm(user_message)
    for k in FIELD_KEYS:
        if k not in body:
            continue
        v = body[k]
        if not isinstance(v, str):
            errs.append("NOT_STRING:%s" % k)
            continue
        if v == "":
            continue
        if v not in user_message and _norm(v) not in norm_msg:
            errs.append("NOT_SUBSTRING:%s" % k)
        if k in EMAIL_FIELDS and (not EMAIL_RE.search(v) or not re.fullmatch(r"[\s/,;·]*", EMAIL_RE.sub("", v))):
            errs.append("NOT_EMAIL:%s" % k)
        for m in EMAIL_RE.findall(v):
            if m not in user_message:
                errs.append("EMAIL_NOT_IN_INPUT:%s" % k)
        for m in PHONE_RE.findall(v):
            if m not in user_message:
                errs.append("PHONE_NOT_IN_INPUT:%s" % k)
    return errs
