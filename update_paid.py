with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace PAID section
paid_start = text.find('<div data-mid="table-paid-options" style={{ display: \'flex\', flexDirection: \'column\', gap: \'8px\' }}>')
paid_end = text.find('{/* 2. 보양 작업 (PROTECTION) 섹션 */}')

paid_new = '''<div data-mid="table-paid-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
          현장에 추가된 유상 옵션이 없습니다. 상단의 드롭다운에서 등록된 마스터 품목을 선택하여 현장에 추가해주세요.
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

                  '''

text = text[:paid_start] + paid_new + text[paid_end:]

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("PAID section updated.")
