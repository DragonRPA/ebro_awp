import React, { useEffect, useState, useRef } from 'react';
import { Camera, CheckCircle, Truck, UploadCloud, Edit3 } from 'lucide-react';
import { supabase, Delivery } from '../services/db';
import { generateSignedReceiptBlob, SignedReceiptCargoItem } from '../utils/receiptGenerator';

interface SignaturePadHandle {
  getCanvas: () => HTMLCanvasElement | null;
  hasDrawn: () => boolean;
  clear: () => void;
}

const SignaturePad: React.FC<{ 
  receiverName?: string; 
  onReady: (handle: SignaturePadHandle) => void 
}> = ({ receiverName, onReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const hasDrawnRef = useRef<boolean>(false);

  const drawWatermark = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    
    if (receiverName && receiverName.trim().length > 0) {
      const chars = receiverName.trim().split('');
      const charCount = chars.length;
      
      ctx.save();
      const sectionWidth = canvas.width / charCount;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
      ctx.font = '900 110px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (let i = 0; i < charCount; i++) {
        const centerX = (i * sectionWidth) + (sectionWidth / 2);
        ctx.fillText(chars[i], centerX, canvas.height / 2);
        
        if (i > 0) {
          ctx.beginPath();
          ctx.setLineDash([8, 8]);
          ctx.moveTo(i * sectionWidth, 35);
          ctx.lineTo(i * sectionWidth, canvas.height - 35);
          ctx.strokeStyle = 'rgba(0,0,0,0.08)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.beginPath();
  };

  useEffect(() => {
    onReady({
      getCanvas: () => canvasRef.current,
      hasDrawn: () => hasDrawnRef.current,
      clear: () => drawWatermark()
    });
  }, [onReady]);

  useEffect(() => {
    drawWatermark();
  }, [receiverName]);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    setIsDrawing(true);
    hasDrawnRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  return (
    <div style={{ position: 'relative', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>아래 영역에 직접 서명해 주세요</span>
        <button 
          onClick={drawWatermark} 
          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
        >
          지우기 / 다시 쓰기
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        style={{ width: '100%', height: '210px', border: '2px dashed #94a3b8', borderRadius: '8px', backgroundColor: '#ffffff', touchAction: 'none' }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchMove={draw}
      />
    </div>
  );
};

export const DriverPortalPage: React.FC = () => {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contract & Party Details
  const [contractNo, setContractNo] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('(주)기연리프트');
  const [supplierInfo, setSupplierInfo] = useState<any>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [siteName, setSiteName] = useState<string>('');
  const [siteAddress, setSiteAddress] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  const [cargoList, setCargoList] = useState<SignedReceiptCargoItem[]>([]);
  const [specialNotes, setSpecialNotes] = useState<string>('');

  const [mode, setMode] = useState<'SELECT' | 'PHOTO' | 'SIGN'>('SELECT');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigPadHandleRef = useRef<SignaturePadHandle | null>(null);

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const dlvId = pathParts[pathParts.length - 1];

    if (!dlvId) {
      setError('유효하지 않은 링크입니다.');
      setLoading(false);
      return;
    }

    const fetchDelivery = async () => {
      try {
        const { data, error } = await supabase!.from('deliveries').select('*').eq('id', dlvId).single();
        if (error || !data) throw new Error('배차 정보를 찾을 수 없습니다.');
        setDelivery(data);
        if (data.status === 'COMPLETED' || data.status === 'DELIVERED') setCompleted(true);
        
        // Parse cargo items
        let items: SignedReceiptCargoItem[] = [];
        if (data.cargoItems) {
          try {
            const parsed = JSON.parse(data.cargoItems);
            if (Array.isArray(parsed)) {
              items = parsed.map((p: any) => ({
                modelName: p.modelName || '고소작업대',
                count: p.count || 1,
                note: p.note || '정상 납품'
              }));
            }
          } catch (e) {
            items = [{ modelName: data.cargoItems, count: 1, note: '정상 납품' }];
          }
        }
        setCargoList(items);

        // Parse special notes & receiver from delivery.memo if present
        if (data.memo) {
          const optMatch = data.memo.match(/\[옵션\]\s*([^|]+)/);
          if (optMatch) setSpecialNotes(optMatch[1].trim());

          const contactMatch = data.memo.match(/현장담당:\s*([^\s(]+)(?:\s*\(([^)]+)\))?/);
          if (contactMatch) {
            if (contactMatch[1]) setReceiverName(contactMatch[1].trim());
            if (contactMatch[2]) setReceiverPhone(contactMatch[2].trim());
          }
        }

        // Query contract and related entities
        if (data.contractId) {
          const { data: contract } = await supabase!
            .from('contracts')
            .select('id, contractNo, siteId, customerId, tenant_id')
            .eq('id', data.contractId)
            .single();

          if (contract) {
            if (contract.contractNo) setContractNo(contract.contractNo);
            else setContractNo(contract.id);

            // 1. Customer
            if (contract.customerId) {
              const { data: customer } = await supabase!
                .from('customers')
                .select('name, representative, repContact')
                .eq('id', contract.customerId)
                .single();
              if (customer) {
                setCustomerName(customer.name || '');
                if (!receiverName && customer.representative) {
                  setReceiverName(customer.representative);
                }
                if (!receiverPhone && customer.repContact) {
                  setReceiverPhone(customer.repContact);
                }
              }
            }

            // 2. Site (Check customer_sites first per system standard, fallback to site_masters)
            if (contract.siteId) {
              const { data: customerSite } = await supabase!
                .from('customer_sites')
                .select('name, contactName, contact, address')
                .eq('id', contract.siteId)
                .single();

              if (customerSite) {
                setSiteName(customerSite.name || '');
                setSiteAddress(customerSite.address || '');
                if (customerSite.contactName) setReceiverName(customerSite.contactName);
                if (customerSite.contact) setReceiverPhone(customerSite.contact);
              } else {
                const { data: siteMaster } = await supabase!
                  .from('site_masters')
                  .select('name, contactName, contactPhone, address')
                  .eq('id', contract.siteId)
                  .single();
                if (siteMaster) {
                  setSiteName(siteMaster.name || '');
                  setSiteAddress(siteMaster.address || '');
                  if (siteMaster.contactName) setReceiverName(siteMaster.contactName);
                  if (siteMaster.contactPhone) setReceiverPhone(siteMaster.contactPhone);
                }
              }
            }
          }
        }

        // 3. Supplier (Tenants)
        const { data: tenantData } = await supabase!.from('tenants').select('*').limit(1).single();
        if (tenantData) {
          setSupplierName(tenantData.tradeName || tenantData.displayName || '(주)기연리프트');
          setSupplierInfo(tenantData);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();
  }, []);

  const uploadBlobAndComplete = async (blob: Blob, prefix: string) => {
    if (!delivery) return;
    setUploading(true);
    try {
      const ext = prefix === 'photo' ? 'jpg' : 'png';
      const fileName = `${delivery.id}_${prefix}_${Date.now()}.${ext}`;
      const tId = (delivery as any).tenantId || (delivery as any).tenant_id || 'shared';
      const filePath = `receipts/${tId}/${fileName}`;

      const { error: uploadError } = await supabase!.storage
        .from('evidence')
        .upload(filePath, blob, { contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase!.storage
        .from('evidence')
        .getPublicUrl(filePath);

      const label = prefix === 'photo' ? '납품증 사진' : '전자 서명';
      const currentMemo = delivery.closingMemo || '';
      const newMemo = currentMemo.includes(`[${label}]`)
        ? currentMemo.replace(new RegExp(`\\[${label}\\]:\\s*https?:\\/\\/[^\\s\\n\\r]+`), `[${label}]: ${publicUrlData.publicUrl}`)
        : currentMemo ? `${currentMemo}\n[${label}]: ${publicUrlData.publicUrl}` : `[${label}]: ${publicUrlData.publicUrl}`;
      
      const { error: updateError } = await supabase!
        .from('deliveries')
        .update({
          status: 'DELIVERED',
          closingMemo: newMemo,
          updatedAt: new Date().toISOString()
        })
        .eq('id', delivery.id);

      if (updateError) throw updateError;
      
      setCompleted(true);
      alert('납품(인수)확인서가 성공적으로 등록되었으며 운송 완료 처리되었습니다.');
    } catch (err: any) {
      alert('업로드 실패: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadBlobAndComplete(file, 'photo');
  };

  const handleSubmitSignature = async () => {
    if (!delivery || !sigPadHandleRef.current) return;
    if (!sigPadHandleRef.current.hasDrawn()) {
      alert('인수자 서명을 입력해 주세요.');
      return;
    }
    const canvas = sigPadHandleRef.current.getCanvas();
    if (!canvas) {
      alert('서명 데이터를 가져올 수 없습니다.');
      return;
    }

    setUploading(true);
    try {
      const docBlob = await generateSignedReceiptBlob({
        delivery,
        contractNo: contractNo || delivery.contractId || '-',
        customerName: customerName || '미확인',
        siteName: siteName || '미확인',
        siteAddress: delivery.destinationAddress || siteAddress || '-',
        receiverName: receiverName || '인수담당자',
        receiverPhone: receiverPhone || '-',
        supplierName: supplierName || '(주)기연리프트',
        supplierInfo,
        cargoList,
        specialNotes,
        signatureCanvas: canvas,
        signDate: new Date().toISOString().split('T')[0]
      });

      await uploadBlobAndComplete(docBlob, 'sign');
    } catch (err: any) {
      alert('납품확인서 생성 실패: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Pretendard' }}>로딩 중...</div>;
  if (error) return <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontFamily: 'Pretendard' }}>{error}</div>;
  if (!delivery) return null;

  const dCategory = delivery.type === 'INBOUND' ? '회수' : delivery.type === 'EXCHANGE' ? '교환' : '출고';

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Pretendard, sans-serif' }}>
      <header style={{ backgroundColor: '#1e1b4b', color: 'white', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Truck size={20} />
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>운송 포털</h1>
      </header>

      <main style={{ padding: '20px' }}>
        {/* Delivery Info Card (Image 1 Requirement) */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
            {dCategory} 정보
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '90px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>계약번호</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>{contractNo || delivery.contractId || '-'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '90px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>공급자</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>{supplierName}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '90px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>고객 / 현장</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>
                {customerName ? `${customerName} / ` : ''}{siteName || '확인요망'}
              </span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '90px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>하차지 주소</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#2563eb' }}>{delivery.destinationAddress || siteAddress || '확인요망'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '90px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>인수자</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>{receiverName || '현장담당자'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '90px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>인수자 연락처</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>{receiverPhone || '-'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '90px', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>납품일</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#0f172a' }}>{delivery.unloadingDate || delivery.requestDate || '-'}</span>
            </div>

            {/* Equipment List Table (All columns centered per user instruction) */}
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>납품장비 목록</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', fontSize: '13px', color: '#475569' }}>
                    <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700 }}>품목 (모델명)</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, width: '64px' }}>수량</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700 }}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {cargoList.length > 0 ? (
                    cargoList.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                        <td style={{ padding: '9px 6px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>{item.modelName || '고소작업대'}</td>
                        <td style={{ padding: '9px 6px', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>{item.count || 1}대</td>
                        <td style={{ padding: '9px 6px', textAlign: 'center', color: '#64748b' }}>{item.note || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <td style={{ padding: '9px 6px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>{delivery.cargoItems || '장비 미지정'}</td>
                      <td style={{ padding: '9px 6px', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>1대</td>
                      <td style={{ padding: '9px 6px', textAlign: 'center', color: '#64748b' }}>-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {completed ? (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '24px 20px', textAlign: 'center' }}>
            <CheckCircle size={48} color="#16a34a" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '18px' }}>운송 완료</h3>
            <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>인수증(납품확인서)이 정상 등록되었으며, 당사 ERP에 완료 보고가 접수되었습니다. 수고하셨습니다!</p>
          </div>
        ) : (
          <div>
            {mode === 'SELECT' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#334155', fontWeight: 600, textAlign: 'center' }}>
                  완료 처리 방법을 선택해 주세요.
                </p>
                <button 
                  onClick={() => setMode('PHOTO')}
                  style={{ padding: '16px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: '#0f172a', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                >
                  <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '50%', color: '#2563eb' }}><Camera size={20} /></div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '15px' }}>종이 납품증 사진 찍기</div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>종이 송장을 이미 작성하신 경우</div>
                  </div>
                </button>
                <button 
                  onClick={() => setMode('SIGN')}
                  style={{ padding: '16px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: '#0f172a', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                >
                  <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '50%', color: '#16a34a' }}><Edit3 size={20} /></div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '15px' }}>모바일 전자 서명 받기</div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>종이 송장이 없거나 분실하신 경우</div>
                  </div>
                </button>
              </div>
            )}

            {mode === 'PHOTO' && (
              <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ width: '100%', padding: '16px', backgroundColor: uploading ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 800, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {uploading ? <><UploadCloud size={20} /> 업로드 중...</> : <><Camera size={20} /> 카메라 켜기</>}
                </button>
                <button onClick={() => setMode('SELECT')} style={{ marginTop: '16px', background: 'none', border: 'none', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>이전으로 돌아가기</button>
              </div>
            )}

            {mode === 'SIGN' && (
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ textAlign: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '2px solid #1e293b' }}>
                  <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 900, letterSpacing: '1px' }}>납품(인수)확인서 서명</h3>
                </div>
                
                <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#334155', marginBottom: '14px' }}>
                  위 장비를 이상 없이 정히 인수(반납) 하였음을 확인합니다.<br/>
                  <strong>일자:</strong> {new Date().toLocaleDateString('ko-KR')}
                </div>

                {/* Receiver Info Confirmation & Input */}
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={{ width: '90px', fontSize: '13px', fontWeight: 700, color: '#475569' }}>인수자 성명</label>
                    <input 
                      type="text" 
                      value={receiverName} 
                      onChange={(e) => setReceiverName(e.target.value)} 
                      placeholder="인수자 성명"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label style={{ width: '90px', fontSize: '13px', fontWeight: 700, color: '#475569' }}>인수자 연락처</label>
                    <input 
                      type="text" 
                      value={receiverPhone} 
                      onChange={(e) => setReceiverPhone(e.target.value)} 
                      placeholder="010-0000-0000"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <SignaturePad 
                  receiverName={receiverName} 
                  onReady={(handle) => { sigPadHandleRef.current = handle; }} 
                />

                <button 
                  onClick={handleSubmitSignature}
                  disabled={uploading}
                  style={{ width: '100%', padding: '16px', backgroundColor: uploading ? '#94a3b8' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 800, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px' }}
                >
                  {uploading ? <><UploadCloud size={20} /> 확인서 생성 및 업로드 중...</> : <><CheckCircle size={20} /> 서명 완료 및 전송</>}
                </button>
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => setMode('SELECT')} style={{ marginTop: '16px', background: 'none', border: 'none', color: '#64748b', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>취소하고 이전으로 돌아가기</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
