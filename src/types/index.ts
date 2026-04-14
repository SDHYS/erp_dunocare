export type ProgressStatus = '접수' | '배정중' | '진행중' | '진행완료' | '일정연기' | '취소';
export type Satisfaction = '매우만족' | '만족' | '보통' | '불만' | '미응답';
export type PaymentStatus = '결제중' | '결제완료' | '취소' | '미결제';
export type SettlementStatus = '정산대기' | '정산중' | '정산완료';
export type InvoiceStatus = '미발행' | '발행중' | '발행완료';

export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  storeName: string;
  request: string;
  maintenanceTime: string;
  cost: number;
  progressStatus: ProgressStatus;
  assignee: string;
  satisfaction: Satisfaction;
  payment: PaymentStatus;
  settlementAmount: number;
  deductionRate: string;
  settlementStatus: SettlementStatus;
  ownerInvoice: InvoiceStatus;
  partnerSettlement: InvoiceStatus;
  fieldManager: string;
  notes: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  contact: string;
  businessNumber: string;
  email: string;
  memo: string;
  loginId: string;
  hasPassword: boolean;
}

export interface AuthUser {
  role: 'admin' | 'team';
  name: string;
  teamId?: string;
}
