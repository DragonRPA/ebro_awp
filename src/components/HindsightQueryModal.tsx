// src/components/HindsightQueryModal.tsx
// 🧠 Hindsight 4-Tier Memory & Real-DB Diagnostic Console
// 🏛️ 전사 시스템 개발 표준 헌장 3.1(무수식어 건조 표준) & 3.2(nowrap) 준수 (무목업·무시드 100% 실DB 연동)

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Search, Sparkles, Database, Brain, Globe, ShieldCheck, 
  Layers, RefreshCw, Send
} from 'lucide-react';
import { 
  hindsightMemory, 
  HindsightWorldFact, 
  HindsightExperience, 
  HindsightObservation, 
  HindsightMentalModel,
  HindsightDbDiagnostics,
  ReflectResponse,
  RecallResult
} from '../services/hindsightMemoryService';
import { db } from '../services/db';
import { createHangulMatcher } from '../utils/hangulSearch';

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

  // 4대 메모리 실DB 원장 데이터
  const [worldFacts, setWorldFacts] = useState<HindsightWorldFact[]>([]);
  const [observations, setObservations] = useState<HindsightObservation[]>([]);
  const [mentalModels, setMentalModels] = useState<HindsightMentalModel[]>([]);
  const [recentExperiences, setRecentExperiences] = useState<HindsightExperience[]>([]);
  const [diagnostics, setDiagnostics] = useState<HindsightDbDiagnostics | null>(null);
  const [expLoading, setExpLoading] = useState(false);

  // 탭 내부 필터 상태
  const [factFilterKeyword, setFactFilterKeyword] = useState('');
  const [factDomainFilter, setFactDomainFilter] = useState<string>('ALL');
  const [expSqlOnly, setExpSqlOnly] = useState(false);
  const [expFilterKeyword, setExpFilterKeyword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadMemoryData(true);
    }
  }, [isOpen]);

  const loadMemoryData = async (forceRefresh = false) => {
    setExpLoading(true);
    try {
      await hindsightMemory.ensureInitialized(forceRefresh);
      setWorldFacts(hindsightMemory.getWorldFacts());
      setObservations(hindsightMemory.getObservations());
      setMentalModels(hindsightMemory.getMentalModels());
      setRecentExperiences(hindsightMemory.getRecentExperiences(100));
      setDiagnostics({ ...hindsightMemory.getDiagnostics() });
    } catch (err) {
      console.warn('[Hindsight] Failed to load real DB memory data:', err);
    } finally {
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

  // 실제 DB에 존재하는 샘플 엔티티 기반 동적 추천 질의 생성 (하드코딩 목업 배제)
  const dynamicPrompts = useMemo(() => {
    const prompts: string[] = [];
    const customers: any[] = (db as any).customers || [];
    const siteMasters: any[] = (db as any).siteMasters || [];
    const products: any[] = (db as any).products || [];
    const contracts: any[] = (db as any).contracts || [];

    // 1. 실제 계약이 있는 첫 번째 고객사
    if (contracts.length > 0 && customers.length > 0) {
      const firstContract = contracts[0];
      const cust = customers.find(c => c.id === firstContract.customerId);
      if (cust?.name) {
        prompts.push(`${cust.name} 계약 단가 내역`);
      }
    } else if (customers.length > 0 && customers[0]?.name) {
      prompts.push(`${customers[0].name} 계약 현황`);
    }

    // 2. 실제 등록된 첫 번째 물리 현장
    if (siteMasters.length > 0 && siteMasters[0]?.name) {
      prompts.push(`${siteMasters[0].name} 현장 계약 현황`);
    }

    // 3. 실제 등록된 첫 번째 장비 모델
    if (products.length > 0 && products[0]?.modelName) {
      prompts.push(`${products[0].modelName} 제원 및 보유자산`);
    }

    // 4. 실제 배차 및 청구/결재 로그 검색
    prompts.push('출고 배차 운송 내역');
    prompts.push('결재 승인 경험 로그');

    return prompts;
  }, [diagnostics]);

  const filteredFacts = useMemo(() => {
    const kw = factFilterKeyword.trim();
    const matcher = kw ? createHangulMatcher(kw) : null;
    return worldFacts.filter(wf => {
      if (factDomainFilter !== 'ALL' && wf.domain !== factDomainFilter) return false;
      if (matcher && !matcher.testAny([wf.fact_title, wf.fact_content, wf.source_reference])) return false;
      return true;
    });
  }, [worldFacts, factFilterKeyword, factDomainFilter]);

  const filteredExperiences = useMemo(() => {
    const kw = expFilterKeyword.trim();
    const matcher = kw ? createHangulMatcher(kw) : null;
    return recentExperiences.filter(exp => {
      if (expSqlOnly && (!exp.raw_sql || !exp.raw_sql.trim())) return false;
      if (matcher && !matcher.testAny([exp.action_name, exp.menu_path, exp.domain, exp.raw_sql])) return false;
      return true;
    });
  }, [recentExperiences, expSqlOnly, expFilterKeyword]);

  if (!isOpen) return null;

  return (
    <div
      data-hs-console="true"
      style={{
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
      }}
    >
      <div style={{
        width: '1040px',
        maxWidth: '96vw',
        height: '88vh',
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
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          backgroundColor: 'var(--bg-secondary, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Brain size={20} style={{ color: '#2563eb' }} />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', whiteSpace: 'nowrap' }}>
              전사 업무 지식 콘솔
            </h2>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#dcfce7',
              color: '#166534',
              fontWeight: '700',
              whiteSpace: 'nowrap'
            }}>
              무목업 · 100% 실DB 직결 모드
            </span>
            {diagnostics && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}>
                실DB 동기화 {diagnostics.syncLatencyMs}ms
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => loadMemoryData(true)}
              disabled={expLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                color: '#1e293b',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <RefreshCw size={13} className={expLoading ? 'animate-spin' : ''} />
              <span>실DB 재동기화</span>
            </button>
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
        </div>

        {/* 실DB 연동 진단 요약 바 */}
        {diagnostics && (
          <div style={{
            padding: '8px 20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            fontSize: '11px',
            color: '#334155'
          }}>
            <span style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
              [Central DB 테이블]
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>
              awp_shared_memories: <strong style={{ color: '#16a34a' }}>{diagnostics.remoteTables.awp_shared_memories.totalCount.toLocaleString()}건</strong> (최근 300건 중 SQL캡처 {diagnostics.remoteTables.awp_shared_memories.sqlCapturedCount}건)
            </span>
            <span style={{ whiteSpace: 'nowrap', color: diagnostics.remoteTables.hindsight_world_facts.exists ? '#16a34a' : '#b45309' }}>
              hindsight_world_facts: {diagnostics.remoteTables.hindsight_world_facts.exists ? `${diagnostics.remoteTables.hindsight_world_facts.rowCount}건` : '테이블 미생성(ERP 마스터 동적추출)'}
            </span>
            <span style={{ whiteSpace: 'nowrap', color: diagnostics.remoteTables.hindsight_observations.exists ? '#16a34a' : '#b45309' }}>
              hindsight_observations: {diagnostics.remoteTables.hindsight_observations.exists ? `${diagnostics.remoteTables.hindsight_observations.rowCount}건` : '테이블 미생성(실DB 귀납추출)'}
            </span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
              [Tenant 실DB 원장]
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>
              고객 {diagnostics.liveErpCounts.customers} · 현장 {diagnostics.liveErpCounts.siteMasters} · 계약 {diagnostics.liveErpCounts.contracts} · 계약자산 {diagnostics.liveErpCounts.contractAssets} · 보유자산 {diagnostics.liveErpCounts.assets} · 모델 {diagnostics.liveErpCounts.products} · 배차 {diagnostics.liveErpCounts.deliveries} · 청구 {diagnostics.liveErpCounts.billings} · 수리 {diagnostics.liveErpCounts.repairs} · 검수 {diagnostics.liveErpCounts.outboundInspections}
            </span>
          </div>
        )}

        {/* 탭 네비게이션 */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          backgroundColor: 'var(--bg-primary, #ffffff)',
          padding: '0 16px',
          overflowX: 'auto'
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
                  placeholder="실제 DB의 고객사명, 현장명, 장비모델명, 배차/청구/결재 키워드로 질의하십시오"
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
                    opacity: loading || !query.trim() ? 0.6 : 1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>질문</span>
                </button>
              </div>

              {/* 실DB 기반 동적 추천 질의 칩스 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center', fontWeight: '600', whiteSpace: 'nowrap' }}>
                  실DB 샘플 질의:
                </span>
                {dynamicPrompts.map((p, idx) => (
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={16} style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Hindsight 4대 메모리 종합 답변</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{reflectResult.dry_summary}</span>
                  </div>

                  <div style={{
                    fontSize: '13px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    color: '#1e293b',
                    backgroundColor: '#f8fafc',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    fontFamily: 'inherit'
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
                    {reflectResult.sources.fact_keys.slice(0, 6).map((fk, i) => (
                      <span key={i} style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '3px' }}>
                        🌐 {fk}
                      </span>
                    ))}
                    {reflectResult.sources.observation_clusters.slice(0, 6).map((ob, i) => (
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

              {/* Recall 4대 메모리 개별 검색 결과 상세 */}
              {recallResult && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px'
                }}>
                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                      매칭 World Facts ({recallResult.world_facts.length}건)
                    </div>
                    {recallResult.world_facts.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>매칭 없음</div>
                    ) : (
                      recallResult.world_facts.slice(0, 4).map(wf => (
                        <div key={wf.id} style={{ fontSize: '11px', color: '#334155', marginBottom: '4px' }}>
                          • <strong>{wf.fact_title}</strong>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                      매칭 Observations ({recallResult.observations.length}건)
                    </div>
                    {recallResult.observations.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>매칭 없음</div>
                    ) : (
                      recallResult.observations.slice(0, 4).map(obs => (
                        <div key={obs.id} style={{ fontSize: '11px', color: '#334155', marginBottom: '4px' }}>
                          • <strong>{obs.belief_title}</strong> ({obs.proof_count}건)
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                      매칭 Experiences ({recallResult.experiences.length}건)
                    </div>
                    {recallResult.experiences.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>매칭 없음</div>
                    ) : (
                      recallResult.experiences.slice(0, 4).map(exp => (
                        <div key={exp.id} style={{ fontSize: '11px', color: '#334155', marginBottom: '4px' }}>
                          • [{exp.menu_path}] <strong>{exp.action_name}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. World facts 탭 */}
          {activeTab === 'FACTS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  실제 DB의 장비 모델 제원(`products`), 표준 옵션(`standard_options`), 시스템 매뉴얼(`system_manuals`)에서 로드된 기준 사실 목록입니다. (총 {filteredFacts.length}건)
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    value={factDomainFilter}
                    onChange={(e) => setFactDomainFilter(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                  >
                    <option value="ALL">전체 도메인 ({worldFacts.length})</option>
                    <option value="ASSET">장비제원</option>
                    <option value="SALES">표준옵션</option>
                    <option value="SYSTEM">업무매뉴얼</option>
                  </select>
                  <input
                    type="text"
                    value={factFilterKeyword}
                    onChange={(e) => setFactFilterKeyword(e.target.value)}
                    placeholder="제원/옵션/매뉴얼 검색..."
                    style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '180px' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                {filteredFacts.slice(0, 100).map(wf => (
                  <div key={wf.id} style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{wf.fact_title}</span>
                      <span style={{ fontSize: '11px', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Central DB(`awp_shared_memories`)에 실제 적재된 사용자 업무 인터랙션 및 CUD SQL 로그입니다. (표시 {filteredExperiences.length}건 / 전체 {diagnostics?.remoteTables.awp_shared_memories.totalCount || recentExperiences.length}건)
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={expSqlOnly}
                      onChange={(e) => setExpSqlOnly(e.target.checked)}
                    />
                    <span>SQL 캡처 포함 건만</span>
                  </label>
                  <input
                    type="text"
                    value={expFilterKeyword}
                    onChange={(e) => setExpFilterKeyword(e.target.value)}
                    placeholder="메뉴/액션/SQL 검색..."
                    style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '160px' }}
                  />
                </div>
              </div>

              {expLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>실DB 경험 데이터 로딩 중...</div>
              ) : filteredExperiences.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '6px' }}>
                  조건에 일치하는 경험 데이터가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredExperiences.map((exp, idx) => (
                    <div key={exp.id || idx} style={{
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
                      <div style={{ fontSize: '11px', color: '#475569', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span>📍 메뉴: {exp.menu_path}</span>
                        {exp.domain && <span>🏷️ 도메인: {exp.domain}</span>}
                        <span>👣 선행조작: {(exp.interaction_history || []).length}건</span>
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
                실제 DB(`awp_shared_memories`, `contracts`, `contract_assets`, `deliveries`, `billings`) 원장을 실시간 클러스터링하여 귀납 추출한 통계 및 패턴입니다.
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{obs.belief_title}</span>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                          실DB 표본 {obs.proof_count}건
                        </span>
                        <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                          신뢰도 {Math.round(obs.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                      {obs.belief_statement}
                    </div>
                    {obs.supporting_quotes && obs.supporting_quotes.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                        실DB 근거: "{obs.supporting_quotes.join('", "')}"
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
                실제 운영 DB 원장 건수 및 상태 분포로부터 실시간 합성된 도메인별 요약 멘탈 모델입니다.
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
