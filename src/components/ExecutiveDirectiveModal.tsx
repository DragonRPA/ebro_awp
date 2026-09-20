// src/components/ExecutiveDirectiveModal.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Send, AlertTriangle, User, Users, Calendar, Link2, ShieldAlert } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const DEPT_OPTIONS = [
  { id: 'SALES', name: '영업팀' },
  { id: 'DISPATCH', name: '배차팀' },
  { id: 'YARD', name: '주기장/입출고팀' },
  { id: 'MAINTENANCE', name: '정비/AS팀' },
  { id: 'BILLING', name: '청구/수납팀' },
  { id: 'ACCOUNTING', name: '회계/자금팀' },
  { id: 'ADMIN', name: '경영지원/관리팀' }
];

const ACTION_URL_PRESETS = [
  { label: '선택 안함 (메인 대시보드)', url: '/' },
  { label: '배차 / 운송 관리', url: '/admin/dispatch' },
  { label: '출고 검수 (PDI)', url: '/admin/outbound_inspections' },
  { label: '계약 관리 대장', url: '/admin/contract' },
  { label: '장비 정비 / 현장 AS', url: '/admin/repairs' },
  { label: '매출 청구 대장', url: '/admin/billings' },
  { label: '연체 및 채권 관리', url: '/admin/delinquency' },
  { label: '자금 흐름 분석', url: '/admin/cash_flow' },
  { label: '소모품 자재 관리', url: '/admin/consumables' }
];

export const ExecutiveDirectiveModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { users, currentUser, issueExecutiveDirective, showErrorModal } = useApp();

  const [targetType, setTargetType] = useState<'USER' | 'DEPT'>('USER');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('SALES');
  const [priority, setPriority] = useState<'URGENT' | 'HIGH' | 'NORMAL'>('URGENT');
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().substring(0, 10);
  });
  const [actionUrl, setActionUrl] = useState<string>('/');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('지시 제목을 입력해 주십시오.');
      return;
    }
    if (!content.trim()) {
      alert('지시 세부 내용을 입력해 주십시오.');
      return;
    }
    if (targetType === 'USER' && !selectedUserId) {
      alert('업무를 수행할 특정 임직원을 선택해 주십시오.');
      return;
    }

    try {
      setIsSubmitting(true);
      await issueExecutiveDirective({
        targetType,
        targetUserId: targetType === 'USER' ? selectedUserId : undefined,
        targetDept: targetType === 'DEPT' ? selectedDept : undefined,
        title: title.trim(),
        content: content.trim(),
        priority,
        dueDate,
        actionUrl
      });

      const targetDesc = targetType === 'USER' 
        ? `${users.find(u => u.id === selectedUserId)?.name || '지정 직원'}님에게`
        : `${DEPT_OPTIONS.find(d => d.id === selectedDept)?.name || '해당 부서'} 전체에`;

      alert(`✅ 경영진 업무지시가 ${targetDesc} 성공적으로 하달되었습니다.`);
      onClose();
      // 폼 초기화
      setTitle('');
      setContent('');
      setSelectedUserId('');
    } catch (err: any) {
      showErrorModal(`⚠️ 업무지시 하달 실패:\n${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)', borderRadius: '14px',
        width: '100%', maxWidth: '640px', maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        border: '1px solid var(--border-color, var(--border-color))',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'var(--bg-secondary, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: 'var(--danger)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                경영진 업무지시 하달
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                발행자: {currentUser?.name || '경영진'} ({currentUser?.department || '대표이사'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 1. 대상 선택 토글 (상하 세로 스택) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
              지시 대상 구분
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setTargetType('USER')}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px',
                  border: `2px solid ${targetType === 'USER' ? '#3b82f6' : 'var(--border-color)'}`,
                  backgroundColor: targetType === 'USER' ? 'rgba(59,130,246,0.08)' : 'var(--bg-card)',
                  color: targetType === 'USER' ? '#3b82f6' : 'var(--text-main)',
                  fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <User size={16} /> 특정 인원 지정 (1:1 하달)
              </button>
              <button
                type="button"
                onClick={() => setTargetType('DEPT')}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px',
                  border: `2px solid ${targetType === 'DEPT' ? '#3b82f6' : 'var(--border-color)'}`,
                  backgroundColor: targetType === 'DEPT' ? 'rgba(59,130,246,0.08)' : 'var(--bg-card)',
                  color: targetType === 'DEPT' ? '#3b82f6' : 'var(--text-main)',
                  fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Users size={16} /> 특정 부서 전체 (1:N 부서 하달)
              </button>
            </div>
          </div>

          {/* 2. 대상 지정 선택창 */}
          {targetType === 'USER' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                수행 담당자 선택
              </label>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                style={{
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)', fontSize: '13px', color: 'var(--text-main)'
                }}
                required
              >
                <option value="">-- 업무를 수행할 담당 직원을 선택하십시오 --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.department || '부서미지정'} / {u.position || u.role || '직급미지정'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                수행 대상 부서 선택
              </label>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                style={{
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)', fontSize: '13px', color: 'var(--text-main)'
                }}
                required
              >
                {DEPT_OPTIONS.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. 중요도 / 긴급도 및 완료기한 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                중요도 / 긴급도
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['URGENT', 'HIGH', 'NORMAL'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: '800',
                      border: priority === p ? '2px solid' : '1px solid var(--border-color)',
                      borderColor: p === 'URGENT' ? '#ef4444' : p === 'HIGH' ? '#f59e0b' : '#3b82f6',
                      backgroundColor: priority === p 
                        ? (p === 'URGENT' ? 'rgba(239,68,68,0.15)' : p === 'HIGH' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)')
                        : 'var(--bg-card)',
                      color: p === 'URGENT' ? '#ef4444' : p === 'HIGH' ? '#f59e0b' : '#3b82f6',
                      cursor: 'pointer'
                    }}
                  >
                    {p === 'URGENT' ? '🚨 긴급' : p === 'HIGH' ? '⚡ 높음' : '📌 보통'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} /> 완료 마감 기한
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{
                  padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)', fontSize: '13px', color: 'var(--text-main)'
                }}
                required
              />
            </div>
          </div>

          {/* 4. 바로가기 메뉴 연결 (선택) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Link2 size={14} /> 바로가기 관리 화면 지정
            </label>
            <select
              value={actionUrl}
              onChange={e => setActionUrl(e.target.value)}
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)', fontSize: '13px', color: 'var(--text-main)'
              }}
            >
              {ACTION_URL_PRESETS.map(preset => (
                <option key={preset.url} value={preset.url}>
                  {preset.label} ({preset.url})
                </option>
              ))}
            </select>
          </div>

          {/* 5. 지시 제목 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
              지시 제목
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: [긴급] 평택 고덕현장 15대 일괄 출고 전 배차 확정 요망"
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)', fontSize: '13.5px', color: 'var(--text-main)', fontWeight: '600'
              }}
              required
            />
          </div>

          {/* 6. 지시 세부 내용 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
              지시 세부 내용 (지침 및 요구결과)
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="구체적인 업무 내용, 특이사항, 고객사 요구사항, 완료 후 보고해야 할 사항을 상세히 기재해 주십시오."
              style={{
                padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)', fontSize: '13px', color: 'var(--text-main)',
                lineHeight: '1.5', resize: 'vertical'
              }}
              required
            />
          </div>

          {/* 최하단 Gutenberg Z-패턴 완결 버튼 */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '10px',
            marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                backgroundColor: 'var(--danger)', color: '#fff', fontSize: '13.5px', fontWeight: '800',
                display: 'flex', alignItems: 'center', gap: '6px', cursor: isSubmitting ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              <Send size={15} /> {isSubmitting ? '하달 중...' : '업무지시 즉시 하달'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
