export type TargetEntity = 'CUSTOMER' | 'ASSET' | 'CONTRACT';

export interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum';
  enumValues?: string[];
  aliases: string[]; 
  defaultValue?: any;
}

export const MIGRATION_SCHEMAS: Record<TargetEntity, FieldDefinition[]> = {
  CUSTOMER: [
    { key: 'name', label: '거래처명', required: true, type: 'string', aliases: ['고객사명', '업체명', '상호명', '거래처', '상호'] },
    { key: 'bizRegNo', label: '사업자번호', required: false, type: 'string', aliases: ['사업자등록번호', '등록번호', '사업자번호'] },
    { key: 'representative', label: '대표자명', required: false, type: 'string', aliases: ['대표자', '대표명', '대표'] },
    { key: 'address', label: '주소', required: false, type: 'string', aliases: ['사업장주소', '본사주소', '소재지'] },
    { key: 'repContact', label: '대표연락처', required: false, type: 'string', aliases: ['연락처', '전화번호', '대표전화', '연락처1'] },
  ],
  ASSET: [
    { key: 'assetNo', label: '관리번호(호기)', required: true, type: 'string', aliases: ['장비번호', '자산번호', '호기', '차량번호', '기기번호'] },
    { key: 'modelName', label: '모델명', required: true, type: 'string', aliases: ['장비명', '모델', '기종', '차종'] },
    { key: 'serialNo', label: '제조번호(S/N)', required: false, type: 'string', aliases: ['시리얼', 'S/N', '차대번호', '제조번호'] },
    { key: 'ownerType', label: '소유형태', required: true, type: 'enum', enumValues: ['OWNED', 'RENTED'], aliases: ['소유구분', '자산구분', '자사/전대'], defaultValue: 'OWNED' },
    { key: 'status', label: '현재상태', required: true, type: 'enum', enumValues: ['AVAILABLE', 'RENTED', 'REPAIRING', 'SOLD', 'DISPOSED'], aliases: ['상태', '장비상태'], defaultValue: 'AVAILABLE' },
    { key: 'manufactureYear', label: '제조년도', required: false, type: 'string', aliases: ['연식', '제조년월', '연도'] },
  ],
  CONTRACT: [
    { key: 'contractNo', label: '계약번호', required: true, type: 'string', aliases: ['계약서번호', '문서번호'] },
    { key: 'customerName', label: '거래처명(매핑용)', required: true, type: 'string', aliases: ['거래처', '고객사', '업체명'] },
    { key: 'siteName', label: '현장명', required: false, type: 'string', aliases: ['현장', '작업장', '납품처'] },
    { key: 'startDate', label: '시작일', required: true, type: 'date', aliases: ['대여일', '출고일', '개시일'] },
    { key: 'endDate', label: '종료일', required: true, type: 'date', aliases: ['반납일', '만료일', '예정일'] },
    { key: 'billingDay', label: '청구일(숫자)', required: false, type: 'number', aliases: ['결제일', '수금일', '청구일자'], defaultValue: 31 },
  ]
};

export interface GapAnalysisReport {
  rowIndex: number;
  originalData: any;
  mappedData: any;
  errors: string[];
  warnings: string[];
}

export function autoMapHeaders(headers: string[], entity: TargetEntity): Record<string, string> {
  const schema = MIGRATION_SCHEMAS[entity];
  const mapping: Record<string, string> = {};

  headers.forEach(header => {
    const normalized = header.replace(/\s+/g, '').toLowerCase();
    const matchedField = schema.find(f => 
      f.key.toLowerCase() === normalized || 
      f.label.replace(/\s+/g, '').toLowerCase() === normalized ||
      f.aliases.some(a => a.replace(/\s+/g, '').toLowerCase() === normalized) ||
      normalized.includes(f.label.replace(/\s+/g, '').toLowerCase())
    );
    if (matchedField) mapping[header] = matchedField.key;
  });
  return mapping;
}

export function generateTemplateAoA(entity: TargetEntity): any[][] {
  const schema = MIGRATION_SCHEMAS[entity];
  const headers = schema.map(f => `${f.label}${f.required ? ' (필수)' : ''}`);
  const helpTexts = schema.map(f => {
    let help = f.type;
    if (f.enumValues) help += ` [${f.enumValues.join(', ')}]`;
    if (f.defaultValue) help += ` (기본값: ${f.defaultValue})`;
    return help;
  });
  return [headers, helpTexts];
}

export function analyzeGaps(rawData: any[], mapping: Record<string, string>, fixedValues: Record<string, any>, entity: TargetEntity): GapAnalysisReport[] {
  const schema = MIGRATION_SCHEMAS[entity];
  const reports: GapAnalysisReport[] = [];

  rawData.forEach((row, index) => {
    const mapped: any = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    // Map data from Excel
    Object.keys(row).forEach(header => {
      const key = mapping[header];
      if (key) mapped[key] = row[header];
    });

    // Apply fixed values explicitly provided by user (overrides empty or mapped values)
    Object.keys(fixedValues).forEach(key => {
      if (fixedValues[key] !== undefined && fixedValues[key] !== '') {
        mapped[key] = fixedValues[key];
        warnings.push(`[${schema.find(s=>s.key===key)?.label || key}] 일괄 고정값 할당됨`);
      }
    });

    // Validation
    schema.forEach(field => {
      let val = mapped[field.key];

      if (val === undefined || val === null || String(val).trim() === '') {
        if (field.defaultValue !== undefined) {
          val = field.defaultValue;
          mapped[field.key] = val;
          warnings.push(`[${field.label}] 누락되어 시스템 기본값(${val}) 적용됨`);
        } else if (field.required) {
          errors.push(`[${field.label}] 필수 항목 누락`);
        }
      } else {
        if (field.type === 'number') {
          const sVal = String(val).trim();
          if (sVal.includes('말일') || sVal.includes('말')) {
            mapped[field.key] = 31;
          } else {
            const num = Number(val);
            if (isNaN(num)) errors.push(`[${field.label}] 숫자 형식 오류: ${val}`);
            else mapped[field.key] = num;
          }
        } else if (field.type === 'date') {
          // Normalize excel numeric dates or string dates
          let dt: Date;
          if (typeof val === 'number') {
             // Excel serial date to JS date
             dt = new Date(Math.round((val - 25569) * 86400 * 1000));
          } else {
             dt = new Date(String(val).replace(/\./g, '-').replace(/\//g, '-'));
          }
          
          if (isNaN(dt.getTime())) errors.push(`[${field.label}] 날짜 형식 오류: ${val}`);
          else mapped[field.key] = dt.toISOString().split('T')[0];
        } else if (field.type === 'enum' && field.enumValues) {
           const sVal = String(val).trim();
           if (field.key === 'ownerType') {
             if (sVal.includes('자사') || sVal.includes('OWN')) mapped[field.key] = 'OWNED';
             else if (sVal.includes('전대') || sVal.includes('임차') || sVal.includes('타사')) mapped[field.key] = 'RENTED';
             else if (!field.enumValues.includes(sVal)) errors.push(`[${field.label}] 알 수 없는 열거형 값: ${val}`);
           } else if (field.key === 'status') {
             if (sVal.includes('대여') || sVal.includes('출고')) mapped[field.key] = 'RENTED';
             else if (sVal.includes('대기') || sVal.includes('가용')) mapped[field.key] = 'AVAILABLE';
             else if (sVal.includes('수리') || sVal.includes('정비')) mapped[field.key] = 'REPAIRING';
             else if (sVal.includes('매각')) mapped[field.key] = 'SOLD';
             else if (sVal.includes('폐기')) mapped[field.key] = 'DISPOSED';
             else if (!field.enumValues.includes(sVal)) errors.push(`[${field.label}] 알 수 없는 열거형 값: ${val}`);
           }
        }
      }
    });

    reports.push({
      rowIndex: index + 1,
      originalData: row,
      mappedData: mapped,
      errors,
      warnings
    });
  });

  return reports;
}
