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
  password: string;
}

export interface AuthUser {
  role: 'admin' | 'team';
  name: string;
  teamId?: string;
}

export const REQUEST_TYPES = [
  '카이저제빙기청소', '4WAY에어컨청소', '매장마감청소', '어닝+간판청소',
  '커피머신수리', '글라인더수리', '온수기수리', '매장대청소',
  '테라장설치', '배관청소', '제빙기설치', '에어컨설치',
  '커피머신설치', '아이스크림기계설치', '호시자키제빙기청소',
  '아이스트로제빙기청소', '1WAY에어컨청소', '360에어컨청소',
  '매장페인트', '인테리어보수', '어닝청소', '간판청소',
  '유리창청소', '간판수리', '전기설비',
  '오버홀', '디스케일', '동안세무회계가입',
] as const;

export const TEAMS = [
  '수원에어컨팀', '제빙기전문팀', '서울일등설비',
  'BNI김훈님', '24시짱구', '커피브로',
  '청준만사성', '청년강원빈대표님', '용인배관팀',
  '안양배관팀', '부산팀',
] as const;

