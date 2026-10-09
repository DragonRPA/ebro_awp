const fs = require('fs');
let c = fs.readFileSync('src/components/AssetInboundStaging.tsx', 'utf8');

const hookLogic = `
  const activeInspectionItem = inspectionModalAssetId ? getStagedItem(inspectionModalAssetId) : null;

  const outboundInspectionRecord = useMemo(() => {
    if (!activeInspectionItem) return null;
    return outboundInspections
      .filter(oi => oi.assetId === activeInspectionItem.assetId && oi.status === 'COMPLETED')
      .sort((a, b) => new Date(b.approvedAt || 0).getTime() - new Date(a.approvedAt || 0).getTime())[0];
  }, [outboundInspections, activeInspectionItem]);

  const outboundOptionsData = useMemo(() => {
    if (!outboundInspectionRecord || !outboundInspectionRecord.specsJson) return null;
    try {
      return JSON.parse(outboundInspectionRecord.specsJson);
    } catch (e) {
      return null;
    }
  }, [outboundInspectionRecord]);
`;

c = c.replace(
  "  const activeInspectionItem = inspectionModalAssetId ? getStagedItem(inspectionModalAssetId) : null;",
  hookLogic
);

const uiLogic = `
            <div style={{ padding: '20px' }}>
              {/* 💡 출고 당시 장착 옵션 내역 표시 */}
              {outboundOptionsData && outboundOptionsData.checkpoints && outboundOptionsData.checkpoints.length > 0 && (
                <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <ShieldCheck size={16} color="#0284c7" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>출고 시 검수/장착 옵션 정보</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {outboundOptionsData.checkpoints.filter((cp: any) => cp.type === 'OPTION' || cp.type === 'SPEC').map((cp: any) => (
                      <div key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0f172a' }}>
                        <CheckCircle2 size={12} color="#16a34a" />
                        <span>{cp.label}</span>
                      </div>
                    ))}
                  </div>
                  {outboundOptionsData.inspectionNote && (
                    <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '4px', fontSize: '12px', color: '#475569' }}>
                      <strong>출고 특이사항:</strong> {outboundOptionsData.inspectionNote}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
`;

c = c.replace(
  "            <div style={{ padding: '20px' }}>\r\n              <div style={{ marginBottom: '16px' }}>",
  uiLogic
);

c = c.replace(
  "            <div style={{ padding: '20px' }}>\n              <div style={{ marginBottom: '16px' }}>",
  uiLogic
);

fs.writeFileSync('src/components/AssetInboundStaging.tsx', c);
console.log('Inbound injected');
