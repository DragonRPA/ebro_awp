// src/components/SolutionAppSwitcher.tsx
// 🔄 AWP / IT 솔루션 전환 스위처 (전사 표준 헌장 1.1, 1.4, 3.1)
// - AWP 솔루션 환경: [ 🔄 IT 솔루션 전환 ] (배지: IT)
// - IT 솔루션 환경:  [ 🔄 AWP 솔루션 전환 ] (배지: AWP)
// - 클릭 시 프로덕션 환경에서는 {tenant}.it.ebro.run / {tenant}.awp.ebro.run 으로 이동
// - 로컬/시뮬레이션 환경에서는 ?solution=it / ?solution=awp 쿼리 파라미터 갱신

import React, { useState, useEffect } from 'react';
import { detectActiveSolution } from '../utils/domainRouter';
import { Tenant } from '../services/db';
import { useApp } from '../context/AppContext';

export interface SolutionAppSwitcherProps {
  currentTenant?: Tenant | null;
  className?: string;
  style?: React.CSSProperties;
}

export const SolutionAppSwitcher: React.FC<SolutionAppSwitcherProps> = ({
  currentTenant: propTenant,
  className,
  style,
}) => {
  const appContext = useApp();
  const tenant = propTenant || appContext?.currentTenant;

  const [currentSolution, setCurrentSolution] = useState<'AWP' | 'IT'>(() => {
    const detected = detectActiveSolution();
    if (detected === 'IT') return 'IT';
    if (detected === 'AWP') return 'AWP';
    if (tenant?.solutionType === 'IT') return 'IT';
    return 'AWP';
  });

  useEffect(() => {
    const detected = detectActiveSolution();
    if (detected === 'IT') {
      setCurrentSolution('IT');
    } else if (detected === 'AWP') {
      setCurrentSolution('AWP');
    } else if (tenant?.solutionType === 'IT') {
      setCurrentSolution('IT');
    } else {
      setCurrentSolution('AWP');
    }
  }, [tenant?.solutionType]);

  const isCurrentAwp = currentSolution === 'AWP';
  const targetSolution = isCurrentAwp ? 'IT' : 'AWP';
  const targetLower = targetSolution.toLowerCase();

  const handleSwitch = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname.toLowerCase();
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.localhost');
    const isEbroProduction = hostname.endsWith('ebro.run') && !isLocalhost;

    if (isEbroProduction) {
      // 1. 프로덕션 ebro.run 도메인: {tenant}.it.ebro.run 또는 {tenant}.awp.ebro.run
      let tenantSub = (tenant?.subdomain || tenant?.tenantCode || 'giyeonlift').toLowerCase();

      // 기존 호스트명이 {subdomain}.{solution}.ebro.run 구조인 경우 테넌트 서브도메인 추출
      const parts = hostname.split('.');
      if (parts.length >= 4 && (parts[1] === 'it' || parts[1] === 'awp')) {
        tenantSub = parts[0];
      } else if (parts.length === 3 && parts[1] === 'ebro' && parts[2] === 'run') {
        if (parts[0] !== 'admin' && parts[0] !== 'www' && parts[0] !== 'it' && parts[0] !== 'awp') {
          tenantSub = parts[0];
        }
      }

      const targetUrl = `https://${tenantSub}.${targetLower}.ebro.run`;
      window.location.href = targetUrl;
    } else {
      // 2. 로컬 개발 환경 및 시뮬레이션: ?solution=it / ?solution=awp 파라미터 설정
      try {
        localStorage.setItem('ebro_current_solution', targetLower);
      } catch {
        // LocalStorage 접근 불가 예외 방어
      }

      const targetUrl = new URL(window.location.href);
      targetUrl.searchParams.set('solution', targetLower);
      if (targetUrl.searchParams.has('app')) {
        targetUrl.searchParams.delete('app');
      }

      window.location.href = targetUrl.toString();
    }
  };

  return (
    <button
      type="button"
      onClick={handleSwitch}
      className={className}
      style={{
        padding: '6px 11px',
        borderRadius: '20px',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-color)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'all 0.15s ease',
        userSelect: 'none',
        ...style,
      }}
      title={isCurrentAwp ? 'IT 솔루션 전환' : 'AWP 솔루션 전환'}
    >
      <span style={{ fontSize: '13px', lineHeight: 1 }} aria-hidden="true">
        🔄
      </span>
      <span>{isCurrentAwp ? 'IT 솔루션 전환' : 'AWP 솔루션 전환'}</span>
      <span
        style={{
          fontSize: '10px',
          fontWeight: 800,
          padding: '1px 5px',
          borderRadius: '4px',
          letterSpacing: '0.3px',
          backgroundColor: isCurrentAwp
            ? 'rgba(59, 130, 246, 0.12)'
            : 'rgba(245, 158, 11, 0.14)',
          color: isCurrentAwp ? '#2563eb' : '#d97706',
          border: `1px solid ${
            isCurrentAwp ? 'rgba(59, 130, 246, 0.25)' : 'rgba(245, 158, 11, 0.3)'
          }`,
          display: 'inline-flex',
          alignItems: 'center',
          lineHeight: 1.2,
        }}
      >
        {targetSolution}
      </span>
    </button>
  );
};

export default SolutionAppSwitcher;
