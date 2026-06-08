// 정기 관리 카테고리 마스터 — 필터/에어컨/커피머신 등
// 새 카테고리 추가하려면 여기에 한 줄만 추가하면 됨

export interface MaintenanceCategoryDef {
  value: string;
  label: string;
  defaultCycle: number;          // 기본 교체 주기 (개월)
  typeOptions: readonly string[]; // 세부 종류 (브랜드/모델 등)
}

export const MAINTENANCE_CATEGORIES: readonly MaintenanceCategoryDef[] = [
  {
    value: 'filter',
    label: '정수기 필터',
    defaultCycle: 6,
    typeOptions: ['에버퓨어', '파라곤', '한독크린텍', '아쿠온', '3M', '기타'],
  },
  {
    value: 'water_purifier',
    label: '정수기 본체',
    defaultCycle: 12,
    typeOptions: ['코웨이', '청호나이스', 'LG 퓨리케어', '쿠쿠', 'SK매직', '기타'],
  },
  {
    value: 'aircon',
    label: '에어컨',
    defaultCycle: 6,
    typeOptions: ['LG 듀얼', '삼성 사이클론', '캐리어', '대우', '센추리', '기타'],
  },
  {
    value: 'coffee_machine',
    label: '커피머신',
    defaultCycle: 12,
    typeOptions: ['라마르조꼬', '슬레이어', '시모넬리', 'WMF', '에스프레소솔로', '기타'],
  },
  {
    value: 'grinder',
    label: '글라인더',
    defaultCycle: 12,
    typeOptions: ['메져', '디팅', '슈퍼조', 'EK43', '기타'],
  },
  {
    value: 'ice_maker',
    label: '제빙기',
    defaultCycle: 6,
    typeOptions: ['카이저', '호시자키', '아이스트로', '대우', '기타'],
  },
  {
    value: 'dispenser',
    label: '디스펜서',
    defaultCycle: 12,
    typeOptions: ['기타'],
  },
  {
    value: 'water_heater',
    label: '온수기',
    defaultCycle: 24,
    typeOptions: ['린나이', '경동나비엔', '귀뚜라미', '기타'],
  },
  {
    value: 'refrigerator',
    label: '냉장고',
    defaultCycle: 12,
    typeOptions: ['LG', '삼성', '캐리어', '기타'],
  },
  {
    value: 'oven',
    label: '오븐',
    defaultCycle: 12,
    typeOptions: ['우녹스', '레오날드', '기타'],
  },
  {
    value: 'pos',
    label: 'POS 시스템',
    defaultCycle: 24,
    typeOptions: ['캣', '동글톡', '기타'],
  },
  {
    value: 'other',
    label: '기타',
    defaultCycle: 6,
    typeOptions: [],
  },
] as const;

export function getCategoryDef(value: string): MaintenanceCategoryDef | undefined {
  return MAINTENANCE_CATEGORIES.find(c => c.value === value);
}

export function isValidCategory(value: string): boolean {
  return MAINTENANCE_CATEGORIES.some(c => c.value === value);
}

/** 다음 교체 예정일 자동 계산 */
export function calcNextDueDate(lastReplacedAt: string | null | undefined, cycleMonths: number): string | null {
  if (!lastReplacedAt) return null;
  const d = new Date(lastReplacedAt);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + cycleMonths);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
