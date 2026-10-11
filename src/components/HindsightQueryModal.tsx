// src/components/HindsightQueryModal.tsx
// 🧠 Hindsight 4-Tier Memory & Natural Language Q&A Modal
// 🏛️ 전사 시스템 개발 표준 헌장 3.1(무수식어 건조 표준) & 3.2(nowrap) 준수

import React, { useState, useEffect } from 'react';
import { 
  X, Search, Sparkles, Database, Brain, Globe, Clock, ShieldCheck, 
  ArrowRight, CheckCircle2, Layers, RefreshCw, Send
} from 'lucide-react';
import { 
  hindsightMemory, 
  HindsightWorldFact, 
  HindsightExperience, 
  HindsightObservation, 
  HindsightMentalModel,
  ReflectResponse,
  RecallResult
} from '../services/hindsightMemoryService';

interface HindsightQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HindsightQueryModal: React.FC<HindsightQueryModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'QA' | 'FACTS' | 'EXPERIENCES' | 'OBSERVATIONS' | 'MODELS'>('QA');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [reflectResult, setReflectResult] = useState<ReflectResponse | null>(null);
  const [recallResult, setRecallResult] = useState<RecallResult | null>(null);

  // 4대 메모리 원장 데이터
  const [worldFacts, setWorldFacts] = useState<HindsightWorldFact[]>([]);
  const [observations, setObservations] = useState<HindsightObservation[]>([]);
  const [mentalModels, setMentalModels] = useState<HindsightMentalModel[]>([]);
  const [recentExperiences, setRecentExperiences] = useState<HindsightExperience[]>([]);
  const [expLoading, setExpLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMemoryData();
    }
  }, [isOpen]);

  const loadMemoryData = async () => {
    await hindsightMemory.ensureInitialized();
    setWorldFacts(hindsightMemory.getWorldFacts());
    setObservations(hindsightMemory.getObservations());
    setMentalModels(hindsightMemory.getMentalModels());

    // 최근 경험 데이터 로드
    setExpLoading(true);
    try {
      const res = await hindsightMemory.recall('', 20);
      setRecentExperiences(res.experiences);
    } catch {} finally {
      setExpLoading(false);
    }
  };

  const handleSearch = async (targetQuery?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!q) return;

    if (targetQuery !== undefined) {
      setQuery(targetQuery);
    }

    setLoading(true);
    try {
      const [refl, rec] = await Promise.all([
        hindsightMemory.reflect(q),
        hindsightMemory.recall(q, 10)
      ]);
      setReflectResult(refl);
      setRecallResult(rec);
    } catch (err: any) {
      console.warn('[Hindsight] Query error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const quickPrompts = [
    '삼성전자 고덕 현장 단가 얼마로 들어갔었지?',
    '화성 남양에서 포천 가는 5톤 축차 보통 얼마 줬지?',
    '오늘 비 오는데 판교 현장 배차 취소해야 돼?',
    '현대건설 지난달 청구 차액 5만 원 왜 발생했지?',
    'GS-1930 3년차에 보통 뭐 점검해야 돼?'
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        width: '950px',
        maxWidth: '96vw',
        height: '85vh',
        backgroundColor: 'var(--bg-primary, #ffffff)',
        color: 'var(--text-primary, #1e293b)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        border: '1px solid var(--border-color, #cbd5e1)'
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          backgroundColor: 'var(--bg-secondary, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={20} style={{ color: '#2563eb' }} />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', whiteSpace: 'nowrap' }}>
              Hindsight 4대 메모리 지식 콘솔
            </h2>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#dbeafe',
              color: '#1d4ed8',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}>
              Supabase Pro pgvector 연동
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #64748b)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          backgroundColor: 'var(--bg-primary, #ffffff)',
          padding: '0 16px'
        }}>
          {[
            { id: 'QA', label: '자연어 질의응답', icon: Sparkles },
            { id: 'FACTS', label: `World facts (${worldFacts.length})`, icon: Globe },
            { id: 'EXPERIENCES', label: `Experiences (${recentExperiences.length})`, icon: Database },
            { id: 'OBSERVATIONS', label: `Observations (${observations.length})`, icon: Brain },
            { id: 'MODELS', label: `Mental models (${mentalModels.length})`, icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 14px',
                  border: 'none',
                  background: 'none',
                  borderBottom: isSelected ? '2px solid #2563eb' : '2px solid transparent',
                  color: isSelected ? '#2563eb' : 'var(--text-secondary, #64748b)',
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 본문 컨테이너 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
          {/* 1. 자연어 질의응답 탭 */}
          {activeTab === 'QA' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 질의 입력창 */}
              <div style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: '#ffffff',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <Search size={18} style={{ color: '#94a3b8', marginTop: '8px' }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Hindsight에게 질문하세요 (예: 삼성 고덕 현장 단가, 포천 5톤 배차비, GS-1930 3년차 점검 등)"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '14px',
                    color: '#0f172a'
                  }}
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={loading || !query.trim()}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: loading || !query.trim() ? 0.6 : 1
                  }}
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>질문</span>
                </button>
              </div>

              {/* 빠른 질문 프롬프트 칩스 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center', fontWeight: '600', whiteSpace: 'nowrap' }}>
                  추천 질문:
                </span>
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearch(p)}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      color: '#334155',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* AI 답변 영역 */}
              {reflectResult && (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={16} style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Hindsight 4대 메모리 종합 답변</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{reflectResult.dry_summary}</span>
                  </div>

                  <div style={{
                    fontSize: '13px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    color: '#1e293b',
                    backgroundColor: '#f8fafc',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {reflectResult.answer}
                  </div>

                  {reflectResult.action_recommendation && (
                    <div style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '10px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#1e40af',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                      <div>
                        <strong>추천 조치:</strong> {reflectResult.action_recommendation}
                      </div>
                    </div>
                  )}

                  {/* 근거 메모리 뱃지 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {reflectResult.sources.fact_keys.map((fk, i) => (
                      <span key={i} style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '3px' }}>
                        🌐 {fk}
                      </span>
                    ))}
                    {reflectResult.sources.observation_clusters.map((ob, i) => (
                      <span key={i} style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '3px' }}>
                        🧠 {ob}
                      </span>
                    ))}
                    {reflectResult.sources.experience_count > 0 && (
                      <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '3px' }}>
                        ⚡ 과거 경험 {reflectResult.sources.experience_count}건 참조
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. World facts 탭 */}
          {activeTab === 'FACTS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Hindsight가 항상 참(True)으로 전제하는 전사 표준 헌장, 기준 단가표, 장비 제원, 물리 법칙 공리 목록입니다.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                {worldFacts.map(wf => (
                  <div key={wf.id} style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{wf.fact_title}</span>
                      <span style={{ fontSize: '11px', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '3px' }}>
                        {wf.source_reference}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                      {wf.fact_content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Experiences 탭 */}
          {activeTab === 'EXPERIENCES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  사용자가 업무 중 조작할 때 백그라운드에서 무음(0ms 블로킹)으로 적재된 인터랙션 로그입니다. (PIPA 사전 정제 완료)
                </span>
                <button 
                  onClick={loadMemoryData} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={13} />
                  <span>새로고침</span>
                </button>
              </div>

              {expLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>경험 데이터 로딩 중...</div>
              ) : recentExperiences.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '6px' }}>
                  적재된 최근 경험 데이터가 없습니다. 사용자가 시스템을 조작하면 무음으로 자동 수집됩니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentExperiences.map((exp, idx) => (
                    <div key={idx} style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                          ⚡ {exp.action_name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {new Date(exp.created_at).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', display: 'flex', gap: '12px' }}>
                        <span>📍 메뉴: {exp.menu_path}</span>
                        {exp.domain && <span>🏷️ 도메인: {exp.domain}</span>}
                        {exp.pii_masked && <span style={{ color: '#16a34a' }}>🛡️ PII 마스킹됨</span>}
                      </div>
                      {exp.raw_sql && (
                        <div style={{
                          fontSize: '11px',
                          fontFamily: 'monospace',
                          backgroundColor: '#f1f5f9',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          color: '#334155',
                          overflowX: 'auto',
                          whiteSpace: 'pre'
                        }}>
                          {exp.raw_sql}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. Observations 탭 */}
          {activeTab === 'OBSERVATIONS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                축적된 경험 데이터(Experiences)로부터 AI가 귀납적으로 도출한 증거 기반의 믿음과 패턴입니다.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                {observations.map(obs => (
                  <div key={obs.id} style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{obs.belief_title}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '3px' }}>
                          증거 {obs.proof_count}건
                        </span>
                        <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '3px' }}>
                          신뢰도 {Math.round(obs.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                      {obs.belief_statement}
                    </div>
                    {obs.supporting_quotes && obs.supporting_quotes.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                        인용 근거: "{obs.supporting_quotes.join('", "')}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Mental models 탭 */}
          {activeTab === 'MODELS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                실시간 LLM 호출 없이 50ms 미만 초고속 DB 읽기로 제공되는 도메인별 상비 지식 위키 문서입니다.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                {mentalModels.map(mm => (
                  <div key={mm.id} style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{mm.title}</span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Rev {mm.revision}</span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#334155',
                      whiteSpace: 'pre-wrap',
                      backgroundColor: '#f8fafc',
                      padding: '10px',
                      borderRadius: '4px',
                      lineHeight: '1.6'
                    }}>
                      {mm.content_markdown}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
