import { TenantPlugin } from '../types';
import { parseBankExcelFile as ibkParser } from './parsers/bank/ibkParser';
import { contractBundleEmail, statementEmail } from './templates/emails';
import { documentBuilder, numberToKoreanAmount } from './templates/htmlTemplates';

export const giyeunPlugin: TenantPlugin = {
  tenantCode: 'GIYEUN',
  parsers: {
    bank: {
      '기업은행': ibkParser,
      // '농협': nhParser, 
      // '국민은행': kbParser
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
