// src/mobile/pages/MobileTestLabHome.tsx
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FlaskConical, Send, Wrench, CheckSquare, Crown, 
  ArrowRight, Check, AlertCircle, RefreshCw, Zap, 
  Layers, ShieldAlert, Sparkles, Building2, UserCheck, MessageSquare
} from 'lucide-react';
import { MobileTabType } from '../MobileBottomNav';
import { db } from '../../services/db';

interface MobileTestLabHomeProps {
  onNavigate: (tab: MobileTabType) => void;
  onOpenAsDetail: (ticketId: string) => void;
  onOpenCreateAs: (assetNo?: string, siteId?: string) => void;
}

export const MobileTestLabHome: React.FC<MobileTestLabHomeProps> = ({
  onNavigate,
  onOpenAsDetail: _onOpenAsDetail,
  onOpenCreateAs
}) => {
  const { 
    currentUser, 
    assets, 
    contracts, 
    customers, 
    fieldAsTickets, 
    outboundInspections, 
    deliveries, 
    showErrorModal, 
    changeAssetStatus,
    refreshAllData
  } = useApp();

  // A/B 비교 모드 토글: 'diff'(기존 vs 개선 나란히 비교), 'fast'(개선 패스트트랙만 집중)
  const [viewMode, setViewMode] = useState<'diff' | 'fast'>('diff');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. [가용 자산 큐레이션]
  const availableAssets = useMemo(() => {
    return (assets || []).filter(a => a.status === 'AVAILABLE' && a.ownerType !== 'RENTED').slice(0, 3);
  }, [assets]);

  // 2. [미완결 AS 티켓 큐레이션]
  const pendingAsTickets = useMemo(() => {
    return (fieldAsTickets || []).filter(t => t.status === 'REQUESTED' || t.status === 'IN_PROGRESS' || t.status === 'SCHEDULED').slice(0, 3);
  }, [fieldAsTickets]);

  // 3. [출고 검수 대기 큐레이션]
  const pendingInspections = useMemo(() => {
    return (outboundInspections || []).filter(i => i.status === 'PENDING').slice(0, 3);
  }, [outboundInspections]);

  // 4. [가장 최근 활성 계약 큐레이션]
  const latestContract = useMemo(() => {
    return (contracts || []).find(c => c.status === 'ACTIVE' || c.status === 'EXTENDED') || (contracts || [])[0];
  }, [contracts]);

  const targetCustomer = useMemo(() => {
    if (!latestContract) return (customers || [])[0];
    return (customers || []).find(c => c.id === latestContract.customerId) || (customers || [])[0];
  }, [latestContract, customers]);

  // ─────────────────────────────────────────────────────────────
  // 패스트트랙 액션 1: [원패스 프리셋 출고/대차 의뢰 발행]
  // ─────────────────────────────────────────────────────────────
  const handleFastOrder = async (isExchange: boolean) => {
    if (!targetCustomer) {
      showErrorModal('기준 고객사 데이터가 없습니다.');
      return;
    }
    const targetSpec = '19ft';
    const actionKey = isExchange ? 'order_exchange' : 'order_outbound';
    setProcessingId(actionKey);

    try {
      // 헌장 1.4, 2.1, 2.2, 2.3 준수
      // 영업사원은 자산번호를 직접 선택하지 않고, 규격 의뢰 1건만 발행함
      const newDelivery = {
        contractId: latestContract?.id || `con_${Date.now()}`,
        customerId: targetCustomer.id,
        siteId: latestContract?.siteId || undefined,
        deliveryType: isExchange ? ('EXCHANGE' as const) : ('OUTBOUND' as const),
        status: 'PENDING' as const,
        requestedDate: new Date().toISOString().split('T')[0],
        requestNote: isExchange ? '⚡ [테스트랩 원패스] 현장 긴급 대차 의뢰 (1터치 발행)' : '⚡ [테스트랩 원패스] 긴급 출고 의뢰 (1터치 발행)',
        specFt: targetSpec,
      };

      db.insertRow('deliveries', newDelivery as any);
      await db.awaitPendingWrites(); // 헌장 5.2 동기 검증
      refreshAllData();

      showToast(`[${isExchange ? '대차' : '출고'} 원패스] 의뢰가 1터치로 발행되었습니다! (배차 탭 연결)`);
    } catch (err: any) {
      showErrorModal(`발행 실패: ${err?.message || err}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 패스트트랙 액션 2: [1초 긴급 출동 완료 종결]
  // ─────────────────────────────────────────────────────────────
  const handleFastAsComplete = async (ticketId: string, symptom: string) => {
    setProcessingId(`as_${ticketId}`);
    try {
      db.updateRow<any>('repairs', ticketId, {
        status: 'COMPLETED' as const,
        actionTaken: `[테스트랩 패스트트랙 조치] ${symptom} 현장 교체 및 기능 정상 작동 확인`,
        completedAt: new Date().toISOString(),
      });
      await db.awaitPendingWrites(); // 헌장 5.2 동기 검증
      refreshAllData();

      showToast(`[AS 긴급 완료] 티켓 #${ticketId.slice(-4)} 현장 정비가 즉시 완료 종결되었습니다!`);
    } catch (err: any) {
      showErrorModal(`AS 처리 실패: ${err?.message || err}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 패스트트랙 액션 3: [출고 검수 승인 ➔ 기사 SMS 원패스]
  // ─────────────────────────────────────────────────────────────
  const handleFastInspectionApprove = async (inspection: any) => {
    setProcessingId(`insp_${inspection.id}`);
    try {
      const nowIso = new Date().toISOString();
      // 1. 검수 상태 'COMPLETED'로 승인
      db.updateRow<any>('outboundInspections', inspection.id, {
        status: 'COMPLETED',
        approvedAt: nowIso,
        note: '[테스트랩 원패스 승인] 출고 검수 통과'
      });

      // 2. 헌장 1.3 출고 검수 승인 즉시 자산 대여중 전환
      if (inspection.assetId) {
        await changeAssetStatus(inspection.assetId, 'RENTED');
      }

      await db.awaitPendingWrites(); // 헌장 5.2 동기 검증
      refreshAllData();

      // 3. 배차 운송기사 안내 메시지 클립보드 복사
      const relatedDelivery = (deliveries || []).find(d => d.id === inspection.deliveryId);
      const matchedAsset = (assets || []).find(a => a.id === inspection.assetId);
      const siteText = relatedDelivery?.destinationAddress || '경기 화성시 팔탄면 율암리 현장';
      const msg = `[e-Bro 배차안내] 출고검수완료 | 자산: ${matchedAsset?.assetNo || '호기'} | 상차장소: 기연리프트 주기장 | 하차: ${siteText} | 현장즉시운송요청`;

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(msg).catch(() => {});
      }

      showToast(`[검수승인 & 자산 RENTED 완결] 기사 문자 복사완료: "${msg.slice(0, 32)}..."`);
    } catch (err: any) {
      showErrorModal(`검수 승인 실패: ${err?.message || err}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-24 p-3 font-sans text-slate-100">
      {/* 🧪 테스트 랩 헤더 배너 */}
      <div className="bg-gradient-to-br from-pink-950/70 via-slate-900 to-indigo-950/70 border border-pink-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <FlaskConical className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-wider text-pink-400">기능 최적화 실험실</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
            ADMIN 전용
          </span>
        </div>

        <h2 className="text-xl font-black text-white leading-tight">
          최소 조작 · 최대 편익 실증 비교<br />
          <span className="text-pink-400">4대 핵심 패스트트랙</span>
        </h2>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          헌장 1.1(최대 편익) 및 1.4(1단어 1뜻) 원칙에 입각하여 개발된 고효율 원터치 액션을 기존 방식과 직접 조작하며 비교하실 수 있습니다.
        </p>

        {/* 뷰 모드 토글 바 */}
        <div className="mt-4 flex items-center gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('diff')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'diff'
                ? 'bg-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>기존 대비 개선 비교</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('fast')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              viewMode === 'fast'
                ? 'bg-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>개선 패스트트랙만 보기</span>
          </button>
        </div>
      </div>

      {/* 실시간 알림 토스트 */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 p-3 bg-pink-600/95 text-white font-black text-xs rounded-xl shadow-2xl border border-pink-400 flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 과제 1: [영업/관리] 출고 및 대차 의뢰 패스트트랙 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                ① 출고 & 대차 의뢰 원패스 (영업/관리)
              </h3>
              <p className="text-[11px] text-slate-400">현장 정보 자동 상속 & 1터치 발행 (헌장 2.2, 2.3)</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30" style={{ whiteSpace: 'nowrap' }}>
            입력 80% 단축
          </span>
        </div>

        {viewMode === 'diff' && (
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px]">
            <div className="border-r border-slate-800 pr-2">
              <span className="font-black text-red-400 block mb-1">❌ 기존 방식 (4단계)</span>
              <p className="text-slate-400 text-[10.5px] leading-tight">
                자산검색 ➔ 상세확인 ➔ 폼 이동 ➔ 고객/현장/단가/기사 수동입력
              </p>
            </div>
            <div className="pl-1">
              <span className="font-black text-emerald-400 block mb-1">✨ 개선 패스트트랙 (1단계)</span>
              <p className="text-slate-300 text-[10.5px] leading-tight">
                최근 현장 자동 상속 ➔ 원터치 단일 'EXCHANGE' or 'OUTBOUND' 즉시 의뢰
              </p>
            </div>
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">대상 고객/현장:</span>
            <span className="font-bold text-white truncate max-w-[200px]">
              {targetCustomer?.name || '기연리프트 거래처'} (최근 활성현장)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              disabled={processingId === 'order_outbound'}
              onClick={() => handleFastOrder(false)}
              className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              style={{ whiteSpace: 'nowrap' }}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{processingId === 'order_outbound' ? '발행중...' : '1터치 출고의뢰'}</span>
            </button>

            <button
              type="button"
              disabled={processingId === 'order_exchange'}
              onClick={() => handleFastOrder(true)}
              className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              style={{ whiteSpace: 'nowrap' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{processingId === 'order_exchange' ? '발행중...' : '1터치 대차의뢰'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 과제 2: [AS팀] 1초 긴급 출동 완료 종결 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                ② 1초 긴급 출동 완료 (AS/정비)
              </h3>
              <p className="text-[11px] text-slate-400">다빈도 고장 템플릿 원터치 조치 및 종결</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30" style={{ whiteSpace: 'nowrap' }}>
            현장 조작 0마찰
          </span>
        </div>

        {viewMode === 'diff' && (
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px]">
            <div className="border-r border-slate-800 pr-2">
              <span className="font-black text-red-400 block mb-1">❌ 기존 방식 (4단계)</span>
              <p className="text-slate-400 text-[10.5px] leading-tight">
                티켓상세 진입 ➔ 수리내용 수동타이핑 ➔ 부품 다중선택 ➔ 점수/완료 분리저장
              </p>
            </div>
            <div className="pl-1">
              <span className="font-black text-emerald-400 block mb-1">✨ 개선 패스트트랙 (1단계)</span>
              <p className="text-slate-300 text-[10.5px] leading-tight">
                다빈도 증상(배터리/유압/컨트롤러) 프리셋 버튼 1터치로 즉시 완료 종결
              </p>
            </div>
          </div>
        )}

        {pendingAsTickets.length > 0 ? (
          <div className="flex flex-col gap-2">
            {pendingAsTickets.map(ticket => (
              <div key={ticket.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-amber-400">#{ticket.id.slice(-4)}</span>
                    <span className="font-bold text-white truncate max-w-[140px]">{ticket.assetNo || '미배정장비'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{ticket.customerName || '현장'}</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  <button
                    type="button"
                    disabled={processingId === `as_${ticket.id}`}
                    onClick={() => handleFastAsComplete(ticket.id, '배터리 충전/단자 조치')}
                    className="py-1.5 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-[10.5px] truncate border border-slate-600"
                  >
                    🔋 배터리조치
                  </button>
                  <button
                    type="button"
                    disabled={processingId === `as_${ticket.id}`}
                    onClick={() => handleFastAsComplete(ticket.id, '유압 호스 교체/누유 정비')}
                    className="py-1.5 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-[10.5px] truncate border border-slate-600"
                  >
                    🔧 유압정비
                  </button>
                  <button
                    type="button"
                    disabled={processingId === `as_${ticket.id}`}
                    onClick={() => handleFastAsComplete(ticket.id, '조종기/상승센서 접점 세척')}
                    className="py-1.5 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-black text-[10.5px] truncate border border-emerald-500"
                  >
                    ⚡ 원터치완결
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
            현재 대기 중인 AS 티켓이 없습니다.
            <button
              type="button"
              onClick={() => onOpenCreateAs()}
              className="mt-2 text-amber-400 font-bold underline block mx-auto"
            >
              + 모바일 AS 등록하기
            </button>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 과제 3: [출고팀] 출고 검수 승인 ➔ 기사 알림 원패스 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                ③ 검수 승인 ➔ 기사 알림 원패스 (출고/주기장)
              </h3>
              <p className="text-[11px] text-slate-400">승인 즉시 자산 대여중 전환 + 기사 문자 복사 (헌장 1.3)</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" style={{ whiteSpace: 'nowrap' }}>
            핑퐁 0건
          </span>
        </div>

        {viewMode === 'diff' && (
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px]">
            <div className="border-r border-slate-800 pr-2">
              <span className="font-black text-red-400 block mb-1">❌ 기존 방식 (3단계)</span>
              <p className="text-slate-400 text-[10.5px] leading-tight">
                체크리스트 작성 ➔ 승인 ➔ 배차 탭 이동 ➔ 기사 정보 확인 ➔ 개별 전화/문자
              </p>
            </div>
            <div className="pl-1">
              <span className="font-black text-emerald-400 block mb-1">✨ 개선 패스트트랙 (1단계)</span>
              <p className="text-slate-300 text-[10.5px] leading-tight">
                원클릭 승인 즉시 자산 '대여중' 확정 + 클립보드에 기사 SMS 자동 장전
              </p>
            </div>
          </div>
        )}

        {pendingInspections.length > 0 ? (
          <div className="flex flex-col gap-2">
            {pendingInspections.map(ins => {
              const matchedAsset = (assets || []).find(a => a.id === ins.assetId);
              return (
                <div key={ins.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs">{matchedAsset?.assetNo || '검수대상장비'}</span>
                      <span className="text-[10px] font-mono text-slate-400">#{ins.id.slice(-4)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      출고검수 대기중
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={processingId === `insp_${ins.id}`}
                    onClick={() => handleFastInspectionApprove(ins)}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all flex-shrink-0"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Check className="w-4 h-4" />
                    <span>{processingId === `insp_${ins.id}` ? '승인중...' : '원패스 승인'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
            현재 대기 중인 출고 검수 건이 없습니다.
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 과제 4: [경영/관리] 이동 중 긴급 의사결정 카드 피드 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white" style={{ whiteSpace: 'nowrap' }}>
                ④ 긴급 의사결정 원터치 피드 (경영/관리)
              </h3>
              <p className="text-[11px] text-slate-400">전대 회수 독촉, 연체 고객 알림톡 1터치 발송</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30" style={{ whiteSpace: 'nowrap' }}>
            의사결정 0초
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onNavigate('delinquency')}
            className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-purple-500/50 flex flex-col items-start gap-1 text-left transition-all active:scale-95"
          >
            <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-white mt-1">연체 알림톡 발송</span>
            <span className="text-[10px] text-slate-400 leading-tight">약정일 경과 고객사 대상 1터치 통보</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('sublease')}
            className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-purple-500/50 flex flex-col items-start gap-1 text-left transition-all active:scale-95"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-xs font-black text-white mt-1">전대 누수 회수독촉</span>
            <span className="text-[10px] text-slate-400 leading-tight">주기장 유휴 임차장비 즉시 반납처리</span>
          </button>
        </div>
      </div>
    </div>
  );
};
