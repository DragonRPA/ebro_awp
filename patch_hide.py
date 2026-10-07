import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/SiteOptionManage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Hide Tab Header
text = text.replace(
    '''{/* 2. 탭 헤더 */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color)', marginBottom: '4px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('SITE_OPTIONS')}
          style={{
            padding: '10px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'SITE_OPTIONS' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'SITE_OPTIONS' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'SITE_OPTIONS' ? 800 : 600,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Building2 size={16} />
          현장별 옵션 매핑 (참조 동기화)
        </button>
        <button
          type="button"
          data-mid="btn-option-master-manage"
          onClick={() => setActiveTab('MASTER_OPTIONS')}
          style={{
            padding: '10px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'MASTER_OPTIONS' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'MASTER_OPTIONS' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'MASTER_OPTIONS' ? 800 : 600,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Database size={16} />
          옵션 품목 마스터 (SSOT)
        </button>
      </div>''',
    '''{/* 2. 탭 헤더 (숨김 처리 - 사용자 요청: 등록된 옵션마스터를 선택해서 현장에 옵션이 필요함을 저장하는 기능만 노출) */}'''
)

# Hide quick links to Master Options
import re
text = re.sub(r'<button type="button" onClick=\{\(\) => setActiveTab\(\'MASTER_OPTIONS\'\)\}.*?</button>', '', text, flags=re.DOTALL)

with open('src/pages/SiteOptionManage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
