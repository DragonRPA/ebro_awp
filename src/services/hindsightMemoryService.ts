// src/services/hindsightMemoryService.ts
// 🧠 eBro Hindsight 4-Tier Memory & Real-DB Cognitive Core Service
// 🏛️ 무목업 · 무시드 · 100% 실DB(Central + Tenant) 직접 연동 엔진

import { centralSupabase } from './centralDb';
import { db, supabase } from './db';
import { sanitizePrivacyDeep, sanitizeSensitiveString } from '../utils/hindsightPrivacyFilter';
import { createHangulMatcher } from '../utils/hangulSearch';

export type HindsightDomain = 'SALES' | 'LOGISTICS' | 'ASSET' | 'FINANCE' | 'SYSTEM' | 'CHARTER' | 'GENERAL';

// 1. World Fact 인터페이스 (DB 마스터/제원/매뉴얼/기준 사실)
export interface HindsightWorldFact {
  id: string;
  tenant_id: string;
  domain: HindsightDomain;
  fact_key: string;
  fact_title: string;
  fact_content: string;
  source_reference: string;
  is_immutable: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// 2. Experience 인터페이스 (실제 캡처된 사용자 인터랙션 및 CUD SQL)
export interface HindsightExperience {
  id: string;
  tenant_id: string;
  domain: HindsightDomain;
  action_name: string;
  menu_path: string;
  user_id?: string;
  user_name?: string;
  trigger_element?: any;
  interaction_history: Array<any>;
  final_query?: any;
  raw_sql?: string;
  pii_masked: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

// 3. Observation 인터페이스 (실제 DB 원장 및 경험으로부터 귀납 도출된 패턴)
export interface HindsightObservation {
  id: string;
  tenant_id: string;
  domain: HindsightDomain;
  cluster_key: string;
  belief_title: string;
  belief_statement: string;
  proof_count: number;
  confidence: number;
  supporting_quotes: string[];
  first_observed_at: string;
  last_refined_at: string;
}

// 4. Mental Model 인터페이스 (실제 DB 집계로부터 합성된 도메인 지식 모델)
export interface HindsightMentalModel {
  id: string;
  tenant_id: string;
  domain: HindsightDomain;
  model_key: string;
  title: string;
  standing_query: string;
  content_markdown: string;
  structured_data: Record<string, any>;
  revision: number;
  last_synthesized_at: string;
}

export interface HindsightDbDiagnostics {
  lastSyncedAt: string;
  syncLatencyMs: number;
  remoteTables: {
    awp_shared_memories: { exists: boolean; totalCount: number; sqlCapturedCount: number };
    hindsight_world_facts: { exists: boolean; rowCount: number };
    hindsight_observations: { exists: boolean; rowCount: number };
    hindsight_mental_models: { exists: boolean; rowCount: number };
  };
  liveErpCounts: {
    customers: number;
    siteMasters: number;
    contracts: number;
    contractAssets: number;
    products: number;
    assets: number;
    deliveries: number;
    billings: number;
    payments: number;
    repairs: number;
    outboundInspections: number;
    standardOptions: number;
    systemManuals: number;
  };
}

export interface RecallResult {
  query: string;
  extracted_tokens: string[];
  world_facts: HindsightWorldFact[];
  experiences: HindsightExperience[];
  observations: HindsightObservation[];
  mental_models: HindsightMentalModel[];
  execution_time_ms: number;
}

export interface ReflectResponse {
  answer: string;
  extracted_tokens: string[];
  sources: {
    fact_keys: string[];
    observation_clusters: string[];
    mental_model_keys: string[];
    experience_count: number;
    live_db_matches: {
      customers: number;
      sites: number;
      contracts: number;
      products: number;
      assets: number;
      deliveries: number;
      billings: number;
    };
  };
  dry_summary: string;
  action_recommendation?: string;
}

// 자연어 질의에서 불용어(어미/조사/질문 수식어)를 제거하고 핵심 검색 키워드 추출
const QUESTION_STOPWORDS = new Set([
  '얼마로', '들어갔었지', '들어갔지', '얼마', '줬지', '보통', '오늘', '오는데', '해야', '돼', '되나', '될까',
  '지난달', '왜', '발생했지', '발생', '뭐', '무엇', '어떻게', '알려줘', '보여줘', '조회', '검색', '확인',
  '현황', '내역', '목록', '리스트', '데이터', '있어', '있나', '없는', '건수', '몇', '대', '건', '원',
  '에서', '가는', '관련', '대한', '대해', '기준', '현재', '최근', '전체', '모든', '우리', '회사'
]);

const SUFFIX_PARTICLES = /(에서|으로|에게|한테|부터|까지|이나|거나|처럼|만큼|하고|이랑|라도|마저|조차|은|는|이|가|을|를|의|에|로|와|과|도|만|요|지|까|냐)$/u;

export function extractQueryTokens(rawQuery: string): string[] {
  if (!rawQuery || !rawQuery.trim()) return [];
  const cleaned = rawQuery
    .replace(/[?!.,~"'()[\]{}<>:/\\|+=*^%$#@`]/g, ' ')
    .trim();

  const rawParts = cleaned.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];

  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (QUESTION_STOPWORDS.has(lower)) continue;

    // 조사 제거본도 함께 고려 (단, 모델명/영문숫자 조합은 원형 유지)
    const stripped = lower.length >= 3 ? lower.replace(SUFFIX_PARTICLES, '') : lower;
    const candidate = stripped.length >= 1 && !QUESTION_STOPWORDS.has(stripped) ? stripped : lower;

    if (candidate.length >= 1 && ! QUESTION_STOPWORDS.has(candidate) && !tokens.includes(candidate)) {
      tokens.push(candidate);
    }
  }

  return tokens;
}

class HindsightMemoryService {
  private localWorldFacts: HindsightWorldFact[] = [];
  private localObservations: HindsightObservation[] = [];
  private localMentalModels: HindsightMentalModel[] = [];
  private cachedExperiences: HindsightExperience[] = [];
  private hasInitializedRemote = false;

  private diagnostics: HindsightDbDiagnostics = {
    lastSyncedAt: '',
    syncLatencyMs: 0,
    remoteTables: {
      awp_shared_memories: { exists: false, totalCount: 0, sqlCapturedCount: 0 },
      hindsight_world_facts: { exists: false, rowCount: 0 },
      hindsight_observations: { exists: false, rowCount: 0 },
      hindsight_mental_models: { exists: false, rowCount: 0 }
    },
    liveErpCounts: {
      customers: 0,
      siteMasters: 0,
      contracts: 0,
      contractAssets: 0,
      products: 0,
      assets: 0,
      deliveries: 0,
      billings: 0,
      payments: 0,
      repairs: 0,
      outboundInspections: 0,
      standardOptions: 0,
      systemManuals: 0
    }
  };

  constructor() {
    this.purgeLegacySeedCache();
  }

  /**
   * 과거 테스트용으로 브라우저 localStorage에 저장되었던 시드/목업 캐시 영구 삭제
   */
  private purgeLegacySeedCache() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('hs_world_facts_cache');
      localStorage.removeItem('hs_observations_cache');
      localStorage.removeItem('hs_mental_models_cache');
    } catch {}
  }

  private getActiveTenantId(): string {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('erp_current_tenant_id') ||
        (window as any).__APP_CONTEXT__?.currentTenant?.id ||
        'tenant-giyeonlift'
      );
    }
    return 'tenant-giyeonlift';
  }

  /**
   * 실제 DB(Central Supabase + Live Tenant DB)에서 4대 메모리를 실시간 구축/동기화 (목업/시드 0%)
   */
  public async ensureInitialized(forceRefresh = false): Promise<void> {
    if (this.hasInitializedRemote && !forceRefresh) return;

    const startMs = performance.now();
    this.purgeLegacySeedCache();
    const tenantId = this.getActiveTenantId();
    const nowIso = new Date().toISOString();

    // ── 1. 원격 전용 테이블 존재 여부 및 실데이터 조회 (시드 자동 Upsert 일절 없음) ──
    let remoteWf: HindsightWorldFact[] = [];
    let remoteObs: HindsightObservation[] = [];
    let remoteMm: HindsightMentalModel[] = [];

    try {
      const { data, error } = await centralSupabase.from('hindsight_world_facts').select('*').limit(500);
      if (!error && Array.isArray(data)) {
        this.diagnostics.remoteTables.hindsight_world_facts = { exists: true, rowCount: data.length };
        remoteWf = data;
      } else {
        this.diagnostics.remoteTables.hindsight_world_facts = { exists: false, rowCount: 0 };
      }
    } catch {
      this.diagnostics.remoteTables.hindsight_world_facts = { exists: false, rowCount: 0 };
    }

    try {
      const { data, error } = await centralSupabase.from('hindsight_observations').select('*').limit(500);
      if (!error && Array.isArray(data)) {
        this.diagnostics.remoteTables.hindsight_observations = { exists: true, rowCount: data.length };
        remoteObs = data;
      } else {
        this.diagnostics.remoteTables.hindsight_observations = { exists: false, rowCount: 0 };
      }
    } catch {
      this.diagnostics.remoteTables.hindsight_observations = { exists: false, rowCount: 0 };
    }

    try {
      const { data, error } = await centralSupabase.from('hindsight_mental_models').select('*').limit(500);
      if (!error && Array.isArray(data)) {
        this.diagnostics.remoteTables.hindsight_mental_models = { exists: true, rowCount: data.length };
        remoteMm = data;
      } else {
        this.diagnostics.remoteTables.hindsight_mental_models = { exists: false, rowCount: 0 };
      }
    } catch {
      this.diagnostics.remoteTables.hindsight_mental_models = { exists: false, rowCount: 0 };
    }

    // ── 2. Central DB `awp_shared_memories` (실제 수집된 Experiences) 로드 ──
    try {
      const solution = (typeof window !== 'undefined' ? localStorage.getItem('ebro_current_solution') || 'AWP' : 'AWP').toUpperCase();
      const tableName = solution === 'IT' ? 'it_shared_memories' : 'awp_shared_memories';

      const { data, error, count } = await centralSupabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(300);

      if (!error && Array.isArray(data)) {
        const mapped: HindsightExperience[] = data.map(row => ({
          id: row.id,
          tenant_id: row.tenant_id,
          domain: (row.ui_context_bundle?.domain || 'GENERAL') as HindsightDomain,
          action_name: row.action_name || 'UNKNOWN_ACTION',
          menu_path: row.menu_path || 'unknown',
          trigger_element: row.ui_context_bundle?.trigger_element,
          interaction_history: row.ui_context_bundle?.interaction_history || [],
          final_query: row.final_query,
          raw_sql: row.raw_sql,
          pii_masked: Boolean(row.ui_context_bundle?.pii_masked ?? true),
          created_at: row.created_at
        }));
        this.cachedExperiences = mapped;
        const sqlCount = mapped.filter(e => Boolean(e.raw_sql && e.raw_sql.trim())).length;
        this.diagnostics.remoteTables.awp_shared_memories = {
          exists: true,
          totalCount: typeof count === 'number' ? count : mapped.length,
          sqlCapturedCount: sqlCount
        };
      } else {
        this.cachedExperiences = [];
        this.diagnostics.remoteTables.awp_shared_memories = { exists: false, totalCount: 0, sqlCapturedCount: 0 };
      }
    } catch {
      this.cachedExperiences = [];
      this.diagnostics.remoteTables.awp_shared_memories = { exists: false, totalCount: 0, sqlCapturedCount: 0 };
    }

    // ── 3. 실제 운영 DB (LocalDB / Supabase) 원장 데이터 참조 ──
    const customers = (db as any).customers || [];
    const siteMasters = (db as any).siteMasters || [];
    const sites = (db as any).sites || [];
    const contracts = (db as any).contracts || [];
    const contractAssets = (db as any).contractAssets || [];
    const products = (db as any).products || [];
    const assets = (db as any).assets || [];
    const deliveries = (db as any).deliveries || [];
    const billings = (db as any).billings || [];
    const payments = (db as any).payments || [];
    const repairs = (db as any).repairs || [];
    const outboundInspections = (db as any).outboundInspections || [];
    const standardOptions = (db as any).standardOptions || [];
    const systemManuals = (db as any).systemManuals || [];

    this.diagnostics.liveErpCounts = {
      customers: customers.length,
      siteMasters: siteMasters.length,
      contracts: contracts.length,
      contractAssets: contractAssets.length,
      products: products.length,
      assets: assets.length,
      deliveries: deliveries.length,
      billings: billings.length,
      payments: payments.length,
      repairs: repairs.length,
      outboundInspections: outboundInspections.length,
      standardOptions: standardOptions.length,
      systemManuals: systemManuals.length
    };

    // ── 4. World Facts 구축 (원격 테이블 + 실제 DB products, standard_options, system_manuals) ──
    const derivedFacts: HindsightWorldFact[] = [...remoteWf];

    // 4-1. 실제 DB 등록 상품/장비 제원 (products 테이블)
    for (const p of products) {
      if (!p || !p.modelName) continue;
      const specParts = [
        p.manufacturer ? `제조사: ${p.manufacturer}` : '',
        p.feet ? `규격: ${p.feet}ft` : '',
        p.workingHeight ? `작업높이: ${p.workingHeight}` : '',
        p.platformHeight ? `발판높이: ${p.platformHeight}` : '',
        p.weight ? `중량: ${p.weight}` : '',
        p.capacityPreExt ? `적재하중: ${p.capacityPreExt}` : '',
        p.powerSource ? `동력: ${p.powerSource}` : '',
        p.machineDimensions ? `장비치수: ${p.machineDimensions}` : '',
        p.gradeability ? `등판능력: ${p.gradeability}` : '',
        p.maxWindSpeed ? `허용풍속: ${p.maxWindSpeed}` : '',
        p.spec ? `요약제원: ${p.spec}` : ''
      ].filter(Boolean);

      derivedFacts.push({
        id: `wf_db_prod_${p.id}`,
        tenant_id: tenantId,
        domain: 'ASSET',
        fact_key: `DB_PRODUCT_${p.modelName}`,
        fact_title: `[장비제원] ${p.modelName}${p.feet ? ` (${p.feet}ft)` : ''}`,
        fact_content: specParts.length > 0 ? specParts.join(' | ') : '제원 상세 미입력',
        source_reference: `실제 DB products (${p.id})`,
        is_immutable: true,
        created_at: p.createdAt || nowIso,
        updated_at: p.updatedAt || nowIso
      });
    }

    // 4-2. 실제 DB 등록 현장 표준 옵션 (standard_options 테이블)
    for (const opt of standardOptions) {
      if (!opt || !opt.name) continue;
      derivedFacts.push({
        id: `wf_db_opt_${opt.id}`,
        tenant_id: tenantId,
        domain: 'SALES',
        fact_key: `DB_STD_OPTION_${opt.id}`,
        fact_title: `[표준옵션] ${opt.name} (${opt.category || '일반'})`,
        fact_content: `분류: ${opt.category || '-'} | 기준단가: ₩${Number(opt.defaultAmount || 0).toLocaleString()} (${opt.unit || '식'})${opt.description ? ` | 설명: ${opt.description}` : ''}`,
        source_reference: `실제 DB standard_options (${opt.id})`,
        is_immutable: true,
        created_at: opt.createdAt || nowIso,
        updated_at: opt.updatedAt || nowIso
      });
    }

    // 4-3. 실제 DB 등록 시스템 매뉴얼 (system_manuals 테이블)
    for (const man of systemManuals) {
      if (!man || (!man.title && !man.menuId && !man.menu_id)) continue;
      const mId = man.menuId || man.menu_id || man.id;
      const mTitle = man.title || man.menuTitle || mId;
      const mContent = man.purpose || man.overview || man.description || (typeof man.content === 'string' ? man.content.slice(0, 240) : '');
      if (!mContent) continue;
      derivedFacts.push({
        id: `wf_db_man_${man.id || mId}`,
        tenant_id: tenantId,
        domain: 'SYSTEM',
        fact_key: `DB_MANUAL_${mId}`,
        fact_title: `[업무매뉴얼] ${mTitle}`,
        fact_content: String(mContent).slice(0, 300),
        source_reference: `실제 DB system_manuals (${mId})`,
        is_immutable: true,
        created_at: man.updatedAt || man.created_at || nowIso,
        updated_at: man.updatedAt || man.created_at || nowIso
      });
    }

    this.localWorldFacts = derivedFacts;

    // ── 5. Observations 구축 (원격 테이블 + 실제 DB 운영 데이터 및 awp_shared_memories 귀납 추출) ──
    const derivedObs: HindsightObservation[] = [...remoteObs];

    // O(1) 조인 맵 구성
    const customerMap = new Map<string, any>();
    for (const c of customers) customerMap.set(c.id, c);
    const siteMasterMap = new Map<string, any>();
    for (const sm of siteMasters) siteMasterMap.set(sm.id, sm);
    const siteMap = new Map<string, any>();
    for (const s of sites) siteMap.set(s.id, s);
    const assetMap = new Map<string, any>();
    for (const a of assets) assetMap.set(a.id, a);
    const contractMap = new Map<string, any>();
    for (const c of contracts) contractMap.set(c.id, c);

    const resolveSiteName = (siteId?: string): string => {
      if (!siteId) return '현장미지정';
      const cs = siteMap.get(siteId);
      if (cs?.siteMasterId) {
        const sm = siteMasterMap.get(cs.siteMasterId);
        if (sm?.name) return sm.name;
      }
      if (cs?.name) return cs.name;
      const smDirect = siteMasterMap.get(siteId);
      return smDirect?.name || siteId;
    };

    // 5-1. awp_shared_memories 실측 사용자 액션 클러스터링 (상위 빈도 업무 패턴)
    if (this.cachedExperiences.length > 0) {
      const actionClusters = new Map<string, {
        menu: string;
        action: string;
        domain: HindsightDomain;
        count: number;
        sqlCount: number;
        firstAt: string;
        lastAt: string;
        quotes: string[];
      }>();

      for (const exp of this.cachedExperiences) {
        const key = `${exp.menu_path}::${exp.action_name}`;
        const existing = actionClusters.get(key);
        const quote = exp.raw_sql
          ? exp.raw_sql.slice(0, 100)
          : `${exp.menu_path} > ${exp.action_name}`;
        if (!existing) {
          actionClusters.set(key, {
            menu: exp.menu_path,
            action: exp.action_name,
            domain: exp.domain || 'GENERAL',
            count: 1,
            sqlCount: exp.raw_sql ? 1 : 0,
            firstAt: exp.created_at,
            lastAt: exp.created_at,
            quotes: [quote]
          });
        } else {
          existing.count += 1;
          if (exp.raw_sql) existing.sqlCount += 1;
          if (exp.created_at < existing.firstAt) existing.firstAt = exp.created_at;
          if (exp.created_at > existing.lastAt) existing.lastAt = exp.created_at;
          if (existing.quotes.length < 3 && !existing.quotes.includes(quote)) {
            existing.quotes.push(quote);
          }
        }
      }

      const topClusters = Array.from(actionClusters.values())
        .filter(c => c.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      for (const cl of topClusters) {
        const conf = Math.min(0.99, Math.round((0.5 + Math.min(cl.count, 50) / 100) * 100) / 100);
        derivedObs.push({
          id: `obs_exp_${cl.menu}_${cl.action}`.replace(/\s+/g, '_'),
          tenant_id: tenantId,
          domain: cl.domain,
          cluster_key: `REAL_EXP_${cl.menu}_${cl.action}`,
          belief_title: `[실측 행동패턴] ${cl.menu} ➔ '${cl.action}' 반복 수행 (${cl.count}회)`,
          belief_statement: `Central DB(awp_shared_memories) 최근 로그 분석 결과, [${cl.menu}] 메뉴에서 [${cl.action}] 액션이 총 ${cl.count}회 실행되었으며 이 중 실제 DB 변경(SQL 캡처)은 ${cl.sqlCount}회 발생함.`,
          proof_count: cl.count,
          confidence: conf,
          supporting_quotes: cl.quotes,
          first_observed_at: cl.firstAt,
          last_refined_at: cl.lastAt
        });
      }
    }

    // 5-2. 실제 계약자산 기종별 체결 단가 분포 패턴
    if (contractAssets.length > 0) {
      const modelRateStats = new Map<string, {
        count: number;
        feeSum: number;
        feeCount: number;
        minFee: number;
        maxFee: number;
        sampleContracts: string[];
      }>();

      for (const ca of contractAssets) {
        const asset = ca.assetId ? assetMap.get(ca.assetId) : null;
        const model = asset?.modelName || ca.expectedModel || '미지정모델';
        const fee = Number(ca.monthlyRentalFee || 0);
        const stat = modelRateStats.get(model) || {
          count: 0,
          feeSum: 0,
          feeCount: 0,
          minFee: Number.MAX_SAFE_INTEGER,
          maxFee: 0,
          sampleContracts: []
        };
        stat.count += 1;
        if (fee > 0) {
          stat.feeSum += fee;
          stat.feeCount += 1;
          if (fee < stat.minFee) stat.minFee = fee;
          if (fee > stat.maxFee) stat.maxFee = fee;
        }
        if (stat.sampleContracts.length < 3 && ca.contractId) {
          const c = contractMap.get(ca.contractId);
          const cLabel = c?.contractNo || ca.contractId;
          if (!stat.sampleContracts.includes(cLabel)) stat.sampleContracts.push(cLabel);
        }
        modelRateStats.set(model, stat);
      }

      const topModels = Array.from(modelRateStats.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 6);

      for (const [modelName, st] of topModels) {
        const avgFee = st.feeCount > 0 ? Math.round(st.feeSum / st.feeCount) : 0;
        const rangeText = st.feeCount > 0
          ? `평균 월단가 ₩${avgFee.toLocaleString()} (최저 ₩${st.minFee.toLocaleString()} ~ 최고 ₩${st.maxFee.toLocaleString()})`
          : '단가 ₩0 또는 미입력';
        derivedObs.push({
          id: `obs_db_model_rate_${modelName}`,
          tenant_id: tenantId,
          domain: 'SALES',
          cluster_key: `DB_MODEL_RATE_${modelName}`,
          belief_title: `[실측 기종단가] ${modelName} 계약 투입 ${st.count}건 단가 분포`,
          belief_statement: `실제 DB contract_assets(${contractAssets.length}건) 분석 결과, [${modelName}] 기종은 총 ${st.count}건 계약에 투입되었으며 ${rangeText}로 집계됨.`,
          proof_count: st.count,
          confidence: Math.min(0.99, Math.round((0.6 + Math.min(st.count, 100) / 250) * 100) / 100),
          supporting_quotes: st.sampleContracts.map(no => `계약 ${no}`),
          first_observed_at: nowIso,
          last_refined_at: nowIso
        });
      }
    }

    // 5-3. 실제 고객사/현장별 다량 투입 계약 패턴
    if (contracts.length > 0) {
      const caCountByContract = new Map<string, { count: number; feeSum: number; models: Set<string> }>();
      for (const ca of contractAssets) {
        if (!ca.contractId) continue;
        const cur = caCountByContract.get(ca.contractId) || { count: 0, feeSum: 0, models: new Set<string>() };
        cur.count += 1;
        cur.feeSum += Number(ca.monthlyRentalFee || 0);
        const asset = ca.assetId ? assetMap.get(ca.assetId) : null;
        const m = asset?.modelName || ca.expectedModel;
        if (m) cur.models.add(m);
        caCountByContract.set(ca.contractId, cur);
      }

      const siteAgg = new Map<string, {
        siteName: string;
        custNames: Set<string>;
        contractCount: number;
        assetCount: number;
        feeSum: number;
        models: Set<string>;
      }>();

      for (const c of contracts) {
        const sName = resolveSiteName(c.siteId);
        const custName = customerMap.get(c.customerId)?.name || c.customerName || c.customerId;
        const caInfo = caCountByContract.get(c.id) || { count: 0, feeSum: 0, models: new Set<string>() };
        const cur = siteAgg.get(sName) || {
          siteName: sName,
          custNames: new Set<string>(),
          contractCount: 0,
          assetCount: 0,
          feeSum: 0,
          models: new Set<string>()
        };
        if (custName) cur.custNames.add(custName);
        cur.contractCount += 1;
        cur.assetCount += caInfo.count;
        cur.feeSum += caInfo.feeSum;
        caInfo.models.forEach(m => cur.models.add(m));
        siteAgg.set(sName, cur);
      }

      const topSites = Array.from(siteAgg.values())
        .filter(s => s.siteName !== '현장미지정')
        .sort((a, b) => b.assetCount - a.assetCount || b.contractCount - a.contractCount)
        .slice(0, 5);

      for (const s of topSites) {
        const custList = Array.from(s.custNames).slice(0, 3).join(', ');
        const modelList = Array.from(s.models).slice(0, 4).join(', ') || '기종미지정';
        derivedObs.push({
          id: `obs_db_site_${s.siteName}`.replace(/\s+/g, '_'),
          tenant_id: tenantId,
          domain: 'SALES',
          cluster_key: `DB_SITE_TOP_${s.siteName}`,
          belief_title: `[실측 현장투입] ${s.siteName} (계약 ${s.contractCount}건 / 장비 ${s.assetCount}대)`,
          belief_statement: `실제 DB contracts 분석 결과, [${s.siteName}] 현장은 고객사(${custList})와 총 ${s.contractCount}건의 계약, 누적 ${s.assetCount}대 장비(${modelList})가 체결되었으며 월 렌탈료 합계는 ₩${s.feeSum.toLocaleString()}임.`,
          proof_count: s.contractCount,
          confidence: 0.95,
          supporting_quotes: [`고객사: ${custList}`, `투입기종: ${modelList}`],
          first_observed_at: nowIso,
          last_refined_at: nowIso
        });
      }
    }

    // 5-4. 실제 배차 원장 상태 및 운송비 실측 패턴
    if (deliveries.length > 0) {
      let outboundCnt = 0;
      let inboundCnt = 0;
      let exchangeCnt = 0;
      let costRecordedCnt = 0;
      let costSum = 0;
      const driverCounts = new Map<string, number>();

      for (const d of deliveries) {
        if (d.type === 'OUTBOUND') outboundCnt++;
        else if (d.type === 'INBOUND') inboundCnt++;
        else if (d.type === 'EXCHANGE' || d.dispatchCategory === '교환') exchangeCnt++;

        const cost = Number(d.confirmedCost || d.finalCost || d.deliveryCost || 0);
        if (cost > 0) {
          costRecordedCnt++;
          costSum += cost;
        }
        if (d.driverName && String(d.driverName).trim()) {
          const dn = String(d.driverName).trim();
          driverCounts.set(dn, (driverCounts.get(dn) || 0) + 1);
        }
      }

      const avgCost = costRecordedCnt > 0 ? Math.round(costSum / costRecordedCnt) : 0;
      const topDrivers = Array.from(driverCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, cnt]) => `${name}(${cnt}건)`);

      derivedObs.push({
        id: 'obs_db_deliveries_summary',
        tenant_id: tenantId,
        domain: 'LOGISTICS',
        cluster_key: 'DB_DELIVERIES_REAL_STATS',
        belief_title: `[실측 배차통계] 전체 배차 ${deliveries.length}건 유형 및 운송비 기록 현황`,
        belief_statement: `실제 DB deliveries(${deliveries.length}건) 전수 집계: 출고 ${outboundCnt}건, 입고 ${inboundCnt}건, 교환 ${exchangeCnt}건. 운송비가 입력된 배차는 ${costRecordedCnt}건(평균 ₩${avgCost.toLocaleString()})이며, 배정 기사 기록 상위: ${topDrivers.length > 0 ? topDrivers.join(', ') : '운송기사 미입력'}.`,
        proof_count: deliveries.length,
        confidence: 1.0,
        supporting_quotes: [`총 ${deliveries.length}건 중 운송비 기재 ${costRecordedCnt}건`, `기사 배정: ${topDrivers.join(', ') || '없음'}`],
        first_observed_at: nowIso,
        last_refined_at: nowIso
      });
    }

    // 5-5. 실제 청구 및 수납 실측 패턴
    if (billings.length > 0) {
      let totalBilled = 0;
      let totalPaid = 0;
      let unpaidCount = 0;
      let paidCount = 0;

      for (const b of billings) {
        if (b.status === 'REJECTED') continue;
        const amt = Number(b.totalAmount || 0);
        const paid = Number(b.paidAmount || 0);
        totalBilled += amt;
        totalPaid += paid;
        if (b.status === 'PAID' || (amt > 0 && paid >= amt)) paidCount++;
        else unpaidCount++;
      }

      derivedObs.push({
        id: 'obs_db_billings_summary',
        tenant_id: tenantId,
        domain: 'FINANCE',
        cluster_key: 'DB_BILLINGS_REAL_STATS',
        belief_title: `[실측 청구/수납] 청구 ${billings.length}건 수납률 및 미수 잔액 패턴`,
        belief_statement: `실제 DB billings(${billings.length}건) 및 payments(${payments.length}건) 전수 집계: 누적 청구총액 ₩${totalBilled.toLocaleString()}, 누적 수납액 ₩${totalPaid.toLocaleString()}, 미수 잔액 ₩${(totalBilled - totalPaid).toLocaleString()} (완납 ${paidCount}건 / 미수·부분수납 ${unpaidCount}건).`,
        proof_count: billings.length,
        confidence: 1.0,
        supporting_quotes: [`청구총액 ₩${totalBilled.toLocaleString()}`, `미수잔액 ₩${(totalBilled - totalPaid).toLocaleString()}`],
        first_observed_at: nowIso,
        last_refined_at: nowIso
      });
    }

    this.localObservations = derivedObs;

    // ── 6. Mental Models 구축 (원격 테이블 + 실제 DB 5대 도메인 실시간 합성) ──
    const derivedModels: HindsightMentalModel[] = [...remoteMm];

    // 6-1. SALES 멘탈 모델 (실제 DB 고객/현장/계약/단가 종합)
    const activeContractsCnt = contracts.filter((c: any) => c.status === 'ACTIVE' || c.status === 'EXTENDED').length;
    derivedModels.push({
      id: 'mm_real_sales_overview',
      tenant_id: tenantId,
      domain: 'SALES',
      model_key: 'real_db_sales_contract_model',
      title: `[실DB 합성] 영업·계약·현장 원장 모델 (계약 ${contracts.length}건 / 현장 ${siteMasters.length}개)`,
      standing_query: '고객사 현장의 실제 계약 건수, 투입 대수, 기종별 체결 단가 현황',
      content_markdown: [
        `# 실제 DB 영업·계약·현장 집계 (시드/목업 제외)`,
        `- **등록 고객사**: ${customers.length.toLocaleString()}개사`,
        `- **독립 물리 현장**: ${siteMasters.length.toLocaleString()}개 현장 (고객-현장 연결 ${sites.length.toLocaleString()}건)`,
        `- **전체 계약**: ${contracts.length.toLocaleString()}건 (진행중 ACTIVE/EXTENDED: ${activeContractsCnt.toLocaleString()}건)`,
        `- **체결 계약자산**: ${contractAssets.length.toLocaleString()}건`,
        `- **등록 표준옵션**: ${standardOptions.length.toLocaleString()}종`
      ].join('\n'),
      structured_data: {
        customersCount: customers.length,
        siteMastersCount: siteMasters.length,
        contractsCount: contracts.length,
        activeContractsCount: activeContractsCnt,
        contractAssetsCount: contractAssets.length
      },
      revision: 1,
      last_synthesized_at: nowIso
    });

    // 6-2. ASSET 멘탈 모델 (실제 DB 보유자산/상품/정비/검수 종합)
    const assetStatusCounts: Record<string, number> = {};
    for (const a of assets) {
      const st = a.status || 'UNKNOWN';
      assetStatusCounts[st] = (assetStatusCounts[st] || 0) + 1;
    }
    const statusSummaryLine = Object.entries(assetStatusCounts)
      .map(([k, v]) => `${k}: ${v.toLocaleString()}대`)
      .join(' | ');

    derivedModels.push({
      id: 'mm_real_asset_overview',
      tenant_id: tenantId,
      domain: 'ASSET',
      model_key: 'real_db_asset_fleet_model',
      title: `[실DB 합성] 보유자산·상품제원·정비검수 원장 모델 (자산 ${assets.length}대 / 모델 ${products.length}종)`,
      standing_query: '보유 자산 상태별 대수, 등록 상품 제원, 출고검수 및 수리 이력 건수',
      content_markdown: [
        `# 실제 DB 자산·제원·정비 집계 (시드/목업 제외)`,
        `- **총 등록 자산**: ${assets.length.toLocaleString()}대 (${statusSummaryLine || '데이터 없음'})`,
        `- **등록 장비 모델**: ${products.length.toLocaleString()}종`,
        `- **출고 검수 이력**: ${outboundInspections.length.toLocaleString()}건 ${outboundInspections.length === 0 ? '(현재 실제 DB에 적재된 검수 레코드 0건)' : ''}`,
        `- **정비/수리 이력**: ${repairs.length.toLocaleString()}건 ${repairs.length === 0 ? '(현재 실제 DB에 적재된 수리 레코드 0건 — 예지정비 분석을 위해 수리 데이터 축적 필요)' : ''}`
      ].join('\n'),
      structured_data: {
        totalAssets: assets.length,
        statusBreakdown: assetStatusCounts,
        productsCount: products.length,
        outboundInspectionsCount: outboundInspections.length,
        repairsCount: repairs.length
      },
      revision: 1,
      last_synthesized_at: nowIso
    });

    // 6-3. LOGISTICS 멘탈 모델 (실제 DB 배차/운송 종합)
    const delivStatusCounts: Record<string, number> = {};
    for (const d of deliveries) {
      const st = d.status || 'UNKNOWN';
      delivStatusCounts[st] = (delivStatusCounts[st] || 0) + 1;
    }
    const delivStatusLine = Object.entries(delivStatusCounts)
      .map(([k, v]) => `${k}: ${v.toLocaleString()}건`)
      .join(' | ');

    derivedModels.push({
      id: 'mm_real_logistics_overview',
      tenant_id: tenantId,
      domain: 'LOGISTICS',
      model_key: 'real_db_logistics_dispatch_model',
      title: `[실DB 합성] 배차·운송 원장 모델 (배차 ${deliveries.length}건)`,
      standing_query: '배차 상태별 건수, 노선 운송비 기록 여부, 기사 배정 현황',
      content_markdown: [
        `# 실제 DB 배차·운송 집계 (시드/목업 제외)`,
        `- **총 배차 레코드**: ${deliveries.length.toLocaleString()}건 (${delivStatusLine || '데이터 없음'})`,
        `- **실제 운송비 기록 건수**: ${deliveries.filter((d: any) => Number(d.confirmedCost || d.finalCost || d.deliveryCost || 0) > 0).length}건`,
        `- **실제 기사명 기록 건수**: ${deliveries.filter((d: any) => Boolean(d.driverName)).length}건`,
        `- **실제 하차지 주소 기록 건수**: ${deliveries.filter((d: any) => Boolean(d.destinationAddress)).length}건`
      ].join('\n'),
      structured_data: {
        deliveriesCount: deliveries.length,
        statusBreakdown: delivStatusCounts
      },
      revision: 1,
      last_synthesized_at: nowIso
    });

    // 6-4. FINANCE 멘탈 모델 (실제 DB 청구/수납 종합)
    derivedModels.push({
      id: 'mm_real_finance_overview',
      tenant_id: tenantId,
      domain: 'FINANCE',
      model_key: 'real_db_finance_billing_model',
      title: `[실DB 합성] 청구·수납·통장 원장 모델 (청구 ${billings.length}건 / 수납 ${payments.length}건)`,
      standing_query: '월말 청구 건수, 수납 건수, 미수금 현황',
      content_markdown: [
        `# 실제 DB 청구·수납 집계 (시드/목업 제외)`,
        `- **청구 원장**: ${billings.length.toLocaleString()}건`,
        `- **수납 내역**: ${payments.length.toLocaleString()}건`,
        `- **통장 입출금**: ${((db as any).bankTransactions || []).length.toLocaleString()}건`
      ].join('\n'),
      structured_data: {
        billingsCount: billings.length,
        paymentsCount: payments.length
      },
      revision: 1,
      last_synthesized_at: nowIso
    });

    // 6-5. SYSTEM 텔레메트리 멘탈 모델 (Central DB awp_shared_memories 실측 상태)
    const wfTableStatus = this.diagnostics.remoteTables.hindsight_world_facts.exists ? '존재함' : '미생성 (실제 ERP 테이블에서 동적 추출 중)';
    const obsTableStatus = this.diagnostics.remoteTables.hindsight_observations.exists ? '존재함' : '미생성 (실제 ERP + 경험 테이블에서 실시간 귀납 추출 중)';
    const mmTableStatus = this.diagnostics.remoteTables.hindsight_mental_models.exists ? '존재함' : '미생성 (실제 ERP 원장에서 실시간 합성 중)';

    derivedModels.push({
      id: 'mm_real_system_telemetry',
      tenant_id: tenantId,
      domain: 'SYSTEM',
      model_key: 'real_db_hindsight_architecture_status',
      title: `[실DB 진단] Hindsight 4대 메모리 DB 테이블 및 텔레메트리 실측 상태`,
      standing_query: 'Hindsight DB 테이블 생성 여부, awp_shared_memories 수집 건수, 아키텍처 보완점',
      content_markdown: [
        `# Hindsight 데이터베이스 실측 연동 상태`,
        `- **Central DB \`awp_shared_memories\` (Experiences)**: 테이블 존재함 (총 ${this.diagnostics.remoteTables.awp_shared_memories.totalCount}건 적재, 최근 300건 중 SQL 캡처 ${this.diagnostics.remoteTables.awp_shared_memories.sqlCapturedCount}건)`,
        `- **Central DB \`hindsight_world_facts\`**: ${wfTableStatus}`,
        `- **Central DB \`hindsight_observations\`**: ${obsTableStatus}`,
        `- **Central DB \`hindsight_mental_models\`**: ${mmTableStatus}`
      ].join('\n'),
      structured_data: this.diagnostics.remoteTables,
      revision: 1,
      last_synthesized_at: nowIso
    });

    this.localMentalModels = derivedModels;
    this.hasInitializedRemote = true;
    this.diagnostics.lastSyncedAt = nowIso;
    this.diagnostics.syncLatencyMs = Math.round(performance.now() - startMs);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Retain 연산: 새로운 사용자 경험을 Hindsight 메모리에 보존
  // ─────────────────────────────────────────────────────────────────────────
  public async retainExperience(experience: Partial<HindsightExperience>): Promise<boolean> {
    const tenantId = experience.tenant_id || this.getActiveTenantId();
    const payload = {
      tenant_id: tenantId,
      action_name: sanitizeSensitiveString(experience.action_name || 'UNKNOWN_ACTION'),
      menu_path: experience.menu_path || 'unknown',
      raw_sql: experience.raw_sql || null,
      final_query: sanitizePrivacyDeep(experience.final_query || {}),
      ui_context_bundle: {
        domain: experience.domain || 'GENERAL',
        trigger_element: experience.trigger_element,
        interaction_history: experience.interaction_history || [],
        pii_masked: true
      }
    };

    try {
      const solution = (typeof window !== 'undefined' ? localStorage.getItem('ebro_current_solution') || 'AWP' : 'AWP').toUpperCase();
      const tableName = solution === 'IT' ? 'it_shared_memories' : 'awp_shared_memories';
      const { error } = await centralSupabase.from(tableName).insert(payload);
      return !error;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Recall 연산: 실제 DB 기반 4-Way 검색 (빈 쿼리 시 최신 원장 반환, 한글 초성/키워드 매칭)
  // ─────────────────────────────────────────────────────────────────────────
  public async recall(query: string, limit = 10): Promise<RecallResult> {
    const startTime = performance.now();
    await this.ensureInitialized();

    const trimmed = (query || '').trim();
    const tokens = extractQueryTokens(trimmed);
    const matchers = tokens.map(t => createHangulMatcher(t));

    // 빈 쿼리인 경우: 필터링으로 0건을 만드는 버그 없이 최신 실데이터를 limit만큼 그대로 반환
    if (tokens.length === 0) {
      return {
        query: trimmed,
        extracted_tokens: [],
        world_facts: this.localWorldFacts.slice(0, limit),
        experiences: this.cachedExperiences.slice(0, limit),
        observations: this.localObservations.slice(0, limit),
        mental_models: this.localMentalModels.slice(0, limit),
        execution_time_ms: Math.round(performance.now() - startTime)
      };
    }

    const scoreText = (text: string): number => {
      if (!text) return 0;
      let score = 0;
      for (let i = 0; i < matchers.length; i++) {
        if (matchers[i].test(text)) score += 1;
      }
      return score;
    };

    // 1. World Facts 검색 (매칭 점수순 정렬)
    const matchedFacts = this.localWorldFacts
      .map(fact => ({
        fact,
        score: scoreText(`${fact.fact_title} ${fact.fact_content} ${fact.source_reference} ${fact.fact_key}`)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.fact);

    // 2. Observations 검색
    const matchedObservations = this.localObservations
      .map(obs => ({
        obs,
        score: scoreText(`${obs.belief_title} ${obs.belief_statement} ${obs.cluster_key} ${(obs.supporting_quotes || []).join(' ')}`)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.obs.proof_count - a.obs.proof_count)
      .slice(0, limit)
      .map(item => item.obs);

    // 3. Mental Models 검색
    const matchedMentalModels = this.localMentalModels
      .map(mm => ({
        mm,
        score: scoreText(`${mm.title} ${mm.standing_query} ${mm.content_markdown}`)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.mm);

    // 4. Experiences 검색 (Central DB awp_shared_memories 캐시 + 실시간 검색)
    const matchedExperiences = this.cachedExperiences
      .map(exp => ({
        exp,
        score: scoreText(`${exp.action_name} ${exp.menu_path} ${exp.domain} ${exp.raw_sql || ''} ${JSON.stringify(exp.final_query || {})}`)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.exp);

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      query: trimmed,
      extracted_tokens: tokens,
      world_facts: matchedFacts,
      experiences: matchedExperiences,
      observations: matchedObservations,
      mental_models: matchedMentalModels,
      execution_time_ms: executionTimeMs
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Reflect 연산: 하드코딩 분기문 0%, 100% 실제 DB 원장 직접 조회 및 4대 메모리 결합 응답
  // ─────────────────────────────────────────────────────────────────────────
  public async reflect(question: string): Promise<ReflectResponse> {
    const startTime = performance.now();
    await this.ensureInitialized();

    const recallResult = await this.recall(question, 8);
    const tokens = recallResult.extracted_tokens;
    const matchers = tokens.map(t => createHangulMatcher(t));

    const matchesAnyToken = (targets: (string | null | undefined)[]): boolean => {
      if (matchers.length === 0) return false;
      for (const m of matchers) {
        if (m.testAny(targets)) return true;
      }
      return false;
    };

    // ── 실제 운영 DB 원장 직접 검색 ──
    const customers: any[] = (db as any).customers || [];
    const siteMasters: any[] = (db as any).siteMasters || [];
    const sites: any[] = (db as any).sites || [];
    const contracts: any[] = (db as any).contracts || [];
    const contractAssets: any[] = (db as any).contractAssets || [];
    const products: any[] = (db as any).products || [];
    const assets: any[] = (db as any).assets || [];
    const deliveries: any[] = (db as any).deliveries || [];
    const billings: any[] = (db as any).billings || [];

    const customerMap = new Map<string, any>();
    for (const c of customers) customerMap.set(c.id, c);
    const siteMasterMap = new Map<string, any>();
    for (const sm of siteMasters) siteMasterMap.set(sm.id, sm);
    const siteMap = new Map<string, any>();
    for (const s of sites) siteMap.set(s.id, s);
    const assetMap = new Map<string, any>();
    for (const a of assets) assetMap.set(a.id, a);
    const contractAssetsByContractMap = new Map<string, any[]>();
    for (const ca of contractAssets) {
      if (!ca.contractId) continue;
      const list = contractAssetsByContractMap.get(ca.contractId);
      if (list) list.push(ca);
      else contractAssetsByContractMap.set(ca.contractId, [ca]);
    }

    const resolveSiteNameAndAddr = (siteId?: string): { name: string; address: string } => {
      if (!siteId) return { name: '현장미지정', address: '' };
      const cs = siteMap.get(siteId);
      if (cs?.siteMasterId) {
        const sm = siteMasterMap.get(cs.siteMasterId);
        if (sm) return { name: sm.name || cs.name || siteId, address: sm.address || cs.address || '' };
      }
      if (cs) return { name: cs.name || siteId, address: cs.address || '' };
      const smDirect = siteMasterMap.get(siteId);
      if (smDirect) return { name: smDirect.name || siteId, address: smDirect.address || '' };
      return { name: siteId, address: '' };
    };

    // 1) 매칭된 고객사 & 현장 & 계약
    const matchedCustomers = customers.filter(c => matchesAnyToken([c.name, c.businessNumber, c.ceoName]));
    const matchedSites = siteMasters.filter(sm => matchesAnyToken([sm.name, sm.address]));
    const matchedContracts = contracts.filter(c => {
      const custName = customerMap.get(c.customerId)?.name || c.customerName || '';
      const sInfo = resolveSiteNameAndAddr(c.siteId);
      const cas = contractAssetsByContractMap.get(c.id) || [];
      const modelNames = cas.map(ca => assetMap.get(ca.assetId)?.modelName || ca.expectedModel || '').join(' ');
      return matchesAnyToken([c.contractNo, custName, sInfo.name, sInfo.address, modelNames]);
    });

    // 2) 매칭된 장비 모델 & 보유 자산
    const matchedProducts = products.filter(p => matchesAnyToken([p.modelName, p.manufacturer, p.spec, p.feet ? `${p.feet}ft` : '']));
    const matchedAssets = assets.filter(a => matchesAnyToken([a.assetNo, a.modelName, a.manufacturer, a.serialNo, a.status]));

    // 3) 매칭된 배차
    const matchedDeliveries = deliveries.filter(d => {
      const c = d.contractId ? contracts.find((ct: any) => ct.id === d.contractId) : null;
      const custName = d.customerName || (c ? customerMap.get(c.customerId)?.name : '') || '';
      const sInfo = c ? resolveSiteNameAndAddr(c.siteId) : { name: '', address: '' };
      return matchesAnyToken([
        d.id, d.type, d.dispatchCategory, d.destinationAddress, d.originAddress,
        d.driverName, d.vehicleType, d.vehicleNo, d.transportCompany, d.memo,
        custName, sInfo.name, sInfo.address
      ]);
    });

    // 4) 매칭된 청구
    const matchedBillings = billings.filter(b => {
      const custName = customerMap.get(b.customerId)?.name || '';
      return matchesAnyToken([b.id, b.billingYm, b.status, custName, b.customStatementReason]);
    });

    // ── 응답 보고서 조립 (100% 실데이터 기반) ──
    const sections: string[] = [];
    sections.push(`[질의 키워드 분석] 추출 토큰: ${tokens.length > 0 ? tokens.map(t => `'${t}'`).join(', ') : '(없음)'}`);

    // A. 계약 / 현장 / 단가 실DB 조회 결과
    if (matchedContracts.length > 0 || matchedSites.length > 0 || matchedCustomers.length > 0) {
      const lines: string[] = [];
      lines.push(`■ [실DB 영업/계약/현장 매칭 결과] 고객사 ${matchedCustomers.length}개 | 현장 ${matchedSites.length}개 | 계약 ${matchedContracts.length}건`);

      for (const c of matchedContracts.slice(0, 6)) {
        const custName = customerMap.get(c.customerId)?.name || c.customerName || c.customerId;
        const sInfo = resolveSiteNameAndAddr(c.siteId);
        const cas = contractAssetsByContractMap.get(c.id) || [];
        const rateSummaries = cas.slice(0, 4).map(ca => {
          const mName = assetMap.get(ca.assetId)?.modelName || ca.expectedModel || '미지정';
          const mFee = Number(ca.monthlyRentalFee || 0);
          const dFee = Number(ca.dailyRentalFee || 0);
          return `${mName}(월 ₩${mFee.toLocaleString()}${dFee > 0 ? `/일 ₩${dFee.toLocaleString()}` : ''})`;
        });
        lines.push(
          `  • 계약 [${c.contractNo || c.id}] (${c.status}) | 고객: ${custName} | 현장: ${sInfo.name} | 기간: ${c.startDate}~${c.endDate} | 투입장비 ${cas.length}대: ${rateSummaries.join(', ') || '자산미배정'}`
        );
      }

      if (matchedContracts.length === 0 && matchedSites.length > 0) {
        for (const sm of matchedSites.slice(0, 5)) {
          lines.push(`  • 등록 현장 [${sm.name}] (ID: ${sm.id}) | 주소: ${sm.address || '미입력'} | 상태: ${sm.isActive !== false ? '가동중' : '완공/종료'} (연결된 계약 레코드 0건)`);
        }
      }
      sections.push(lines.join('\n'));
    }

    // B. 배차 / 운송 실DB 조회 결과
    if (matchedDeliveries.length > 0) {
      const lines: string[] = [];
      let costSum = 0;
      let costCnt = 0;
      for (const d of matchedDeliveries) {
        const cost = Number(d.confirmedCost || d.finalCost || d.deliveryCost || 0);
        if (cost > 0) {
          costSum += cost;
          costCnt++;
        }
      }
      const avgCost = costCnt > 0 ? Math.round(costSum / costCnt) : 0;
      lines.push(`■ [실DB 배차/운송 매칭 결과] 총 ${matchedDeliveries.length}건 (운송비 기재 ${costCnt}건, 평균 ₩${avgCost.toLocaleString()})`);
      for (const d of matchedDeliveries.slice(0, 6)) {
        const cost = Number(d.confirmedCost || d.finalCost || d.deliveryCost || 0);
        lines.push(
          `  • 배차 [${d.id}] (${d.type}/${d.status}) | 일자: ${d.requestDate || d.loadingDate || '-'} | 기사: ${d.driverName || '미배정'}(${d.vehicleType || '차종미상'}) | 하차지: ${d.destinationAddress || '미입력'} | 운송비: ₩${cost.toLocaleString()}`
        );
      }
      sections.push(lines.join('\n'));
    }

    // C. 장비 제원 / 보유자산 실DB 조회 결과
    if (matchedProducts.length > 0 || matchedAssets.length > 0) {
      const lines: string[] = [];
      lines.push(`■ [실DB 상품제원/보유자산 매칭 결과] 모델 ${matchedProducts.length}종 | 보유자산 ${matchedAssets.length}대`);
      for (const p of matchedProducts.slice(0, 5)) {
        lines.push(
          `  • 모델 [${p.modelName}] (${p.manufacturer || '-'}, ${p.feet || '-'}ft) | 작업높이: ${p.workingHeight || '-'} | 중량: ${p.weight || '-'} | 적재하중: ${p.capacityPreExt || '-'} | 동력: ${p.powerSource || '-'}`
        );
      }
      if (matchedAssets.length > 0) {
        const stMap: Record<string, number> = {};
        for (const a of matchedAssets) stMap[a.status || 'UNKNOWN'] = (stMap[a.status || 'UNKNOWN'] || 0) + 1;
        const stLine = Object.entries(stMap).map(([k, v]) => `${k} ${v}대`).join(', ');
        lines.push(`  • 매칭 자산 상태 분포: ${stLine}`);
      }
      sections.push(lines.join('\n'));
    }

    // D. 청구 / 수납 실DB 조회 결과
    if (matchedBillings.length > 0) {
      const lines: string[] = [];
      let bSum = 0;
      let pSum = 0;
      for (const b of matchedBillings) {
        bSum += Number(b.totalAmount || 0);
        pSum += Number(b.paidAmount || 0);
      }
      lines.push(`■ [실DB 청구/수납 매칭 결과] 총 ${matchedBillings.length}건 | 청구합계 ₩${bSum.toLocaleString()} | 수납합계 ₩${pSum.toLocaleString()} | 차액(미수) ₩${(bSum - pSum).toLocaleString()}`);
      for (const b of matchedBillings.slice(0, 5)) {
        const custName = customerMap.get(b.customerId)?.name || b.customerId;
        const diff = Number(b.totalAmount || 0) - Number(b.paidAmount || 0);
        lines.push(
          `  • 청구 [${b.billingYm}] 고객: ${custName} | 상태: ${b.status} | 청구: ₩${Number(b.totalAmount || 0).toLocaleString()} | 수납: ₩${Number(b.paidAmount || 0).toLocaleString()} | 미수차액: ₩${diff.toLocaleString()}`
        );
      }
      sections.push(lines.join('\n'));
    }

    // E. Hindsight 4대 메모리 매칭 결과
    if (recallResult.observations.length > 0) {
      const obsLines = recallResult.observations.slice(0, 4).map(
        o => `  • ${o.belief_title}: ${o.belief_statement} (증거 ${o.proof_count}건)`
      );
      sections.push(`■ [Hindsight 귀납 관찰 매칭 ${recallResult.observations.length}건]\n${obsLines.join('\n')}`);
    }

    if (recallResult.experiences.length > 0) {
      const expLines = recallResult.experiences.slice(0, 4).map(
        e => `  • [${new Date(e.created_at).toLocaleString('ko-KR')}] ${e.menu_path} ➔ ${e.action_name}${e.raw_sql ? ` | SQL: ${e.raw_sql.slice(0, 90)}...` : ''}`
      );
      sections.push(`■ [Hindsight 사용자 경험 매칭 ${recallResult.experiences.length}건]\n${expLines.join('\n')}`);
    }

    const totalLiveMatches =
      matchedCustomers.length +
      matchedSites.length +
      matchedContracts.length +
      matchedProducts.length +
      matchedAssets.length +
      matchedDeliveries.length +
      matchedBillings.length;

    const totalMemoryMatches =
      recallResult.world_facts.length +
      recallResult.observations.length +
      recallResult.mental_models.length +
      recallResult.experiences.length;

    if (totalLiveMatches === 0 && totalMemoryMatches === 0) {
      sections.push(
        `■ [실DB 조회 결과: 일치하는 레코드 없음 (0건)]\n` +
        `  • 입력하신 질의 키워드(${tokens.map(t => `'${t}'`).join(', ')})와 일치하는 레코드가 현재 실제 DB(계약 ${contracts.length}건, 현장 ${siteMasters.length}개, 배차 ${deliveries.length}건, 청구 ${billings.length}건, 상품 ${products.length}종, 경험로그 ${this.cachedExperiences.length}건)에 존재하지 않습니다.`
      );
    }

    const elapsedMs = Math.round(performance.now() - startTime);

    return {
      answer: sections.join('\n\n'),
      extracted_tokens: tokens,
      sources: {
        fact_keys: recallResult.world_facts.map(f => f.fact_title),
        observation_clusters: recallResult.observations.map(o => o.belief_title),
        mental_model_keys: recallResult.mental_models.map(m => m.title),
        experience_count: recallResult.experiences.length,
        live_db_matches: {
          customers: matchedCustomers.length,
          sites: matchedSites.length,
          contracts: matchedContracts.length,
          products: matchedProducts.length,
          assets: matchedAssets.length,
          deliveries: matchedDeliveries.length,
          billings: matchedBillings.length
        }
      },
      dry_summary: `실DB 조회 완료 (${elapsedMs}ms | 실DB 매칭 ${totalLiveMatches}건 | 사실 ${recallResult.world_facts.length}건 | 관찰 ${recallResult.observations.length}건 | 경험 ${recallResult.experiences.length}건)`
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. 4대 메모리 및 실DB 진단 상태 반환
  // ─────────────────────────────────────────────────────────────────────────
  public getWorldFacts(): HindsightWorldFact[] {
    return this.localWorldFacts;
  }

  public getObservations(): HindsightObservation[] {
    return this.localObservations;
  }

  public getMentalModels(): HindsightMentalModel[] {
    return this.localMentalModels;
  }

  public getRecentExperiences(limit = 50): HindsightExperience[] {
    return this.cachedExperiences.slice(0, limit);
  }

  public getDiagnostics(): HindsightDbDiagnostics {
    return this.diagnostics;
  }
}

export const hindsightMemory = new HindsightMemoryService();
