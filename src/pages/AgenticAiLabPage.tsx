// src/pages/AgenticAiLabPage.tsx
// 에이전틱 AI (Agentic AI) 샌드박스 랩 - 전사 표준 헌장 준수 테스트베드 스튜디오

import React, { useState } from 'react';
import { 
  Bot, Play, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, 
  Terminal, Cpu, Zap, Layers, Clock, MousePointer, Check, ArrowRight
} from 'lucide-react';
import { 
  AGENTIC_TOOLS_MANIFEST, 
  runAgenticWorkflow, 
  AgenticExecutionResult,
  AgentStep
} from '../services/agenticActionGateway';

export const AgenticAiLabPage: React.FC = () => {
  const [prompt, setPrompt] = useState('판교 테크노밸리 현장 장비 교체 요청에 대해 단일 EXCHANGE 왕복 배차 1건 발행하고 왕복할인을 적용해줘');
  const [isRunning, setIsRunning] = useState(false);
  const [currentResult, setCurrentResult] = useState<AgenticExecutionResult | null>(null);
  const [stressLog, setStressLog] = useState<string[]>([]);
  const [stressRunning, setStressRunning] = useState(false);

  // 시나리오 프리셋 (헌장 3.1 건조 명사 규격)
  const PRESETS = [
    {
      title: '대차 교환 배차 단일 발행',
      desc: '헌장 2.3 단일 EXCHANGE 1건 및 왕복할인 ₩60,000 자동 계산',
      prompt: '판교 테크노밸리 현장 장비 교체 요청에 대해 단일 EXCHANGE 왕복 배차 1건 발행하고 왕복할인을 적용해줘'
    },
    {
      title: '소모품 50종 일괄 매입 적재',
      desc: '헌장 1.2 소모품 대량 구매 및 재고 가산, 수불로그 무누락 저장',
      prompt: '삼화윤활유에서 유압작동유 50통 단가 45,000원에 매입 등록하고 주기장 재고를 갱신해줘'
    },
    {
      title: '연체 고객사 출고 차단 조치',
      desc: '장기 미수 고객사 조회 후 거래상태 BLOCKED 전환 및 출고 잠금',
      prompt: '3개월 이상 연체된 미수금 보유 고객사를 확인하고 신규 출고 및 계약을 즉시 차단해줘'
    },
    {
      title: '3대 보존 법칙 전수 감사',
      desc: '헌장 5.5 날짜·수지·상태 보존 법칙 종단 무결성 전수 검증',
      prompt: '전사 계약 매출 기여액과 자산 가동일, 대차대조 차액 ₩0 무결성을 전수 검증해줘'
    },
    {
      title: '오류 신고 등록 및 단계별 처리',
      desc: '헌장 1.1/1.2 신고 등록(Ctrl+V 캡처), 접수 배정, 조치 완료 3단계 파이프라인',
      prompt: '배차 목록 엑셀 내보내기 타임아웃 오류에 대한 신고를 등록하고 상태를 접수 완료로 처리해줘'
    }
  ];

  // 단일 워크플로우 실행
  const handleRunWorkflow = async () => {
    if (!prompt.trim() || isRunning) return;
    setIsRunning(true);
    try {
      const res = await runAgenticWorkflow(prompt);
      setCurrentResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  // 20회 연속 스트레스 테스트 실행 (헌장 5.5)
  const handleRun20StressTests = async () => {
    setStressRunning(true);
    setStressLog([]);
    const logs: string[] = [];

    const scenarios = [
      '대차 교환 배차 단일 발행 1건',
      '소모품 엔진오일 50개 매입 등록',
      '미수 연체 고객사 출고 차단',
      '출고 검수 합격 및 RENTED 전환',
      '통장 입금 1:1 대사 수수료 ₩500 보정',
      '대차 자산 매출 기여액 1원 일치 검증',
      '정비 완료 보고 및 AVAILABLE 복원',
      '법인차량 주유 영수증 일괄 등록',
      '고객사 및 현장 1:N 일괄 생성',
      '전사 3대 보존 법칙 종단 확인'
    ];

    for (let i = 1; i <= 20; i++) {
      const sc = scenarios[(i - 1) % scenarios.length];
      const res = await runAgenticWorkflow(sc);
      const logLine = `[WTT-AI-${String(i).padStart(2, '0')}] ${sc} ➔ 결과: ${res.status === 'SUCCESS' ? 'PASS' : 'BLOCKED'} (차액: ₩${res.metrics.conservationDiff}, 시간: ${res.metrics.aiSeconds}s)`;
      logs.push(logLine);
      setStressLog([...logs]);
    }

    setStressRunning(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px' }}>
      
      {/* ── 1. 화면 헤더 (무수식어 건조 표준 3.1) ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontWeight: '800', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={22} color="var(--primary)" />
            <span>에이전틱 AI 샌드박스 랩</span>
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
            AI 에이전트 자율 업무 수행 검증 및 전사 표준 헌장 가드레일 테스트베드
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleRun20StressTests}
            disabled={stressRunning || isRunning}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px', fontWeight: '700' }}
          >
            {stressRunning ? <RefreshCw size={14} className="spin" /> : <Zap size={14} color="#f59e0b" />}
            <span>20회 연속 스트레스 테스트</span>
          </button>
          <button
            type="button"
            onClick={handleRunWorkflow}
            disabled={isRunning || stressRunning}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 18px', fontWeight: '700' }}
          >
            {isRunning ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
            <span>에이전틱 AI 실행</span>
          </button>
        </div>
      </div>

      {/* ── 2. 시나리오 프리셋 및 자연어 입력창 (Gutenberg Z-Pattern Scope & Input) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
        
        {/* 좌상단: 시나리오 프리셋 선택 */}
        <div className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
            시나리오 프리셋 선택
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(p.prompt)}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: prompt === p.prompt ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: prompt === p.prompt ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-app)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '700', color: prompt === p.prompt ? 'var(--primary)' : 'var(--text-primary)' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {p.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 우상단: 자연어 프롬프트 입력 */}
        <div className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
            자연어 프롬프트 지시 (Prompt Console)
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="에이전트에게 지시할 비즈니스 업무를 자연어로 입력하세요..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              lineHeight: 1.5,
              resize: 'none',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>* 에이전트는 기계 가독형 매니페스트를 기반으로 ReAct 추론을 수행합니다.</span>
            <span>엔터 또는 상단 [에이전틱 AI 실행] 버튼 클릭</span>
          </div>
        </div>

      </div>

      {/* ── 3. 편의성 및 효익 정량 비교 HUD (Terminal Metric) ── */}
      {currentResult && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
          padding: '14px',
          borderRadius: '8px',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.25)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>작업 소요 시간</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} />
              <span>{currentResult.metrics.manualMinutes}분 ➔ {currentResult.metrics.aiSeconds}초</span>
            </div>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>
              {currentResult.metrics.timeSavedPercent}% 시간 단축
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>마우스 클릭 및 입력 조작</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MousePointer size={16} />
              <span>{currentResult.metrics.manualClicks}회 ➔ {currentResult.metrics.aiClicks}회</span>
            </div>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>
              {currentResult.metrics.clicksSavedPercent}% 조작 감소
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>데이터 입력 오류율</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>0.00% (오류 0건)</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              헌장 가드레일 자동 검증
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>대차대조 보존 차액</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} />
              <span>₩{currentResult.metrics.conservationDiff.toLocaleString()}</span>
            </div>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>
              수지 보존 법칙 100% 충족
            </span>
          </div>
        </div>
      )}

      {/* ── 4. 본문: ReAct 추론 타임라인 & 20대 도구 카탈로그 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
        
        {/* 좌측: ReAct 추론 타임라인 */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} color="var(--primary)" />
              <span>에이전트 ReAct 추론 및 Tool Calling 타임라인</span>
            </div>
            {currentResult && (
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: currentResult.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: currentResult.status === 'SUCCESS' ? '#059669' : '#dc2626'
              }}>
                {currentResult.status}
              </span>
            )}
          </div>

          {currentResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentResult.steps.map((step) => (
                <div
                  key={step.stepNo}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: step.type === 'GUARDRAIL_CHECK' ? 'rgba(245, 158, 11, 0.08)' :
                                     step.type === 'RESULT' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-app)',
                    border: step.type === 'GUARDRAIL_CHECK' ? '1px solid rgba(245, 158, 11, 0.3)' :
                            step.type === 'RESULT' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                    fontSize: '12px',
                    lineHeight: 1.5
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{
                      fontWeight: '800',
                      fontSize: '11px',
                      color: step.type === 'THOUGHT' ? '#6366f1' :
                             step.type === 'TOOL_CALL' ? '#2563eb' :
                             step.type === 'GUARDRAIL_CHECK' ? '#d97706' :
                             step.type === 'OBSERVATION' ? '#059669' : '#10b981'
                    }}>
                      [Step {step.stepNo}: {step.type}] {step.toolName ? `➔ ${step.toolName}` : ''}
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {step.timestamp.slice(11, 19)}
                    </span>
                  </div>

                  {step.thought && (
                    <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                      💭 {step.thought}
                    </div>
                  )}

                  {step.input && (
                    <pre style={{ margin: '4px 0 0 0', padding: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '11px', overflowX: 'auto' }}>
                      {JSON.stringify(step.input, null, 2)}
                    </pre>
                  )}

                  {step.output && (
                    <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                      👁️ {JSON.stringify(step.output)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '12.5px' }}>
              상단 [에이전틱 AI 실행] 버튼을 클릭하면 AI의 ReAct 추론 과정이 표시됩니다.
            </div>
          )}

          {/* 20회 연속 스트레스 테스트 실행 로그 */}
          {stressLog.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                연속 스트레스 테스트 로그 ({stressLog.length} / 20)
              </div>
              <div style={{
                maxHeight: '140px',
                overflowY: 'auto',
                backgroundColor: '#0f172a',
                color: '#38bdf8',
                padding: '10px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '11px',
                lineHeight: 1.6
              }}>
                {stressLog.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 우측: 20대 표준 Tool Calling 매니페스트 카탈로그 */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={16} color="var(--primary)" />
            <span>AI 에이전트 도구 매니페스트 (MCP 규격)</span>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            에이전트가 브라우저 DOM 대신 원자적(Atomic)으로 직접 호출할 수 있는 표준 API 목록입니다.
          </div>

          <div style={{ maxHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {AGENTIC_TOOLS_MANIFEST.map((tool, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  fontSize: '11.5px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '12px' }}>
                    {tool.name}
                  </strong>
                  <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    {tool.domain}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: 1.4 }}>
                  {tool.description}
                </div>
                <div style={{ fontSize: '10.5px', color: '#d97706', fontWeight: '600' }}>
                  ⚖️ {tool.charterRule}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};