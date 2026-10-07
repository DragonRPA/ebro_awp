import React, { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';

interface LocalAiLoadingIndicatorProps {
  isVisible: boolean;
  modelName?: string;
  estimatedSeconds?: number;
}

export const LocalAiLoadingIndicator: React.FC<LocalAiLoadingIndicatorProps> = ({ 
  isVisible, 
  modelName = 'ebro-qwen:3b',
  estimatedSeconds = 15 
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isVisible]);

  if (!isVisible) return null;

  const progress = Math.min(100, Math.floor((elapsed / estimatedSeconds) * 100));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px',
      backgroundColor: 'rgba(236, 253, 245, 0.5)', border: '1px solid #10b981',
      borderRadius: '8px', marginBottom: '16px', marginTop: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857', fontWeight: 600, fontSize: '13px' }}>
        <Cpu size={18} className="animate-pulse" />
        <span>로컬 AI 모델 ({modelName}) 웨이크업 및 분석 중...</span>
      </div>
      
      <div style={{ width: '100%', height: '6px', backgroundColor: '#d1fae5', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: \%, backgroundColor: '#10b981',
          transition: 'width 1s linear'
        }} />
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#059669' }}>
        <span>{elapsed}초 경과</span>
        <span>예상 소요시간: 약 {estimatedSeconds}초 (최초 구동 시)</span>
      </div>
    </div>
  );
};
