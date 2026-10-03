// src/components/PersistentJobAlertToast.tsx
// 주기장/공장 현장용 고정 팝업 토스트 (확인 버튼 클릭 시까지 상주, 업무 화면 바로가기 지원)

import React, { useState, useEffect } from 'react';
import { 
  Bell, Check, ChevronRight, X, AlertCircle, 
  PackageCheck, ArrowLeftRight, Truck, Wrench, UserCheck 
} from 'lucide-react';
import { 
  jobNotificationService, JobAlertItem, JobEventType 
} from '../services/jobNotificationService';

interface Props {
  onNavigateMenu?: (menuId: string) => void;
}

export const PersistentJobAlertToast: React.FC<Props> = ({ onNavigateMenu }) => {
  const [alerts, setAlerts] = useState<JobAlertItem[]>([]);

  useEffect(() => {
    // 알림 리스너 구독
    const unsubscribe = jobNotificationService.onJobAlert((item) => {
      setAlerts(prev => [item, ...prev]);
    });
    return () => unsubscribe();
  }, []);

  const handleDismiss = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleNavigate = (alert: JobAlertItem) => {
    handleDismiss(alert.id);
    if (onNavigateMenu && alert.actionMenuId) {
      onNavigateMenu(alert.actionMenuId);
    }
  };

  if (alerts.length === 0) return null;

  const renderIcon = (type: JobEventType) => {
    switch (type) {
      case 'OUTBOUND_REQUESTED':
        return <PackageCheck size={18} color="#2563eb" />;
      case 'EXCHANGE_REQUESTED':
        return <ArrowLeftRight size={18} color="#7c3aed" />;
      case 'INBOUND_RETURN':
        return <Truck size={18} color="#16a34a" />;
      case 'REPAIR_REQUESTED':
        return <Wrench size={18} color="#d97706" />;
      case 'DISPATCH_ASSIGNED':
        return <UserCheck size={18} color="#0891b2" />;
      default:
        return <Bell size={18} color="#2563eb" />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '74px',
      right: '24px',
      zIndex: 10001,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '380px',
      width: '100%',
      pointerEvents: 'none' // 배경 클릭 통과, 개별 카드는 auto
    }}>
      {alerts.map(alert => (
        <div
          key={alert.id}
          style={{
            pointerEvents: 'auto',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '2px solid #2563eb',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.25s ease-out'
          }}
        >
          {/* 헤더 */}
          <div style={{
            padding: '10px 14px',
            backgroundColor: '#eff6ff',
            borderBottom: '1px solid #dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {renderIcon(alert.type)}
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                {alert.title}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              {alert.timestamp}
            </span>
          </div>

          {/* 본문 정보 */}
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13.5px' }}>
              {alert.customerName}
            </div>
            <div style={{ color: '#475569', fontSize: '12px' }}>
              현장: {alert.siteName}
            </div>
            {alert.modelName && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>{alert.modelName}</span>
                {alert.quantity && <span>({alert.quantity}대)</span>}
                {alert.deliveryDate && <span style={{ color: '#64748b' }}>· 납기: {alert.deliveryDate}</span>}
              </div>
            )}
            {alert.memo && (
              <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500, marginTop: '2px' }}>
                {alert.memo}
              </div>
            )}
          </div>

          {/* 액션 버튼군: [확인] & [상세 바로가기] (전사 표준 헌장 3.1) */}
          <div style={{
            padding: '8px 14px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}>
            <button
              type="button"
              onClick={() => handleDismiss(alert.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Check size={13} color="#64748b" />
              확인
            </button>

            {alert.actionMenuId && (
              <button
                type="button"
                onClick={() => handleNavigate(alert)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>상세 바로가기</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
