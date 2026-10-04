import { TenantPlugin } from '../types';
import { parseUniversalBankExcel } from '../../services/universalBankParser';
import { contractBundleEmail, statementEmail } from './templates/emails';
import { documentBuilder, numberToKoreanAmount } from './templates/htmlTemplates';

export const giyeonliftPlugin: TenantPlugin = {
  tenantCode: 'GIYEONLIFT',
  parsers: {
    bank: {
      'default': parseUniversalBankExcel,
      '기업은행': parseUniversalBankExcel,
      '우리은행': parseUniversalBankExcel,
      '신한은행': parseUniversalBankExcel,
      '국민은행': parseUniversalBankExcel,
      '농협은행': parseUniversalBankExcel,
      '하나은행': parseUniversalBankExcel
    }
  },
  templates: {
    emails: {
      contractBundle: contractBundleEmail,
      statement: statementEmail
    },
    html: {
      documentBuilder,
      numberToKoreanAmount
    }
  }
};

// 하위 호환성 별칭
export const giyeunPlugin = giyeonliftPlugin;
