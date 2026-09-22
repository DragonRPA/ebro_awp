import { BankTransaction } from '../services/db';

export interface ParsedBankResult {
  bankName: string;
  accountNumber?: string;
  transactions: BankTransaction[];
  totalRows?: number;
}

export type BankParserFn = (file: File, forcedBankName?: string) => Promise<ParsedBankResult>;
// Future parsers:
// export type SubleaseParserFn = (file: File) => Promise<SubleaseResult>;
// export type TransportParserFn = (file: File) => Promise<TransportResult>;

export interface EmailTemplateContext {
  custName: string;
  tenantCorp: string;
  tenantBrand: string;
  tenantTel: string;
  siteName: string;
  mappedAssetsCount?: number;
  uniqueModelList?: string[];
}

export interface EmailTemplateResult {
  subject: string;
  body: string;
}

export interface TenantPlugin {
  tenantCode: string;
  
  parsers: {
    bank: Record<string, BankParserFn>;
    // transport: Record<string, TransportParserFn>;
    // corporateCard: Record<string, CorporateCardParserFn>;
    // payroll: Record<string, PayrollParserFn>;
    // sublease: Record<string, SubleaseParserFn>;
    // legacyUpload: Record<string, LegacyUploadParserFn>;
  };
  
  templates: {
    emails: {
      contractBundle: (ctx: EmailTemplateContext) => EmailTemplateResult;
      statement: (ctx: EmailTemplateContext) => EmailTemplateResult;
    };
    html: {
      documentBuilder: any; // Returns the HTML builder class/object
      numberToKoreanAmount: (amount: number) => string;
    };
  };
}
