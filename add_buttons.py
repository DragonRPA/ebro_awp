with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. PAID header
paid_header_old = '''<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#2563eb" /> 1. 유상 옵션 (PAID) - 옵션품목마스터 상속
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 체크 시 현장 적용, 단가 오버라이드 가능
                      </span>
                    </div>'''

paid_header_new = '''<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#2563eb" /> 1. 유상 옵션 (PAID) - 옵션품목마스터 상속
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setActiveTab('MASTER_OPTIONS')}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 700 }}
                        >
                          + 신규 품목 마스터 등록
                        </button>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          * 체크 시 현장 적용, 단가 오버라이드 가능
                        </span>
                      </div>
                    </div>'''

text = text.replace(paid_header_old, paid_header_new)

# 2. PROTECTION header
prot_header_old = '''<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#059669" /> 2. 보양 작업 (PROTECTION) - 1종 선택
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 현장 환경에 따른 보호 판넬/천막 보양 규격 지정
                      </span>
                    </div>'''

prot_header_new = '''<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#059669" /> 2. 보양 작업 (PROTECTION) - 1종 선택
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setActiveTab('MASTER_OPTIONS')}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 700 }}
                        >
                          + 신규 작업 마스터 등록
                        </button>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          * 현장 환경에 따른 보호 판넬/천막 보양 규격 지정
                        </span>
                      </div>
                    </div>'''

text = text.replace(prot_header_old, prot_header_new)

# 3. SPEC header
spec_header_old = '''<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckSquare size={15} color="#d97706" /> 3. 현장 요구 사양 (SPEC)
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 안전인증, 경광등, 센서 연동 필수 사양 점검
                      </span>
                    </div>'''

spec_header_new = '''<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckSquare size={15} color="#d97706" /> 3. 현장 요구 사양 (SPEC)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setActiveTab('MASTER_OPTIONS')}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--primary)', color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 700 }}
                        >
                          + 신규 사양 마스터 등록
                        </button>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          * 안전인증, 경광등, 센서 연동 필수 사양 점검
                        </span>
                      </div>
                    </div>'''

text = text.replace(spec_header_old, spec_header_new)

# 4. Empty States Buttons
paid_empty_old = '''<AlertCircle size={16} style={{ display: 'inline-block', marginBottom: '-3px', marginRight: '4px' }} />
      등록된 유상 옵션 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.'''

paid_empty_new = '''<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div>
          <AlertCircle size={16} style={{ display: 'inline-block', marginBottom: '-3px', marginRight: '4px' }} />
          등록된 유상 옵션 마스터가 없습니다. 품목을 먼저 등록해야 현장에 적용할 수 있습니다.
        </div>
        <button 
          type="button" 
          onClick={() => setActiveTab('MASTER_OPTIONS')}
          style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--primary)', backgroundColor: 'transparent', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
        >
          + 옵션 품목 마스터 등록하기
        </button>
      </div>'''

text = text.replace(paid_empty_old, paid_empty_new)

prot_empty_old = '''등록된 보양 작업 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.'''
prot_empty_new = '''<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <span>등록된 보양 작업 마스터가 없습니다. 작업을 먼저 등록해야 현장에 적용할 수 있습니다.</span>
      <button 
        type="button" 
        onClick={() => setActiveTab('MASTER_OPTIONS')}
        style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--primary)', backgroundColor: 'transparent', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}
      >
        + 보양 작업 마스터 등록하기
      </button>
    </div>'''
text = text.replace(prot_empty_old, prot_empty_new)

spec_empty_old = '''등록된 현장 요구 사양 마스터가 없습니다. 상단 [옵션 품목 마스터]에서 항목을 추가해주세요.'''
spec_empty_new = '''<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <span>등록된 현장 요구 사양 마스터가 없습니다. 사양을 먼저 등록해야 현장에 적용할 수 있습니다.</span>
      <button 
        type="button" 
        onClick={() => setActiveTab('MASTER_OPTIONS')}
        style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--primary)', backgroundColor: 'transparent', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}
      >
        + 요구 사양 마스터 등록하기
      </button>
    </div>'''
text = text.replace(spec_empty_old, spec_empty_new)


with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("Added action buttons")
