import urllib.request, json
payload = {
    'model': 'ebro-agent',
    'messages': [
        {
            'role': 'system',
            'content': '너는 eBro 시스템의 업무 의도 파악 및 파라미터 추출 에이전트야.\n사용자의 자연어 요청을 분석해서 아래 JSON 형식으로만 응답해:\n{\n  "intent": "파악된 업무 의도 . 반드시 다음 중 하나만 선택해: [asset_search, billing_request_create, click_element, contract_create, customer_create, customer_search, dispatch_assign_driver, dispatch_create_order, maintenance_create, navigate_menu, pdi_approve, site_option_update, vacation_create]",\n  "parameters": {\n    "추출된_변수명": "값"\n  }\n}\n일반적인 대화나 설명은 일절 출력하지 말고 오직 JSON만 반환해.'
        },
        {'role': 'user', 'content': '내일 연차쓰고 싶어'}
    ],
    'response_format': {'type': 'json_object'},
    'temperature': 0.1
}
req = urllib.request.Request('http://127.0.0.1:8080/v1/chat/completions', method='POST', headers={'Content-Type': 'application/json'})
req.data = json.dumps(payload).encode('utf-8')
try:
    resp = urllib.request.urlopen(req).read().decode('utf-8')
    print(resp.encode('cp949', 'ignore').decode('cp949'))
except Exception as e:
    print('ERROR:', getattr(e, 'read', lambda: str(e))())
