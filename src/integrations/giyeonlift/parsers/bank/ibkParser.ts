import { BankTransaction } from '../../../../services/db';
import { ParsedBankResult } from '../../../types';
export const parseBankExcelFile = async (file: File, forcedBankName?: string): Promise<ParsedBankResult> => { return { bankName: '기업은행', accountNumber: '111', transactions: [] }; };
