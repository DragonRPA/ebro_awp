const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

const lines = c.split('\n');
let out = [];
let skipping = false;
for(let line of lines) {
   if (line.includes('업무매뉴얼 바로가기버튼')) skipping = true;
   if (!skipping) out.push(line);
   if (skipping && line.includes('</button>')) skipping = false;
}
c = out.join('\n');

if (!c.includes('ManualsManage')) {
  c = c.replace("import { PrivacyAuditPage } from './pages/PrivacyAuditPage';", "import { PrivacyAuditPage } from './pages/PrivacyAuditPage';\nimport { ManualsManage } from './pages/ManualsManage';");
}

const manualBtnCode = `
const ContextualManualButton: React.FC = () => {
  const { activeTab, currentTenant } = useApp();
  const [manualUrl, setManualUrl] = React.useState<string | null>(null);
  const [showIframe, setShowIframe] = React.useState(false);
  const [headerNode, setHeaderNode] = React.useState<Element | null>(null);

  React.useEffect(() => {
    const fetchUrl = async () => {
      const { data } = await db.supabase.from('system_manuals').select('manual_url').eq('tenant_id', currentTenant).eq('menu_id', activeTab).single();
      if (data?.manual_url) setManualUrl(data.manual_url);
      else setManualUrl(null);
    };
    fetchUrl();

    const findHeader = () => {
      const main = document.querySelector('.main-content-area');
      if (!main) return null;
      const headers = main.querySelectorAll('h2, h3');
      for (const h of headers) {
        if (h.closest('.card') || h.closest('.page-header') || h.style.fontSize === '17px' || h.style.fontSize === '16px') {
           return h;
        }
      }
      return headers[0] || null;
    };

    let attempts = 0;
    const interval = setInterval(() => {
      const node = findHeader();
      if (node) {
        setHeaderNode(node);
        clearInterval(interval);
      }
      if (attempts++ > 10) clearInterval(interval);
    }, 100);

    return () => { clearInterval(interval); setHeaderNode(null); };
  }, [activeTab, currentTenant]);

  if (!manualUrl && !headerNode) return null;

  const Button = (
    <div style={{ display: 'inline-flex', marginLeft: '12px', verticalAlign: 'middle' }}>
      {manualUrl ? (
        <button
          onClick={(e) => { e.stopPropagation(); setShowIframe(true); }}
          style={{
            padding: '4px 8px', fontSize: '11px', borderRadius: '4px', backgroundColor: '#EFF6FF',
            color: '#2563EB', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
            height: '24px'
          }}
        >
          <BookOpen size={12} /> 매뉴얼 보기
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); window.alert('이 메뉴에 등록된 매뉴얼이 없습니다. [메뉴 매뉴얼 관리]에서 HTML 문서를 연결해주세요.'); }}
          style={{
            padding: '4px 8px', fontSize: '11px', borderRadius: '4px', backgroundColor: '#F3F4F6',
            color: '#9CA3AF', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
            height: '24px'
          }}
          title="등록된 매뉴얼 없음"
        >
          <BookOpen size={12} /> 매뉴얼 보기
        </button>
      )}

      {showIframe && manualUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }} onClick={() => setShowIframe(false)}>
          <div style={{ width: '90%', height: '90%', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '10px 16px', backgroundColor: '#1E293B', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}><BookOpen size={16}/> 매뉴얼 열람</h3>
              <button onClick={() => setShowIframe(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <iframe src={manualUrl} style={{ flex: 1, width: '100%', border: 'none' }} title="Manual Iframe" />
          </div>
        </div>
      )}
    </div>
  );

  return headerNode ? ReactDOM.createPortal(Button, headerNode) : null;
};
`;

if (!c.includes('ContextualManualButton')) {
  c = c.replace('const App: React.FC = () => {', "import ReactDOM from 'react-dom';\nimport { db } from './services/db';\n\n" + manualBtnCode + '\nconst App: React.FC = () => {');
}

if (!c.includes('<ContextualManualButton />')) {
  c = c.replace('<MirrorSyncProgressToast />', '<MirrorSyncProgressToast />\n        <ContextualManualButton />');
}

if (!c.includes("id: 'system_manuals'")) {
  const target = "id: 'sys_settings',\n        name: '시스템 환경설정',";
  const replacement = "id: 'system_manuals',\n        name: '메뉴 매뉴얼 관리',\n        icon: <BookOpen size={16} />,\n        component: <ManualsManage />\n      },\n      {\n        " + target;
  c = c.replace(target, replacement);
}

fs.writeFileSync('src/App.tsx', c);
