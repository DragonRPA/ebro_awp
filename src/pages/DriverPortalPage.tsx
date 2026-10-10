import React, { useEffect, useState, useRef } from 'react';
import { Camera, CheckCircle, Truck, UploadCloud } from 'lucide-react';
import { supabase, db, Delivery } from '../services/db';

export const DriverPortalPage: React.FC = () => {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCaptureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !delivery) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${delivery.id}_receipt_${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase!.storage
        .from('evidence-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase!.storage
        .from('evidence-files')
        .getPublicUrl(filePath);

      // Update Delivery
      const newMemo = delivery.closingMemo ? `${delivery.closingMemo}\n[납품증 사진]: ${publicUrlData.publicUrl}` : `[납품증 사진]: ${publicUrlData.publicUrl}`;
      
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
      alert('납품증이 성공적으로 등록되었으며 운송 완료 처리되었습니다.');
    } catch (err: any) {
      alert('업로드 실패: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
            <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>납품증 사진이 등록되었으며, 당사 ERP에 운송 완료가 자동 보고되었습니다. 수고하셨습니다!</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            <button 
              onClick={handleCaptureClick}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: uploading ? '#94a3b8' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 800,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)'
              }}
            >
              {uploading ? (
                <><UploadCloud size={20} /> 업로드 중...</>
              ) : (
                <><Camera size={20} /> 납품증 사진 찍고 완료하기</>
              )}
            </button>
            <p style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
              버튼을 누르면 카메라가 켜집니다. 납품증을 선명하게 찍어주세요.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
