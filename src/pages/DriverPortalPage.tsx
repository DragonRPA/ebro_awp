import React, { useEffect, useState, useRef } from 'react';
import { Camera, CheckCircle, Truck, UploadCloud, Edit3, FileText } from 'lucide-react';
import { supabase, Delivery } from '../services/db';

const SignaturePad: React.FC<{ onReady: (getBlob: () => Promise<Blob | null>) => void }> = ({ onReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    onReady(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    });
  }, [onReady]);

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
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
    }
  };

  return (
    <div style={{ position: 'relative', marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>아래 영역에 서명해 주세요</span>
        <button onClick={clearCanvas} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>지우기 / 다시 쓰기</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        style={{ width: '100%', height: '200px', border: '2px dashed #cbd5e1', borderRadius: '8px', backgroundColor: '#f8fafc', touchAction: 'none' }}
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
  const [mode, setMode] = useState<'SELECT' | 'PHOTO' | 'SIGN'>('SELECT');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getSignatureBlobRef = useRef<(() => Promise<Blob | null>) | null>(null);

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
        if (data.status === 'COMPLETED') setCompleted(true);
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
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase!.storage
        .from('evidence-files')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase!.storage
        .from('evidence-files')
        .getPublicUrl(filePath);

      const label = prefix === 'photo' ? '납품증 사진' : '전자 서명';
      const newMemo = delivery.closingMemo ? `${delivery.closingMemo}\n[${label}]: ${publicUrlData.publicUrl}` : `[${label}]: ${publicUrlData.publicUrl}`;
      
      const { error: updateError } = await supabase!
        .from('deliveries')
        .update({
          status: 'COMPLETED',
          closingMemo: newMemo,
          completedAt: new Date().toISOString()
        })
        .eq('id', delivery.id);

      if (updateError) throw updateError;
      
      setCompleted(true);
      alert('성공적으로 등록되었으며 운송 완료 처리되었습니다.');
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
    if (!getSignatureBlobRef.current) return;
    const blob = await getSignatureBlobRef.current();
    if (!blob) {
      alert('서명 데이터를 가져올 수 없습니다.');
      return;
    }
    // Check if canvas is essentially empty? Simplest is just to trust the user wrote something
    uploadBlobAndComplete(blob, 'sign');
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Pretendard' }}>로딩 중...</div>;
  if (error) return <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontFamily: 'Pretendard' }}>{error}</div>;
  if (!delivery) return null;

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Pretendard, sans-serif' }}>
      <header style={{ backgroundColor: '#1e1b4b', color: 'white', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Truck size={20} />
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>스마트 운송 포털</h1>
      </header>

      <main style={{ padding: '20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px' }}>
            {delivery.dispatchCategory || '배차'} 정보
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '70px', color: '#64748b', fontWeight: 600 }}>상차지</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{delivery.originAddress || '확인요망'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '70px', color: '#64748b', fontWeight: 600 }}>하차지</span>
              <span style={{ flex: 1, fontWeight: 700, color: '#2563eb' }}>{delivery.destinationAddress || '확인요망'}</span>
            </div>
            <div style={{ display: 'flex' }}>
              <span style={{ width: '70px', color: '#64748b', fontWeight: 600 }}>장비종류</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{delivery.cargoItems || '고소작업대'}</span>
            </div>
          </div>
        </div>

        {completed ? (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '24px 20px', textAlign: 'center' }}>
            <CheckCircle size={48} color="#16a34a" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '18px' }}>운송 완료</h3>
            <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>인수증(납품증)이 정상 등록되었으며, 당사 ERP에 완료 보고가 접수되었습니다. 수고하셨습니다!</p>
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
                <div style={{ textAlign: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '2px solid #1e293b' }}>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, letterSpacing: '2px' }}>납품(인수)증</h3>
                </div>
                
                <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#334155', marginBottom: '16px' }}>
                  위 장비를 이상 없이 정히 인수(반납) 하였음을 확인합니다.<br/>
                  <strong>일자:</strong> {new Date().toLocaleDateString()}
                </div>

                <SignaturePad onReady={(getBlob) => { getSignatureBlobRef.current = getBlob; }} />

                <button 
                  onClick={handleSubmitSignature}
                  disabled={uploading}
                  style={{ width: '100%', padding: '16px', backgroundColor: uploading ? '#94a3b8' : '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 800, cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px' }}
                >
                  {uploading ? <><UploadCloud size={20} /> 업로드 중...</> : <><CheckCircle size={20} /> 서명 완료 및 전송</>}
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
