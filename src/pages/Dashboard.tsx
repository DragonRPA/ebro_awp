import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Activity, Layers, CheckCircle, Bell, ArrowRight, FileText, CheckSquare, RefreshCw, ClipboardList, Package } from 'lucide-react';
import { isAgentOnlineGlobal, subscribeAgentStatus } from '../services/agentService';
import { findActiveTasksForUser, reconcileCompletedTodosInDb } from '../utils/taskHandoverPipeline';
import { normalizeMenuId } from '../config/menu_config';
import { ExecutiveDirectiveModal } from '../components/ExecutiveDirectiveModal';
import { ContractDocumentBundleModal } from '../components/ContractDocumentBundleModal';
import { Todo, isVirtualAsset } from '../services/db';

export const Dashboard: React.FC = () => {
  const { 
    currentUser, 
    hasPermission, 
    todos, 
    assets,
    contractAssets,
    outboundInspections,
    completeTodo, 
    resolveExecutiveDirective,
    setActiveTab,
    refreshAllData
  } = useApp();

  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [reportingDirectiveTodo, setReportingDirectiveTodo] = useState<Todo | null>(null);
  const [directiveReportNote, setDirectiveReportNote] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleTargetContractId, setBundleTargetContractId] = useState<string | undefined>(undefined);

  const [, setAgentStatus] = useState<'ONLINE' | 'OFFLINE'>(() => isAgentOnlineGlobal() ? 'ONLINE' : 'OFFLINE');
  const [, setAgentCallsign] = useState<string>('');
  const [, setAgentVersion] = useState<string>('');

  // 에이전트 전역 상태 구독 (단일 전역 모니터와 완벽 동기화)
  useEffect(() => {
    return subscribeAgentStatus((online, info) => {
      if (online) {
        setAgentStatus('ONLINE');
        if (info?.version) setAgentVersion(info.version);
        if (info?.callsign) setAgentCallsign(info.callsign);
      } else {
        setAgentStatus('OFFLINE');
        setAgentCallsign('');
        setAgentVersion('');
      }
    });
  }, []);

  const activeTasks = useMemo(() => findActiveTasksForUser(todos, currentUser, hasPermission), [todos, currentUser, hasPermission]);

  // 영업부 / 경영진 / 출고·관리부 공통 가용재고 및 미완결 출고예정 실시간 요약
  const inventorySummary = useMemo(() => {
    let stockOwned = 0;
    let stockRented = 0;
    const assetMap = new Map((assets || []).map(a => [a.id, a]));

    (assets || []).forEach(a => {
      if (isVirtualAsset(a)) return;
      if (a.actualRentReturnDate) return;
      if (a.status !== 'AVAILABLE') return;
      if (a.ownerType === 'RENTED') {
        stockRented += 1;
      } else {
        stockOwned += 1;
      }
    });

    const completedInspCaIds = new Set<string>();
    (outboundInspections || []).forEach(ins => {
      if (ins.status === 'COMPLETED' && (ins as any).contractAssetId) {
        completedInspCaIds.add((ins as any).contractAssetId);
      }
    });

    let pendingUnassignedCount = 0;
    (contractAssets || []).forEach(ca => {
      if (!ca.contractId) return;
      if (ca.status === 'RETURNED' || ca.status === 'SOLD' || ca.status === 'RENTED') return;
      if (completedInspCaIds.has(ca.id)) return;
      if (ca.assetId) {
        const assigned = assetMap.get(ca.assetId);
        if (assigned?.status === 'RENTED') return;
        return;
      }
      pendingUnassignedCount += 1;
    });

    const totalStock = stockOwned + stockRented;
    const availableContractQty = totalStock - pendingUnassignedCount;

    return {
      stockOwned,
      stockRented,
      totalStock,
      pendingUnassignedCount,
      availableContractQty
    };
  }, [assets, contractAssets, outboundInspections]);

  const resolveTaskTargetMenu = (actionUrl?: string, task?: Todo): string => {
    const raw = (actionUrl || '').trim();
    const tabMap: Record<string, string> = {
      '/admin/dispatch': 'delivery',
      '/admin/delivery': 'delivery',
      '/admin/deliveries': 'delivery',
      '/admin/smart_dispatch': 'smart_dispatch4',
      '/admin/smart_dispatch4': 'smart_dispatch4',
      '/admin/smart_return': 'smart_return',
      '/admin/dispatch_assign': 'dispatch_assign',
      '/admin/asset_assignment': 'dispatch_assign',
      '/admin/outbound_inspections': 'outbound_inspections',
      '/admin/daily_inout': 'daily_inout',
      '/admin/asset_inout_history': 'asset_inout_history',
      '/admin/available_inventory': 'available_inventory',
      '/admin/assets': 'asset',
      '/admin/asset': 'asset',
      '/admin/products': 'product',
      '/admin/contract': 'contract',
      '/admin/contracts': 'contract',
      '/admin/customer': 'customer',
      '/admin/customers': 'customer',
      '/admin/repairs': 'repair',
      '/admin/repair': 'repair',
      '/admin/field_as': 'field_as',
      '/admin/smart_as_request': 'smart_as_request',
      '/admin/billings': 'billing',
      '/admin/billing': 'billing',
      '/admin/receivables': 'receivable',
      '/admin/receivable': 'receivable',
      '/admin/bank_matching': 'bank_matching',
      '/admin/purchase_settlement': 'purchase_settlement',
      '/admin/consumables': 'consumable_stock',
      '/admin/consumable_purchase': 'consumable_purchase',
      '/admin/consumable_inout': 'consumable_inout',
      '/admin/consumable_stock': 'consumable_stock',
      '/admin/organization': 'organization',
      '/admin/asset_acquisition_disposal': 'acquisition_disposal',
      '/admin/acquisition_disposal': 'acquisition_disposal',
      '/admin/delinquency': 'delinquency',
      '/admin/cash_flow': 'cash_flow',
      '/admin/leave_application': 'leave_application',
      '/admin/leave_management': 'leave_management',
      '/admin/ot_management': 'ot_management',
      '/admin/leave_ot': 'leave_management'
    };

    if (tabMap[raw]) return tabMap[raw];
    if (raw.startsWith('/admin/')) {
      return normalizeMenuId(raw.replace('/admin/', '').split('?')[0]);
    }
    if (raw && raw !== '/') {
      return normalizeMenuId(raw.replace(/^\//, '').split('?')[0]);
    }
    if (task?.entityType === 'DELIVERY') return 'delivery';
    if (task?.entityType === 'INSPECTION') return 'outbound_inspections';
    if (task?.entityType === 'REPAIR') return 'repair';
    if (task?.entityType === 'BILLING') return 'billing';
    if (task?.entityType === 'CONTRACT') return 'contract';
    return 'dashboard';
  };

  const handleBatchCompleteNonDirectives = async () => {
    reconcileCompletedTodosInDb();
    const targetList = activeTasks.filter(t => t.taskCategory !== 'EXECUTIVE_DIRECTIVE');
    for (const t of targetList) {
      await completeTodo(t.id);
    }
    refreshAllData();
  };

  const handleConfirmDirectiveReport = async () => {
    if (!reportingDirectiveTodo) return;
    setIsSubmittingReport(true);
    try {
      if (resolveExecutiveDirective) {
        await resolveExecutiveDirective(reportingDirectiveTodo.id, directiveReportNote.trim() || '조치 완료');
      } else {
        await completeTodo(reportingDirectiveTodo.id);
      }
      setReportingDirectiveTodo(null);
      setDirectiveReportNote('');
      refreshAllData();
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div data-hs-observe="dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* ── 표준 헤더 바 ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={18} color="var(--primary)" />
          <h2 data-mid="dashboard-header" style={{ margin: 0, fontWeight: 700, fontSize: '17px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            대시보드
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            직무 중심 당면 과제 및 가용재고 운영 현황
          </span>
        </div>
        <div className="toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('available_inventory')}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
          >
            <ClipboardList size={14} />
            가용재고조회
          </button>
          <button
            data-mid="dashboard-btn-refresh"
            data-uia="btn-refresh-feed"
            onClick={() => {
              reconcileCompletedTodosInDb();
              refreshAllData();
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={14} />
            새로고침
          </button>
        </div>
      </div>

      {/* ── 영업부·경영진·출고팀 핵심 지표: 가용재고 및 출고예정 요약 바로가기 ── */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '8px',
              backgroundColor: 'var(--primary-light)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Package size={18} />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                가용재고 및 출고예정 현황
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                모델별 계약가능 재고 · 당사/임차 재고 · 출고예정 일정 통합 조회
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginLeft: '8px' }}>
            <div style={{
              padding: '6px 12px', borderRadius: '8px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.3)',
              display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>계약가능 재고</span>
              <strong style={{ fontSize: '15px', fontWeight: 900, color: 'var(--primary)' }}>
                {inventorySummary.availableContractQty}대
              </strong>
            </div>

            <div style={{
              padding: '6px 12px', borderRadius: '8px',
              backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>주기장 현재고</span>
              <strong style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                {inventorySummary.totalStock}대
              </strong>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                (당사 {inventorySummary.stockOwned} / 임차 {inventorySummary.stockRented})
              </span>
            </div>

            <div style={{
              padding: '6px 12px', borderRadius: '8px',
              backgroundColor: inventorySummary.pendingUnassignedCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-app)',
              border: inventorySummary.pendingUnassignedCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>미할당 출고예정</span>
              <strong style={{ fontSize: '14px', fontWeight: 800, color: inventorySummary.pendingUnassignedCount > 0 ? '#d97706' : 'var(--text-main)' }}>
                {inventorySummary.pendingUnassignedCount}대
              </strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {hasPermission('smart_dispatch4', 'view') && (
            <button
              type="button"
              onClick={() => setActiveTab('smart_dispatch4')}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', fontWeight: 700 }}
            >
              출고 요청 이동
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('available_inventory')}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', fontWeight: 800 }}
          >
            <Layers size={14} />
            가용재고조회 상세 <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {activeTasks.length > 0 && (
        <details data-mid="dashboard-todo-feed" open style={{
          backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
          borderLeft: '5px solid var(--primary)', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
        }}>
          <summary style={{ cursor: 'pointer', listStyle: 'none', outline: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '3px 9px', borderRadius: '4px' }}>
                담당 업무
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  총 <strong>{activeTasks.length}건</strong> 대기
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBatchCompleteNonDirectives();
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  <CheckSquare size={12} /> 일반 알림 일괄 완료
                </button>
              </div>
            </div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="var(--primary)" /> 업무 목록
            </h4>
          </summary>

          <div className="details-content">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              {activeTasks.slice(0, 12).map(task => {
                const isDirective = task.taskCategory === 'EXECUTIVE_DIRECTIVE';
                const isPackageResend = task.taskCategory === 'CONTRACT_PACKAGE_RESEND';
                const priorityColor = task.priority === 'URGENT' ? 'var(--danger)' : task.priority === 'HIGH' ? 'var(--warning)' : 'var(--primary)';
                const priorityLabel = task.priority === 'URGENT' ? '긴급' : task.priority === 'HIGH' ? '높음' : '일반';
                
                return (
                  <div key={task.id} style={{
                    backgroundColor: isDirective ? 'rgba(220, 38, 38, 0.05)' : isPackageResend ? 'rgba(29, 78, 216, 0.05)' : 'var(--bg-secondary)',
                    padding: '14px 16px', borderRadius: '8px',
                    border: isDirective ? '1.5px solid var(--danger)' : isPackageResend ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {isDirective ? (
                          <span style={{
                            fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '4px',
                            backgroundColor: 'var(--danger)', color: '#fff', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px'
                          }}>
                            ⚡ 경영진 특별지시
                          </span>
                        ) : isPackageResend ? (
                          <span style={{
                            fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '4px',
                            backgroundColor: 'var(--primary)', color: '#fff', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px'
                          }}>
                            <FileText size={11} /> 패키지 재발송 필요
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                            backgroundColor: `${priorityColor}15`, color: priorityColor, border: `1px solid ${priorityColor}33`, whiteSpace: 'nowrap'
                          }}>
                            {priorityLabel}
                          </span>
                        )}

                        {task.dueDate && (
                          <span style={{
                            fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                            backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)', whiteSpace: 'nowrap'
                          }}>
                            📅 마감: {task.dueDate}
                          </span>
                        )}

                        <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-main)' }}>
                          {task.title}
                        </span>
                      </div>

                      {task.content && (
                        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.45', whiteSpace: 'pre-line' }}>
                          {task.content}
                        </p>
                      )}

                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span>발행자: <strong>{task.senderName || '경영진'}</strong></span>
                        {task.targetDept && <span>대상부서: {task.targetDept}</span>}
                        <span>발행일시: {task.createdAt ? task.createdAt.substring(0, 16).replace('T', ' ') : '-'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                      {isPackageResend && (
                        <button
                          onClick={() => {
                            setBundleTargetContractId(task.entityId);
                            setShowBundleModal(true);
                          }}
                          style={{
                            fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                            backgroundColor: 'var(--primary)', color: '#fff', fontWeight: '800', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <FileText size={13} /> 패키지 재발송 ➔
                        </button>
                      )}

                      {(task.actionUrl || task.entityType) && (
                        <button data-hs-trigger="Process"
                          className="btn-primary"
                          onClick={() => {
                            const target = resolveTaskTargetMenu(task.actionUrl, task);
                            setActiveTab(target);
                          }}
                          style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                        >
                          처리 이동 <ArrowRight size={12} />
                        </button>
                      )}

                      {isDirective ? (
                        <button
                          onClick={() => {
                            setReportingDirectiveTodo(task);
                            setDirectiveReportNote('');
                          }}
                          style={{
                            fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                            backgroundColor: 'var(--success)', color: '#fff', fontWeight: '800', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <CheckSquare size={13} /> 조치 결과 보고 & 완료
                        </button>
                      ) : (
                        <button data-hs-trigger="Process"
                          onClick={() => completeTodo(task.id)}
                          style={{
                            fontSize: '12px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            whiteSpace: 'nowrap'
                          }}
                          title="수동 완료 처리"
                        >
                          <CheckSquare size={12} /> 완료
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      )}

      {activeTasks.length === 0 && (
        <div className="card" style={{ padding: '36px 24px', textAlign: 'center', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'var(--success-light)', color: 'var(--success)', marginBottom: '12px' }}>
            <CheckCircle size={36} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px 0' }}>처리 대기 과제 없음</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            권한 범위 내 처리 대기 항목 없음.
          </p>
          <button
            data-uia="btn-refresh-feed"
            type="button"
            className="btn-secondary"
            onClick={() => {
              reconcileCompletedTodosInDb();
              refreshAllData?.();
            }}
            style={{ padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={13} /> 피드 새로고침
          </button>
        </div>
      )}

      {reportingDirectiveTodo && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
          onClick={() => setReportingDirectiveTodo(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '460px', padding: '20px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
              특별지시 조치 결과 보고 및 완료
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              {reportingDirectiveTodo.title}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>조치 결과 메모</label>
              <textarea
                rows={3}
                value={directiveReportNote}
                onChange={e => setDirectiveReportNote(e.target.value)}
                placeholder="조치 내역을 간략히 입력하십시오."
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setReportingDirectiveTodo(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isSubmittingReport}
                onClick={handleConfirmDirectiveReport}
              >
                {isSubmittingReport ? '처리 중...' : '보고 및 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ExecutiveDirectiveModal
        isOpen={showDirectiveModal}
        onClose={() => setShowDirectiveModal(false)}
      />

      <ContractDocumentBundleModal
        isOpen={showBundleModal}
        onClose={() => {
          setShowBundleModal(false);
          setBundleTargetContractId(undefined);
        }}
        initialContractId={bundleTargetContractId}
      />
    </div>
  );
};
