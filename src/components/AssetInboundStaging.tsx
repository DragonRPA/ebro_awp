import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, AlertTriangle, CheckCircle2, ShieldCheck, X, Camera } from 'lucide-react';
import { compressImageFile } from '../utils/imageCompressor';
import { InboundDefectDetail } from '../services/db';

interface StagedAsset {
  assetId: string;
  assetNo: string;
  modelName: string;
  customerName: string;
  siteName: string;
  contractId: string;
  penaltyScore: number;
  selectedChecklistIds: string[];
  defectPhotos: Record<string, string>;
  memo: string;
}

export const AssetInboundStaging: React.FC = () => {
  const { 
    assets, contracts, contractAssets, customers, sites, siteMasters, deliveries,
    inspectionChecklistItems, outboundInspections, registerInboundAsset, googleConfigs, showErrorModal
  } = useApp();

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [inboundDate, setInboundDate] = useState(getTodayStr());

  const [scanInput, setScanInput] = useState('');
  const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressState, setProgressState] = useState({ active: false, current: 0, total: 0, message: '' });

  // 화면 이탈 방지 (브라우저 닫기/새로고침 방어)
  useEffect(() => {
    if (!progressState.active) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [progressState.active]);

  // 모달 상태
  const [inspectionModalAssetId, setInspectionModalAssetId] = useState<string | null>(null);
  const [invalidAssets, setInvalidAssets] = useState<{ assetNo: string; status: string }[]>([]);

  // 스캔 처리 로직 (콤마, 공백, 엔터 분리)
  const handleScanInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processTokens(scanInput);
    }
  };

  const handleBlurScan = () => {
    if (scanInput.trim()) {
      processTokens(scanInput);
    }
  };

  const processTokens = (input: string) => {
    const tokens = input.split(/[, ]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
    if (tokens.length === 0) return;

    const newAssets: StagedAsset[] = [];
    const newInvalids: { assetNo: string; status: string }[] = [];
    
    tokens.forEach(token => {
      // 이미 목록에 있는지 확인
      if (stagedAssets.some(a => a.assetNo === token) || newAssets.some(a => a.assetNo === token)) {
        return; // 중복 패스
      }

      // 자산 찾기
      const asset = assets.find(a => a.assetNo.toUpperCase() === token);
      if (!asset) {
        showToast(`관리번호 ${token} 자산을 찾을 수 없습니다.`, 'error');
        return;
      }

      if (asset.status !== 'RENTED' && asset.status !== 'ASSIGNED') {
        newInvalids.push({ assetNo: asset.assetNo, status: asset.status });
        return;
      }

      // 렌탈 중인 계약 찾기 (contract_assets + contracts)
      let customerName = '-';
      let siteName = '-';
      let contractId = '';

      if (asset.currentCustomerId) {
        customerName = customers.find(c => c.id === asset.currentCustomerId)?.name || '-';
      }
      if (asset.currentSiteId) {
        siteName = sites.find(s => s.id === asset.currentSiteId)?.name || '-';
      }

      const ca = contractAssets.find(c => c.assetId === asset.id && (c.status === 'ACTIVE' || c.status === 'SCHEDULED'));
      if (ca) {
        contractId = ca.contractId;
        if (customerName === '-') {
           const contract = contracts.find(c => c.id === ca.contractId);
           if (contract) {
              customerName = customers.find(c => c.id === contract.customerId)?.name || '-';
              siteName = sites.find(s => s.id === contract.siteId)?.name || '-';
           }
        }
      }

      newAssets.push({
        assetId: asset.id,
        assetNo: asset.assetNo,
        modelName: asset.modelName,
        customerName,
        siteName,
        contractId,
        penaltyScore: 0,
        selectedChecklistIds: [],
        defectPhotos: {},
        memo: ''
      });
    });

    if (newAssets.length > 0) {
      setStagedAssets(prev => [...prev, ...newAssets]);
      showToast(`${newAssets.length}대 자산이 입고 대기 목록에 추가되었습니다.`);
    }
    if (newInvalids.length > 0) {
      setInvalidAssets(newInvalids);
    }
    setScanInput(''); // 입력창 초기화
  };

  const handleRemoveStaged = (assetId: string) => {
    setStagedAssets(prev => prev.filter(a => a.assetId !== assetId));
  };

  const getStagedItem = (assetId: string) => stagedAssets.find(a => a.assetId === assetId);

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


  const handleToggleChecklist = (assetId: string, itemId: string) => {
    setStagedAssets(prev => prev.map(a => {
      if (a.assetId !== assetId) return a;
      const isSelected = a.selectedChecklistIds.includes(itemId);
      const newIds = isSelected ? a.selectedChecklistIds.filter(id => id !== itemId) : [...a.selectedChecklistIds, itemId];
      
      const newPhotos = { ...a.defectPhotos };
      if (isSelected) delete newPhotos[itemId];

      const newScore = inspectionChecklistItems.filter(i => newIds.includes(i.id)).reduce((sum, item) => sum + item.score, 0);

      return {
        ...a,
        selectedChecklistIds: newIds,
        defectPhotos: newPhotos,
        penaltyScore: newScore
      };
    }));
  };

  const handlePhotoUpload = async (assetId: string, itemId: string, file: File) => {
    try {
      const base64 = await compressImageFile(file, 800, 800, 0.7);
      setStagedAssets(prev => prev.map(a => {
        if (a.assetId !== assetId) return a;
        return {
          ...a,
          defectPhotos: { ...a.defectPhotos, [itemId]: base64 }
        };
      }));
      showToast('사진이 첨부되었습니다.');
    } catch (e) {
      showToast('사진 첨부 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleMemoChange = (assetId: string, val: string) => {
    setStagedAssets(prev => prev.map(a => a.assetId === assetId ? { ...a, memo: val } : a));
  };

  const handleSubmitBulk = async () => {
    if (stagedAssets.length === 0) return;
    try {
      setIsSubmitting(true);
      setProgressState({ active: true, current: 0, total: stagedAssets.length, message: '업로드 준비 중...' });
      
      const activeTenantId = import.meta.env.VITE_TENANT_ID || 'giyuen';
      const config = googleConfigs.find(c => (c.tenantId || 'giyuen') === activeTenantId) || googleConfigs[0];
      const accountId = config?.r2AccountId || '35014a2514680107d74e1e68d96e6c32';
      const bucketName = config?.r2BucketName || 'giyeon-storage';
      const accessKeyId = config?.r2AccessKeyId || '03cdb7560d37242de608a5db2a976030';
      const secretAccessKey = config?.r2SecretAccessKey || 'b2407ab4532e02317860bc3d63226fb7bc232e88083b150c15023906ed141986';

      for (let i = 0; i < stagedAssets.length; i++) {
        const item = stagedAssets[i];
        setProgressState({ active: true, current: i, total: stagedAssets.length, message: `[${item.assetNo}] 동기화 진행 중...` });
        const uploadedPhotoUrls: Record<string, string> = {};
        
        for (const checkId of item.selectedChecklistIds) {
          const base64 = item.defectPhotos[checkId];
          if (!base64) continue;
          try {
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `inbound_${item.assetNo}_${checkId}_${dateStr}.jpg`;
            const key = `inbound/${item.assetNo}/${fileName}`;
            const res = await fetch('/api/r2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'upload', accountId, bucketName, accessKeyId, secretAccessKey, key, base64Content: base64, contentType: 'image/jpeg' })
            });
            const resJson = await res.json();
            if (resJson.url) uploadedPhotoUrls[checkId] = resJson.url;
          } catch (e) {
             console.error('Photo upload error for', checkId, e);
          }
        }

        const defectDetails: InboundDefectDetail[] = item.selectedChecklistIds.map(id => {
          const checkObj = inspectionChecklistItems.find(i => i.id === id);
          return {
            checkitemId: id,
            checkitemName: checkObj?.name || '알수없음',
            score: checkObj?.score || 0,
            photoUrl: uploadedPhotoUrls[id]
          };
        });

        const selectedChecklistSummary = defectDetails.map(d => `${d.checkitemName}(+${d.score}점)`).join(', ');
        const finalMemo = selectedChecklistSummary 
          ? `[정비 항목: ${selectedChecklistSummary}] ${item.memo}`.trim()
          : (item.memo.trim() || '양호');

        await registerInboundAsset({
          assetId: item.assetId,
          returnDate: inboundDate,
          maintenanceScore: Math.max(0, item.penaltyScore),
          defects: defectDetails,
          photos: Object.values(uploadedPhotoUrls).filter(Boolean),
          memo: finalMemo
        });
      }

      showToast(`총 ${stagedAssets.length}대의 자산이 성공적으로 입고되었습니다.`);
      setStagedAssets([]);
    } catch (err: any) {
      showErrorModal(`일괄 입고 처리 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
      setProgressState({ active: false, current: 0, total: 0, message: '' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 화면 이탈 방지용 진행바 오버레이 */}
      {progressState.active && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 99999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)'
        }}>
          <div className="card" style={{ width: '400px', padding: '30px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>일괄 처리 진행 중</h3>
            <p style={{ color: '#ef4444', fontSize: '13.5px', marginBottom: '24px', fontWeight: 500 }}>
              ⚠️ 데이터 동기화 중입니다.<br/>화면을 닫거나 다른 탭으로 이동하지 마세요.
            </p>
            
            <div style={{ width: '100%', backgroundColor: 'var(--bg-main)', height: '14px', borderRadius: '7px', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ 
                height: '100%', 
                backgroundColor: 'var(--primary)', 
                width: `${Math.max(5, (progressState.current / Math.max(1, progressState.total)) * 100)}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>{progressState.message}</span>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{progressState.current} / {progressState.total}대</span>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          backgroundColor: toastMessage.type === 'error' ? '#fee2e2' : 'var(--bg-card)',
          color: toastMessage.type === 'error' ? '#ef4444' : 'var(--text-primary)',
          padding: '6px 12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderLeft: `4px solid ${toastMessage.type === 'error' ? '#ef4444' : 'var(--primary)'}`
        }}>
          {toastMessage.text}
        </div>
      )}

      {/* 1. 바코드 입력창 및 입고일 설정 (상단) */}
      <div className="card" style={{ padding: '20px', display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            입고 장비 관리번호 연속 입력 (바코드 스캔) *
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '9px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScanInput}
              onBlur={handleBlurScan}
              placeholder="예: G19004, RENT-0001 (입력 후 Enter 또는 콤마로 다수 장비 스캔 가능)"
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: 'var(--bg-main)' }}
            />
          </div>
        </div>
        <div style={{ width: '200px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            입고일 *
          </label>
          <input
            type="date"
            value={inboundDate}
            onChange={(e) => setInboundDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '14px', backgroundColor: 'var(--bg-main)' }}
          />
        </div>
        <div>
          <button 
            type="button"
            className="btn-primary"
            onClick={handleSubmitBulk}
            disabled={stagedAssets.length === 0 || isSubmitting}
            style={{ padding: '8px 30px', fontSize: '14px', fontWeight: 'bold', height: '37.6px', whiteSpace: 'nowrap' }}
          >
            {isSubmitting ? '처리 중...' : `총 ${stagedAssets.length}대 일괄 입고 확정`}
          </button>
        </div>
      </div>

      {/* 2. 대기열 리스트 (그리드) */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>입고 대기 리스트 (총 {stagedAssets.length}대)</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>양호한 장비는 그대로 두고, 파손/수리 필요 장비만 [검수 상태] 버튼을 눌러 개별 검수하세요.</span>
        </div>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)' }}>관리번호</th>
                <th style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)' }}>모델명</th>
                <th style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)' }}>반납 현장(고객사)</th>
                <th style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)' }}>검수 상태 (클릭하여 변경)</th>
                <th style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderBottom: '2px solid var(--border-color)' }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {stagedAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    바코드를 스캔하여 입고 처리할 자산을 대기열에 추가하세요.
                  </td>
                </tr>
              ) : (
                stagedAssets.map(asset => (
                  <tr key={asset.assetId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 12px', fontWeight: 'bold' }}>{asset.assetNo}</td>
                    <td style={{ padding: '6px 12px' }}>{asset.modelName}</td>
                    <td style={{ padding: '6px 12px' }}>{asset.siteName} <span style={{ color: 'var(--text-muted)' }}>({asset.customerName})</span></td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <button 
                        type="button"
                        onClick={() => setInspectionModalAssetId(asset.assetId)}
                        style={{
                          padding: '6px 12px', borderRadius: '4px', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                          backgroundColor: asset.penaltyScore === 0 ? '#f0fdf4' : '#fef2f2',
                          borderColor: asset.penaltyScore === 0 ? '#bbf7d0' : '#fecaca',
                          color: asset.penaltyScore === 0 ? '#166534' : '#991b1b',
                          display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        {asset.penaltyScore === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        {asset.penaltyScore === 0 ? '정상 (양호)' : `수리필요 (+${asset.penaltyScore}점)`}
                      </button>
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <button type="button" onClick={() => handleRemoveStaged(asset.assetId)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
      </div>

      {/* 3. 개별 검수 모달 */}
      {inspectionModalAssetId && activeInspectionItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', padding: '0' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>개별 검수: {activeInspectionItem.assetNo} ({activeInspectionItem.modelName})</h3>
              <button onClick={() => setInspectionModalAssetId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            

            <div style={{ padding: '20px' }}>
              {/* 💡 출고 당시 장착 옵션 내역 표시 */}
              {(() => {
                const optItems = outboundOptionsData?.checkpoints?.filter((cp: any) => cp.type === 'OPTION' || cp.type === 'SPEC' || cp.id?.startsWith('opt_') || cp.label?.includes('[옵션]') || cp.label?.includes('보양')) || [];
                
                const activeContract = contracts.find(c => c.id === activeInspectionItem.contractId);
                const activeSite = sites.find(s => s.id === activeContract?.siteId);
                const activeSiteMaster = siteMasters?.find(sm => sm.id === activeSite?.siteMasterId);
                const activeDelivery = deliveries?.find(d => d.contractId === activeInspectionItem.contractId && d.type === 'OUTBOUND');

                const optMatch = activeDelivery?.closingMemo?.match(/유상옵션:\s*([^\|]+)/) || activeDelivery?.memo?.match(/\[(?:회수)?옵션\]\s*([^\|]+)/);
                const protMatch = activeDelivery?.closingMemo?.match(/보양:\s*([^\|]+)/) || activeDelivery?.memo?.match(/\[보양작업\]\s*([^\|]+)/);

                const paidOpt = activeSiteMaster?.paidOptions || (optMatch ? optMatch[1].trim() : '');
                const prot = activeSiteMaster?.protection || (protMatch ? protMatch[1].trim() : '');

                const hasPaidOpt = paidOpt && paidOpt !== '없음' && paidOpt !== 'NONE';
                const hasProt = prot && prot !== '없음' && prot !== 'NONE';

                if (optItems.length === 0 && !hasPaidOpt && !hasProt) return null;

                return (
                  <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <ShieldCheck size={16} color="#0284c7" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>회수/탈거 대상 출고 옵션 및 보양 정보</span>
                    </div>
                    {optItems.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: (hasPaidOpt || hasProt) ? '8px' : '0' }}>
                        {optItems.map((cp: any) => (
                          <div key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0f172a' }}>
                            <CheckCircle2 size={12} color="#16a34a" />
                            <span>{cp.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(hasPaidOpt || hasProt) && (
                      <div style={{ fontSize: '12px', color: '#1e3a8a', padding: '4px 8px', backgroundColor: '#e0f2fe', borderRadius: '4px' }}>
                        {hasPaidOpt && <div>• 유상옵션: <strong>{paidOpt}</strong></div>}
                        {hasProt && <div>• 보양작업: <strong>{prot}</strong></div>}
                      </div>
                    )}
                    {outboundOptionsData?.inspectionNote && (
                      <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '4px', fontSize: '12px', color: '#475569' }}>
                        <strong>출고 특이사항:</strong> {outboundOptionsData.inspectionNote}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ marginBottom: '16px' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>정비 필요 항목 체크 (자동 감점 합산)</label>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: activeInspectionItem.penaltyScore > 0 ? '#ef4444' : '#10b981' }}>
                    총 정비필요점수: {activeInspectionItem.penaltyScore}점
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {inspectionChecklistItems.map(item => {
                    const isChecked = activeInspectionItem.selectedChecklistIds.includes(item.id);
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`, borderRadius: '6px', backgroundColor: isChecked ? 'var(--bg-main)' : 'transparent', cursor: 'pointer' }} onClick={() => handleToggleChecklist(activeInspectionItem.assetId, item.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="checkbox" checked={isChecked} readOnly style={{ cursor: 'pointer' }} />
                          <span style={{ fontSize: '13px', fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--primary)' : 'inherit' }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>+{item.score}점</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeInspectionItem.selectedChecklistIds.length > 0 && (
                <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>파손 부위 사진 첨부 (선택 사항)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                    {inspectionChecklistItems.filter(i => activeInspectionItem.selectedChecklistIds.includes(i.id)).map(item => {
                      const photoUrl = activeInspectionItem.defectPhotos[item.id];
                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>{item.name} 사진</span>
                          <label style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', 
                            border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer',
                            overflow: 'hidden', position: 'relative'
                          }}>
                            {photoUrl ? (
                              <img src={photoUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                                <Camera size={20} />
                                <span style={{ fontSize: '10px', marginTop: '4px' }}>업로드</span>
                              </div>
                            )}
                            <input type="file" accept="image/*" onChange={(e) => { if(e.target.files && e.target.files[0]) handlePhotoUpload(activeInspectionItem.assetId, item.id, e.target.files[0]) }} style={{ display: 'none' }} />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>특이사항 메모</label>
                <input 
                  type="text" 
                  value={activeInspectionItem.memo}
                  onChange={(e) => handleMemoChange(activeInspectionItem.assetId, e.target.value)}
                  placeholder="추가적인 특이사항 또는 담당자 비고 입력..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                />
              </div>
            </div>
            
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setInspectionModalAssetId(null)} style={{ padding: '8px 24px', fontSize: '13px' }}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 입고 불가 자산 알림 모달 */}
      {invalidAssets.length > 0 && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', minWidth: '400px', maxWidth: '500px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} /> 입고 처리 불가 자산
            </h3>
            <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '16px', lineHeight: '1.5' }}>
              다음 자산은 대여/출고 상태가 아니므로 입고 처리가 불가합니다.<br/>전산상 출고 누락 여부를 확인하십시오.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '12px', textAlign: 'left', fontWeight: 600 }}>관리번호</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '12px', textAlign: 'left', fontWeight: 600 }}>현재 상태</th>
                </tr>
              </thead>
              <tbody>
                {invalidAssets.map(inv => (
                  <tr key={inv.assetNo}>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontSize: '12px', fontWeight: 600 }}>{inv.assetNo}</td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontSize: '12px', color: '#dc2626' }}>{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setInvalidAssets([])} style={{ padding: '6px 16px' }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

