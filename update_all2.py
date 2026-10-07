with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add X to lucide-react imports
if ' X,' not in text and 'X ' not in text and 'X}' not in text:
    text = text.replace('Sliders', 'Sliders, X')

start_marker = '<div data-mid="table-paid-options"'
end_marker = '{/* ──────────────────────────────────────────────────────── */}'

start_idx = text.find(start_marker)
# Find the next </div> that closes the central panel, but it's easier to find the footer block.
end_marker2 = '{/* 하단 고정 액션 바 (Z-패턴 ④) */}'
end_idx = text.find(end_marker2, start_idx)

if start_idx == -1 or end_idx == -1:
    print(f"Could not find markers! start_idx={start_idx}, end_idx={end_idx}")
    exit(1)

new_content = '''<div data-mid="table-paid-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#2563eb" /> 1. 유상 옵션 (PAID) - 옵션품목마스터 상속
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 추가된 현장 특약 단가 오버라이드 가능
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleToggleOption(e.target.value);
                        }}
                        style={{ height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', minWidth: '220px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      >
                        <option value="" disabled>+ 현장에 추가할 옵션 마스터 선택...</option>
                        {workingOptionItems.filter(item => item.category === 'PAID' && !item.isEnabled).map(item => (
                          <option key={item.optionId} value={item.optionId}>{item.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setActiveTab('MASTER_OPTIONS')} style={{ fontSize: '11px', padding: '0 10px', height: '30px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 }}>
                        마스터 품목 관리
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px 10px', width: '60px', textAlign: 'center' }}>적용 해제</th>
                            <th style={{ padding: '8px 10px', width: '200px' }}>옵션 품목명</th>
                            <th style={{ padding: '8px 10px', width: '90px' }}>기준단가</th>
                            <th style={{ padding: '8px 10px', width: '130px' }}>현장 특약단가 (₩)</th>
                            <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center' }}>필수</th>
                            <th style={{ padding: '8px 10px' }}>현장 규격 메모</th>
                          </tr>
                        </thead>
                        <tbody>
{workingOptionItems.filter(item => item.category === 'PAID' && item.isEnabled).length === 0 ? (
  <tr>
    <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div>
          현장에 추가된 유상 옵션이 없습니다. 상단의 드롭다운에서 등록된 마스터 품목을 선택하여 추가해주세요.
        </div>
      </div>
    </td>
  </tr>
) : (
  workingOptionItems.filter(item => item.category === 'PAID' && item.isEnabled).map(item => {
    return (
      <tr 
        key={item.id}
        style={{
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'rgba(37, 99, 235, 0.03)'
        }}
      >
        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => handleToggleOption(item.optionId)}
            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
          >
            제외
          </button>
        </td>
        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1d4ed8' }}>
          {item.name}
        </td>
        <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
          ₩{(item.defaultPrice || 0).toLocaleString()}
        </td>
        <td style={{ padding: '8px 10px' }}>
          <input
            type="number"
            value={item.appliedPrice}
            onChange={e => handlePriceChange(item.optionId, Number(e.target.value))}
            style={{
              width: '100px',
              height: '28px',
              padding: '0 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '11.5px'
            }}
          />
        </td>
        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={item.isRequired}
            onChange={() => handleToggleRequired(item.optionId)}
            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
          />
        </td>
        <td style={{ padding: '8px 10px' }}>
          <input
            type="text"
            placeholder="현장 특이사항"
            value={item.note || ''}
            onChange={e => handleNoteChange(item.optionId, e.target.value)}
            style={{
              width: '100%',
              height: '28px',
              padding: '0 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '11.5px'
            }}
          />
        </td>
      </tr>
    );
  })
)}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 2. 보양 작업 (PROTECTION) 섹션 */}
                  <div data-mid="card-protection-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#059669" /> 2. 보양 작업 (PROTECTION) - 1종 선택
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 현장 환경에 따른 보호 완충/함석 보양 규격 지정
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <select
                        value={workingOptionItems.find(i => i.category === 'PROTECTION' && i.isEnabled)?.optionId || ""}
                        onChange={(e) => handleSelectProtection(e.target.value)}
                        style={{ height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', minWidth: '220px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      >
                        <option value="" disabled>현장에 적용할 보양 작업 마스터 선택...</option>
                        {workingOptionItems.filter(item => item.category === 'PROTECTION').map(item => (
                          <option key={item.optionId} value={item.optionId}>{item.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleSelectProtection('')} style={{ fontSize: '11px', padding: '0 10px', height: '30px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 }}>
                        적용 해제
                      </button>
                      <button type="button" onClick={() => setActiveTab('MASTER_OPTIONS')} style={{ fontSize: '11px', padding: '0 10px', height: '30px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 }}>
                        마스터 품목 관리
                      </button>
                    </div>
                  </div>

                  {/* 3. 현장 요구 사양 (SPEC) 섹션 */}
                  <div data-mid="card-spec-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckSquare size={15} color="#d97706" /> 3. 현장 요구 사양 (SPEC)
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        * 안전인증, 경광등, 센서 연동 등 필수 사양 점검
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) handleToggleOption(e.target.value);
                        }}
                        style={{ height: '30px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '12px', minWidth: '220px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                      >
                        <option value="" disabled>+ 현장에 추가할 사양 마스터 선택...</option>
                        {workingOptionItems.filter(item => item.category === 'SPEC' && !item.isEnabled).map(item => (
                          <option key={item.optionId} value={item.optionId}>{item.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setActiveTab('MASTER_OPTIONS')} style={{ fontSize: '11px', padding: '0 10px', height: '30px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 700 }}>
                        마스터 품목 관리
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
{workingOptionItems.filter(item => item.category === 'SPEC' && item.isEnabled).length === 0 ? (
  <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <span>현장에 적용된 요구 사양이 없습니다. 상단의 드롭다운에서 등록된 마스터 품목을 선택하여 추가해주세요.</span>
    </div>
  </div>
) : (
  workingOptionItems.filter(item => item.category === 'SPEC' && item.isEnabled).map(item => {
    return (
      <div
        key={item.id}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 10px 6px 6px', borderRadius: '8px',
          border: '1.5px solid #d97706',
          backgroundColor: 'rgba(217, 119, 6, 0.08)',
        }}
      >
        <button
          type="button"
          onClick={() => handleToggleOption(item.optionId)}
          style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
          title="사양 제외"
        >
          <X size={14} strokeWidth={3} />
        </button>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>
          {item.name}
        </span>
      </div>
    );
  })
)}
                    </div>
                  </div>

                </div>

                '''

text = text[:start_idx] + new_content + text[end_idx:]

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("All 3 sections updated cleanly with correct bounds!")
