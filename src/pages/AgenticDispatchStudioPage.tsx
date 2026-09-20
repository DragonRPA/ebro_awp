import React, { useState } from 'react';
import { Truck, Bot, CheckCircle2, AlertTriangle, ShieldCheck, MapPin, ArrowRight, Play, RefreshCw, Send, Check } from 'lucide-react';
import { executeAgenticPrompt } from '../services/agenticActionGateway';

interface MockDispatchItem {
  id: string;
  type: 'OUTBOUND' | 'INBOUND' | 'EXCHANGE';
  customerName: string;
  siteName: string;
  modelName: string;
  origin: string;
  destination: string;
  expectedCost: number;
  discountAmount: number;
  finalCost: number;
  driverName?: string;
  driverPhone?: string;
  status: 'PENDING' | 'AI_ASSIGNED' | 'CONFIRMED';
  constitutionalCompliance: boolean;
}

export const AgenticDispatchStudioPage: React.FC = () => {
  const [prompt, setPrompt] = useState('판교 삼환하이펙스 현장 S-45 장비 유압 누유 고장으로 동일 모델 대차 교체 배차 의뢰 발행해줘');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 시뮬레이션 배차 큐
  const [dispatchQueue, setDispatchQueue] = useState<MockDispatchItem[]>([
    {
      id: 'DEL-202609-001',
      type: 'EXCHANGE',
      customerName: '현대건설(주)',
      siteName: '성남 판교 복합센터 신축',
      modelName: 'S-45 (고소작업대)',
      origin: '충북 청주시 흥덕구 직지대로 436 (기연 본사)',
      destination: '경기 성남시 분당구 판교역로 166',
      expectedCost: 200000,
      discountAmount: 60000, // 헌장 2.3 왕복할인
      finalCost: 140000,
      driverName: '김철수 기사 (5톤 리프트카)',
      driverPhone: '010-8888-1234',
      status: 'AI_ASSIGNED',
      constitutionalCompliance: true
    },
    {
      id: 'DEL-202609-002',
      type: 'OUTBOUND',
      customerName: 'GS건설(주)',
      siteName: '인천 송도 바이오클러스터',
      modelName: 'SJ3219',
      origin: '충북 청주시 흥덕구 직지대로 436 (기연 본사)',
      destination: '인천 연수구 송도동 24-1',
      expectedCost: 120000,
      discountAmount: 0,
      finalCost: 120000,
      driverName: '박기사 (2.5톤 카고)',
      driverPhone: '010-7777-5678',
      status: 'CONFIRMED',
      constitutionalCompliance: true
    }
  ]);

  // AI 프롬프트 실행
  const handleRunAiDispatch = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setStatusMessage('에이전틱 AI가 배차 의뢰를 분석하고 헌장 2.3 가드레일을 검증 중입니다...');

    try {
      const res = await executeAgenticPrompt(prompt);
      
      // 새 배차 항목 시뮬레이션 등록
      const isExchange = prompt.includes('대차') || prompt.includes('교체') || prompt.includes('교환');
      const normalCost = 200000;
      const discount = isExchange ? 60000 : 0;
      const finalCost = normalCost - discount;

      const newItem: MockDispatchItem = {
        id: `DEL-${Date.now().toString().slice(-6)}`,
        type: isExchange ? 'EXCHANGE' : 'OUTBOUND',
        customerName: '대우건설(주)',
        siteName: '판교 테크노밸리 현장',
        modelName: 'S-45',
        origin: '충북 청주시 직지대로 436',
        destination: '경기 성남시 분당구 판교역로 166',
        expectedCost: normalCost,
        discountAmount: discount,
        finalCost: finalCost,
        driverName: '이운송 기사 (5톤)',
        driverPhone: '010-9999-4321',
        status: 'AI_ASSIGNED',
        constitutionalCompliance: true
      };

      setDispatchQueue(prev => [newItem, ...prev]);
      setStatusMessage(`배차 완료: ${res.finalAnswer}`);
    } catch (err: any) {
      setStatusMessage(`오류 발생: ${err?.message || '처리 실패'}`);
    } finally {
      setLoading(false);
    }
  };

  // 단일 배차 즉시 확정
  const handleConfirmDispatch = (id: string) => {
    setDispatchQueue(prev => prev.map(item => item.id === id ? { ...item, status: 'CONFIRMED' } : item));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', minHeight: 0 }} data-uia="agentic-dispatch-studio-container">
      {/* 상단 타이틀 바 (헌장 3.1 무수식어 건조 명사 표준) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck size={20} color="var(--primary)" />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>에이전틱 배차 관제 스튜디오</h2>
          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: '700' }}>
            헌장 2.3 단일 EXCHANGE 및 왕복할인 자동 적용
          </span>
        </div>
      </div>

      {/* 편의성 비교 HUD (인간 vs AI) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }} data-uia="hud-dispatch-metrics">
        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>배차 수립 소요시간</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#10b981' }}>1.8초</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>인간 25분</span>
          </div>
          <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '700', marginTop: '2px' }}>99.2% 시간 단축</div>
        </div>

        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>필요 조작 클릭 수</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#8b5cf6' }}>1회</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>인간 28회</span>
          </div>
          <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: '700', marginTop: '2px' }}>96.4% 조작 절감</div>
        </div>

        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>헌장 2.3 EXCHANGE 단일화</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#f59e0b', marginTop: '4px' }}>100% 준수</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>왕복할인 ₩60,000 자동 차감</div>
        </div>

        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>헌장 1.3 자산상태 비조작</div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', marginTop: '4px' }}>보존 완료</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>출고 승인 시 RENTED 전환 보장</div>
        </div>
      </div>

      {/* 자연어 AI 배차 명령 콘솔 (헌장 3.4 상하 세로 스택) */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>자연어 배차 지시</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="input-field"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRunAiDispatch(); }}
            placeholder="자연어로 배차 의뢰를 입력하십시오 (예: 판교 현장 S-45 고장 대차 교체 의뢰)"
            style={{ flex: 1, padding: '10px 12px', fontSize: '13px' }}
            data-uia="agentic-dispatch-prompt"
          />
          <button
            className="btn-primary"
            onClick={handleRunAiDispatch}
            disabled={loading}
            style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}
          >
            {loading ? <RefreshCw size={15} className="spin" /> : <Send size={15} />}
            <span>배차 수립 실행</span>
          </button>
        </div>
        {statusMessage && (
          <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600', backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '6px 12px', borderRadius: '4px' }}>
            {statusMessage}
          </div>
        )}
      </div>

      {/* 관제 배차 큐 카드 덱 (유형 A 마스터 스튜디오) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflowY: 'auto' }} data-uia="deck-dispatch-requests">
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>배차 관제 큐 ({dispatchQueue.length}건)</div>

        {dispatchQueue.map(item => (
          <div
            key={item.id}
            className="card"
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              borderLeft: item.type === 'EXCHANGE' ? '4px solid #8b5cf6' : '4px solid #3b82f6'
            }}
            data-uia={`card-dispatch-item-${item.id}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: item.type === 'EXCHANGE' ? '#8b5cf6' : '#3b82f6',
                  color: '#fff'
                }}>
                  {item.type === 'EXCHANGE' ? '교환' : item.type === 'OUTBOUND' ? '출고' : '회수'}
                </span>
                <span style={{ fontSize: '14px', fontWeight: '800' }}>{item.customerName}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>| {item.siteName}</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>[{item.modelName}]</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: item.status === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: item.status === 'CONFIRMED' ? '#10b981' : '#f59e0b'
                }}>
                  {item.status === 'CONFIRMED' ? '배차 확정' : 'AI 기사 자동 배정'}
                </span>
                {item.status !== 'CONFIRMED' && (
                  <button
                    className="btn-secondary"
                    onClick={() => handleConfirmDispatch(item.id)}
                    style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Check size={13} />
                    <span>최종 승인</span>
                  </button>
                )}
              </div>
            </div>

            {/* 경로 및 배정 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>운송 경로</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.origin}</span>
                  <ArrowRight size={13} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.destination}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>배정 운송기사</span>
                <span style={{ fontWeight: '700' }}>{item.driverName} ({item.driverPhone})</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                <span style={{ color: 'var(--text-secondary)' }}>운송비 정산</span>
                <div style={{ fontWeight: '800', color: 'var(--text-primary)' }}>
                  {item.discountAmount > 0 && (
                    <span style={{ fontSize: '11px', color: '#10b981', marginRight: '6px' }} data-uia="badge-exchange-discount">
                      (왕복할인 -₩{item.discountAmount.toLocaleString()})
                    </span>
                  )}
                  <span>₩{item.finalCost.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 헌장 검증 풋노트 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                <ShieldCheck size={13} />
                헌장 2.3 단일 EXCHANGE 배차 1건 발행 및 왕복할인 정산 완료
              </span>
              <span>배차 ID: {item.id}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
