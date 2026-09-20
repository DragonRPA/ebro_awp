import React, { useState } from 'react';
import { Layers, Bot, ShieldCheck, AlertTriangle, CheckCircle, Wrench, RefreshCw, Clock, ArrowRight } from 'lucide-react';
import { executeAgenticPrompt } from '../services/agenticActionGateway';

interface AssetLifecycleItem {
  id: string;
  assetNo: string;
  modelName: string;
  status: 'AVAILABLE' | 'WAITING_OUTBOUND' | 'RENTED' | 'WAITING_INBOUND' | 'IN_REPAIR';
  operatingHours: number;
  maintenanceScore: number;
  customerName?: string;
  siteName?: string;
  recommendedAction?: string;
  safetyCertifiedUntil: string;
}

export const AgenticAssetLifecyclePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 시뮬레이션 자산 라이프사이클 데이터
  const [assetList, setAssetList] = useState<AssetLifecycleItem[]>([
    {
      id: 'ast-001',
      assetNo: 'AST-S45-001',
      modelName: 'S-45 (엔진직진형)',
      status: 'WAITING_OUTBOUND',
      operatingHours: 1240,
      maintenanceScore: 0,
      customerName: '현대건설(주)',
      siteName: '판교 복합센터 현장',
      recommendedAction: '출고 검수 승인 대기 ➔ 승인 즉시 RENTED 전환 (헌장 1.3)',
      safetyCertifiedUntil: '2027-03-31'
    },
    {
      id: 'ast-002',
      assetNo: 'AST-SJ3219-014',
      modelName: 'SJ3219 (시저형)',
      status: 'RENTED',
      operatingHours: 2450,
      maintenanceScore: 0,
      customerName: 'GS건설(주)',
      siteName: '송도 바이오클러스터',
      recommendedAction: '정상 가동 중 (이상 없음)',
      safetyCertifiedUntil: '2026-11-15'
    },
    {
      id: 'ast-003',
      assetNo: 'AST-Z60-003',
      modelName: 'Z-60/34 (굴절형)',
      status: 'IN_REPAIR',
      operatingHours: 3100,
      maintenanceScore: 45,
      recommendedAction: '유압 실린더 씰링 교체 진행 중 ➔ 완료 시 0점 리셋 및 AVAILABLE 복원',
      safetyCertifiedUntil: '2026-12-31'
    },
    {
      id: 'ast-004',
      assetNo: 'AST-S85-002',
      modelName: 'S-85 (대형직진형)',
      status: 'RENTED',
      operatingHours: 4200,
      maintenanceScore: 60,
      customerName: '대우건설(주)',
      siteName: '인천 청라 물류센터',
      recommendedAction: '모터 과열 센서 감지 ➔ 동일 모델 대차 교체 권고 (헌장 2.3)',
      safetyCertifiedUntil: '2026-10-31'
    }
  ]);

  // 출고 검수 승인 마감 ➔ 자산 상태 RENTED 즉시 전환 (헌장 1.3)
  const handleApproveOutbound = async (assetId: string) => {
    setLoading(true);
    setStatusMessage('에이전틱 AI가 출고 검수 승인 마감을 집행하고 헌장 1.3 RENTED 전환을 강제합니다...');

    try {
      await executeAgenticPrompt(`자산 ID ${assetId} 출고 검수 최종 승인 완료 및 RENTED 전환`);
      setAssetList(prev => prev.map(item => item.id === assetId ? {
        ...item,
        status: 'RENTED',
        recommendedAction: '대여중 정상 가동 (출고 검수 마감 완료)'
      } : item));
      setStatusMessage('승인 완료: 헌장 1.3에 따라 자산 상태가 대여중(RENTED)으로 성공적으로 전환되었습니다.');
    } catch (err: any) {
      setStatusMessage(`오류 발생: ${err?.message || '실패'}`);
    } finally {
      setLoading(false);
    }
  };

  // 정비 완료 처리 ➔ 점수 0점 리셋 및 AVAILABLE 복원
  const handleCompleteRepair = async (assetId: string) => {
    setLoading(true);
    setStatusMessage('정비 완료 보고를 수신하여 정비점수를 0점으로 리셋하고 AVAILABLE로 복원합니다...');

    try {
      await executeAgenticPrompt(`자산 ID ${assetId} 정비 완료 보고 및 AVAILABLE 복원`);
      setAssetList(prev => prev.map(item => item.id === assetId ? {
        ...item,
        status: 'AVAILABLE',
        maintenanceScore: 0,
        recommendedAction: '정비 완료 ➔ 임대 가능 상태로 복원 완료 (정비점수 0점)'
      } : item));
      setStatusMessage('정비 완료: 정비점수 0점 복원 및 임대가능(AVAILABLE) 상태 전환 완료.');
    } catch (err: any) {
      setStatusMessage(`오류 발생: ${err?.message || '실패'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', minHeight: 0 }} data-uia="agentic-asset-lifecycle-container">
      {/* 상단 헤더 바 (헌장 3.1 무수식어 건조 표준) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={20} color="var(--primary)" />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>에이전틱 자산 라이프사이클 관제</h2>
          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: '700' }} data-uia="badge-guard-rented">
            헌장 1.3 출고 검수 마감 시 RENTED 전환 강제
          </span>
        </div>
      </div>

      {statusMessage && (
        <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600', backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '8px 12px', borderRadius: '4px' }}>
          {statusMessage}
        </div>
      )}

      {/* 6대 라이프사이클 상태 요약 HUD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }} data-uia="monitor-lifecycle-flow">
        <div className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>임대가능</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#10b981', marginTop: '4px' }}>1대</div>
        </div>
        <div className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>출고대기</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b', marginTop: '4px' }}>1대</div>
        </div>
        <div className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>대여중</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--primary)', marginTop: '4px' }}>2대</div>
        </div>
        <div className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>정비중</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--danger)', marginTop: '4px' }}>1대</div>
        </div>
        <div className="card" style={{ padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>상태 보존 법칙</div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#10b981', marginTop: '6px' }}>100% 충족</div>
        </div>
      </div>

      {/* 자산 카드 리스트 (유형 A 관제 스튜디오) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>자산 라이프사이클 관제 큐 ({assetList.length}대)</div>

        {assetList.map(asset => (
          <div
            key={asset.id}
            className="card"
            style={{
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              borderLeft: asset.status === 'RENTED' ? '4px solid #3b82f6' : asset.status === 'IN_REPAIR' ? '4px solid #ef4444' : '4px solid #f59e0b'
            }}
            data-uia={`card-asset-lifecycle-${asset.id}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '800' }}>{asset.assetNo}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>| {asset.modelName}</span>
                {asset.customerName && (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary)' }}>
                    [{asset.customerName} - {asset.siteName}]
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: asset.status === 'RENTED' ? '#3b82f6' : asset.status === 'AVAILABLE' ? '#10b981' : asset.status === 'IN_REPAIR' ? '#ef4444' : '#f59e0b',
                  color: '#fff'
                }}>
                  {asset.status === 'RENTED' ? '대여중' : asset.status === 'AVAILABLE' ? '임대가능' : asset.status === 'IN_REPAIR' ? '정비중' : '출고대기'}
                </span>

                {asset.status === 'WAITING_OUTBOUND' && (
                  <button
                    className="btn-primary"
                    onClick={() => handleApproveOutbound(asset.id)}
                    disabled={loading}
                    style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '700' }}
                    data-uia="btn-execute-lifecycle-action"
                  >
                    출고 검수 승인 마감 (대여중 전환)
                  </button>
                )}

                {asset.status === 'IN_REPAIR' && (
                  <button
                    className="btn-primary"
                    onClick={() => handleCompleteRepair(asset.id)}
                    disabled={loading}
                    style={{ padding: '4px 10px', fontSize: '12px', fontWeight: '700', backgroundColor: 'var(--success)' }}
                  >
                    정비 완료 보고 (점수 리셋)
                  </button>
                )}
              </div>
            </div>

            {/* 세부 상태 및 센서 수치 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', backgroundColor: 'var(--bg-app)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>누적 가동시간: </span>
                <strong>{asset.operatingHours}시간</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>정비점수: </span>
                <strong style={{ color: asset.maintenanceScore > 40 ? '#ef4444' : 'var(--text-primary)' }}>{asset.maintenanceScore}점</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>안전검사 유효기간: </span>
                <strong>{asset.safetyCertifiedUntil}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--text-secondary)' }}>관제 권고: </span>
                <strong style={{ color: asset.maintenanceScore > 50 ? '#ef4444' : 'var(--primary)' }}>
                  {asset.maintenanceScore > 50 ? '대차 교체 요망' : '정상 운용'}
                </strong>
              </div>
            </div>

            {/* 권고 조치 */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#10b981" />
              <span>{asset.recommendedAction}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
