export type ProgressStatus = '접수' | '배정중' | '진행중' | '진행완료' | '일정연기' | '취소';
export type Satisfaction = '매우만족' | '만족' | '보통' | '불만' | '미응답';
export type PaymentStatus = '결제중' | '결제완료' | '취소' | '미결제';
export type SettlementStatus = '정산대기' | '정산완료';
export type InvoiceStatus = '미발행' | '발행완료';

export type SettlementType = 'simple' | 'max_care' | 'custom';
export type BusinessType = 'business' | 'freelancer';

export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  storeName: string;
  request: string;
  maintenanceTime: string;
  cost: number;
  personalPartsCost: number;  // 개인부품비 (수수료 계산 제외)
  prepaidAmount: number;      // 선지급 — 미리 지급한 금액 (정산금에서 차감)
  paidAt: string;             // 송금일 YYYY-MM-DD ('' = 미송금)
  progressStatus: ProgressStatus;
  assignee: string;
  workResult: string;         // 작업 결과 (완료 후 실작업 내역)
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

// 팀(기사/프리랜서 업체) — 서비스 실제공자
export interface Team {
  id: string;
  name: string;
  businessType: BusinessType;   // 사업자 / 프리랜서
  ownerName: string;            // 대표자명
  address: string;
  contact: string;
  businessNumber: string;
  email: string;
  account: string;              // 계좌 (정산 송금용)
  memo: string;
  loginId: string;
  hasPassword: boolean;
  // 정산 규칙
  settlementType: SettlementType;
  vatRate: number;        // 부가세율 %
  agencyFeeRate: number;  // 대행사 수수료율 % (맥스케어 등)
  dunoFeeRate: number;    // 두노케어 수수료율 %
  taxRate: number;        // 소득세율 %
}

// 자유 입력 항목 (추가 장비 / 추가 정비 항목)
export interface ExtraItem {
  name: string;    // 항목명 (예: "와플기계")
  detail: string;  // 세부 (모델명/상태 등)
}

// 매장(고객/점주) — 서비스 수요자
export interface Store {
  id: string;
  name: string;              // 매장명
  ownerName: string;         // 명의자
  address: string;
  contact: string;
  email: string;
  // 기본 장비 (자주 쓰는 10개 고정)
  coffeeMachine: string;     // 커피머신
  grinder: string;           // 글라인더
  iceMaker: string;          // 제빙기
  dispenser: string;         // 디스펜서
  waterHeater: string;       // 온수기
  refrigerator: string;      // 냉장고
  oven: string;              // 오븐
  iceCreamMachine: string;   // 아이스크림기계
  waterFilter: string;       // 정수기/전처리필터
  etc: string;               // 기타 (단일 텍스트)
  // 확장: 기본 항목 외 자유 추가
  extraEquipments: ExtraItem[];
  memo: string;              // 비고
  loginId: string;
  hasPassword: boolean;
}

// 매장 정비 이력 (점검/수리 기록)
export interface MaintenanceLog {
  id: string;
  storeId: string;
  date: string;            // YYYY-MM-DD
  coffeeMachine: string;
  grinder: string;
  iceMaker: string;
  dispenser: string;
  plumbing: string;        // 배관
  airConditioner: string;  // 에어컨
  closingClean: string;    // 마감청소
  fullClean: string;       // 전체청소
  hygieneGrade: string;    // 위생등급
  notes: string;           // 특이사항
  // 확장: 기본 항목 외 자유 추가
  extraItems: ExtraItem[];
}

export type AdminTier = 'dev' | 'super' | 'admin';

export interface AuthUser {
  role: 'admin' | 'team' | 'store';  // 대표관리자 / 기사(팀) / 점주(매장)
  name: string;
  adminId?: string;  // role === 'admin' 일 때 admin_users.id (ID 기반 스코핑용)
  teamId?: string;
  storeId?: string;
  tier?: AdminTier;  // role === 'admin' 일 때만 의미 있음
}
