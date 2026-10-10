import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Activity, ShieldAlert, Users, Layers, ShieldCheck, Wrench, Truck, CreditCard, CheckCircle, Bell, AlertTriangle, ArrowRight, Cloud, AlertCircle, Download, FileText, Bot, Shield, CheckSquare, Calendar, ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react';
import { EXPECTED_AGENT_VERSION, AGENT_DOWNLOAD_URL, AGENT_CERT_URL, AGENT_INSTALL_BAT_URL, AGENT_KILL_BAT_URL, AGENT_EXE_URL, fetchWithAgentFallback, isAgentOnlineGlobal, subscribeAgentStatus } from '../services/agentService';
import { findActiveTasksForUser } from '../utils/taskHandoverPipeline';
import { ExecutiveDirectiveModal } from '../components/ExecutiveDirectiveModal';
import { ContractDocumentBundleModal } from '../components/ContractDocumentBundleModal';
import { Todo } from '../services/db';

export const Dashboard: React.FC = () => {
  const { 
    currentUser, 
    hasPermission, 
    todos, 
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

  const [agentStatus, setAgentStatus] = useState<'ONLINE' | 'OFFLINE'>(() => isAgentOnlineGlobal() ? 'ONLINE' : 'OFFLINE');
  const [agentCallsign, setAgentCallsign] = useState<string>('');
  const [agentVersion, setAgentVersion] = useState<string>('');
  const [isDownloadingAgent, setIsDownloadingAgent] = useState(false);
  const [isRestartingAgent, setIsRestartingAgent] = useState(false);
  const [showAgentGuideModal, setShowAgentGuideModal] = useState(false);

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

  return (
    <div data-hs-observe="dashboard" data-mid="dashboard-header" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      
      {activeTasks.length > 0 && (
        <details data-mid="dashboard-todo-feed" open style={{
                backgroundColor: 'var(--bg-card)', borderRadius: '12px', padding: '20px 24px',
                borderLeft: '5px solid #6366f1', border: '1px solid var(--border-color)', borderLeftWidth: '5px'
              }}>
<summary style={{ cursor: "pointer", listStyle: "none", outline: "none" }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', padding: '3px 9px', borderRadius: '4px' }}>
                    담당 업무
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      총 <strong>{activeTasks.length}건</strong> 대기
                    </span>
                    <button
                      data-mid="dashboard-btn-refresh" data-uia="btn-refresh-feed"
                      type="button"
                      className="btn-secondary"
                      onClick={(e) => { e.stopPropagation(); refreshAllData?.(); }}
                      style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <RefreshCw size={11} /> 새로고침
                    </button>
                  </div>
                </div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} color="#6366f1" /> 업무 목록
                </h4>
</summary>
<div className="details-content">

                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  {activeTasks.slice(0, 8).map(task => {
                    const isDirective = task.taskCategory === 'EXECUTIVE_DIRECTIVE';
                    const isPackageResend = task.taskCategory === 'CONTRACT_PACKAGE_RESEND';
                    const priorityColor = task.priority === 'URGENT' ? '#ef4444' : task.priority === 'HIGH' ? '#f59e0b' : '#3b82f6';
                    
                    return (
                      <div key={task.id} style={{
                        backgroundColor: isDirective ? 'rgba(239, 68, 68, 0.03)' : isPackageResend ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-secondary)',
                        padding: '14px 16px', borderRadius: '8px',
                        border: isDirective ? '1.5px solid rgba(239, 68, 68, 0.35)' : isPackageResend ? '1.5px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-color)',
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
                                backgroundColor: '#6366f1', color: '#fff', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '3px'
                              }}>
                                <FileText size={11} /> 패키지 재발송 필요
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '11px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                                backgroundColor: `${priorityColor}15`, color: priorityColor, border: `1px solid ${priorityColor}33`, whiteSpace: 'nowrap'
                              }}>
                                {task.priority || 'NORMAL'}
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
                          {/* 🌟 계약서패키지 재발송 모달 호출 버튼 */}
                          {isPackageResend && (
                            <button
                              onClick={() => {
                                setBundleTargetContractId(task.entityId);
                                setShowBundleModal(true);
                              }}
                              style={{
                                fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: 'none',
                                backgroundColor: 'var(--primary)', color: '#fff', fontWeight: '800', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(79,70,229,0.3)',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <FileText size={13} /> 패키지 재발송 ➔
                            </button>
                          )}

                          {task.actionUrl && task.actionUrl !== '/' && (
                            <button data-hs-trigger="Process"
                              className="btn-primary"
                              onClick={() => {
                                const tabMap: Record<string, string> = {
                                  '/admin/dispatch': 'delivery',
                                  '/admin/dispatch_assign': 'dispatch_assign',
                                  '/admin/outbound_inspections': 'outbound_inspections',
                                  '/admin/contract': 'contract',
                                  '/admin/repairs': 'repair',
                                  '/admin/billings': 'billing',
                                  '/admin/consumables': 'consumable',
                                  '/admin/organization': 'organization',
                                  '/admin/asset_acquisition_disposal': 'asset_acquisition_disposal',
                                  '/admin/delinquency': 'delinquency',
                                  '/admin/cash_flow': 'cash_flow',
                                  '/admin/leave_application': 'leave_application',
                                  '/admin/leave_management': 'leave_management',
                                  '/admin/ot_management': 'ot_management',
                                  '/admin/leave_ot': 'leave_management'
                                };
                                const target = tabMap[task.actionUrl || ''] || 'dashboard';
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
                                display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(16,185,129,0.25)',
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
                <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', marginBottom: '12px' }}>
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
                  onClick={() => refreshAllData?.()}
                  style={{ padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <RefreshCw size={13} /> 피드 새로고침
                </button>
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
