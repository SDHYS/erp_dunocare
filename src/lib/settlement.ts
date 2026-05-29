import type { Team, Schedule } from '@/types';

export interface SettlementBreakdown {
  cost: number;              // 총작업비
  personalParts: number;     // 개인부품비
  prepaid: number;           // 선지급 차감액
  baseAmount: number;        // 공제 대상 (cost - personalParts)
  vatDeduction: number;      // 부가세 차감액
  afterVat: number;          // 부가세 차감 후
  agencyFee: number;         // 대행사 수수료 차감액
  afterAgency: number;       // 대행사 차감 후
  dunoFee: number;       // 두노케어 수수료 차감액
  afterDuno: number;     // 플랫폼 차감 후
  technicianBase: number;    // 기사수수료 (소득세 차감 전 기사 몫)
  incomeTax: number;         // 소득세
  finalAmount: number;       // 최종 정산금 (+ 개인부품 - 선지급)
  formula: string;           // 계산식 설명
}

// 팀 정산 규칙에 따라 정산금 계산
//
// 변경(2026-04):
//   - prepaidAmount(선지급) 차감 지원
//   - 'custom' 타입 지원 — 부가세→대행사→플랫폼→소득세 모두 적용 (모든 율 설정 가능)
//   - technicianBase(기사수수료) 노출
export function calculateSettlement(
  cost: number,
  personalParts: number,
  team: Pick<Team, 'settlementType' | 'vatRate' | 'agencyFeeRate' | 'dunoFeeRate' | 'taxRate'> | null,
  prepaidAmount = 0,
): SettlementBreakdown {
  const c = Math.max(0, Math.round(cost) || 0);
  const p = Math.max(0, Math.round(personalParts) || 0);
  const prepaid = Math.max(0, Math.round(prepaidAmount) || 0);
  const base = Math.max(0, c - p);

  // 기본값 (팀 없으면 simple 20% 차감)
  const type = team?.settlementType || 'simple';
  const vatRate = team?.vatRate ?? 10;
  const agencyRate = team?.agencyFeeRate ?? 0;
  const dunoRate = team?.dunoFeeRate ?? 20;
  const taxRate = team?.taxRate ?? 3.3;

  let afterVat = base;
  let vatDeduction = 0;
  let afterAgency = base;
  let agencyFee = 0;
  let afterDuno = base;
  let dunoFee = 0;
  let incomeTax = 0;
  let formula = '';

  if (type === 'max_care') {
    // 맥스케어 경유: 부가세 → 대행사 → 소득세 (플랫폼 직접 차감 없음)
    vatDeduction = Math.round(base * (vatRate / 100));
    afterVat = base - vatDeduction;
    agencyFee = Math.round(afterVat * (agencyRate / 100));
    afterAgency = afterVat - agencyFee;
    afterDuno = afterAgency;
    incomeTax = Math.round(afterAgency * (taxRate / 100));
    formula = `(총액-부품) × (1-${vatRate}%) × (1-${agencyRate}%) - ${taxRate}% + 부품 - 선지급`;
  } else if (type === 'custom') {
    // 복합형: 부가세 → 대행사 → 플랫폼 → 소득세 (모든 단계 적용)
    vatDeduction = vatRate > 0 ? Math.round(base * (vatRate / 100)) : 0;
    afterVat = base - vatDeduction;
    agencyFee = agencyRate > 0 ? Math.round(afterVat * (agencyRate / 100)) : 0;
    afterAgency = afterVat - agencyFee;
    dunoFee = dunoRate > 0 ? Math.round(afterAgency * (dunoRate / 100)) : 0;
    afterDuno = afterAgency - dunoFee;
    incomeTax = taxRate > 0 ? Math.round(afterDuno * (taxRate / 100)) : 0;
    const parts: string[] = ['(총액-부품)'];
    if (vatRate > 0) parts.push(`× (1-${vatRate}%)`);
    if (agencyRate > 0) parts.push(`× (1-${agencyRate}%)`);
    if (dunoRate > 0) parts.push(`× (1-${dunoRate}%)`);
    if (taxRate > 0) parts.push(`- ${taxRate}%`);
    parts.push('+ 부품 - 선지급');
    formula = parts.join(' ');
  } else {
    // simple (직정산): 두노케어 수수료 차감 → 소득세
    dunoFee = Math.round(base * (dunoRate / 100));
    afterDuno = base - dunoFee;
    afterAgency = afterDuno;
    afterVat = base;
    incomeTax = taxRate > 0 ? Math.round(afterDuno * (taxRate / 100)) : 0;
    formula = `(총액-부품) × (1-${dunoRate}%)${taxRate > 0 ? ` - ${taxRate}%` : ''} + 부품 - 선지급`;
  }

  // 기사수수료 = 소득세 차감 전 기사 몫
  const technicianBase = type === 'max_care' ? afterAgency : afterDuno;
  const netAfterTax = technicianBase - incomeTax;
  const finalAmount = Math.max(0, netAfterTax + p - prepaid);

  return {
    cost: c,
    personalParts: p,
    prepaid,
    baseAmount: base,
    vatDeduction,
    afterVat,
    agencyFee,
    afterAgency,
    dunoFee,
    afterDuno,
    technicianBase,
    incomeTax,
    finalAmount,
    formula,
  };
}

// 스케줄 목록을 팀별로 집계
export interface TeamSettlementSummary {
  teamName: string;
  count: number;
  totalCost: number;
  totalFinal: number;
  pending: number;    // 정산 미완료 건수
  schedules: Schedule[];
}

export function groupByTeam(
  schedules: Schedule[],
  teams: Team[]
): Record<string, TeamSettlementSummary> {
  const groups: Record<string, TeamSettlementSummary> = {};
  for (const s of schedules) {
    const key = s.assignee || '(미배정)';
    if (!groups[key]) {
      groups[key] = { teamName: key, count: 0, totalCost: 0, totalFinal: 0, pending: 0, schedules: [] };
    }
    const team = teams.find(t => t.name === s.assignee) || null;
    const breakdown = calculateSettlement(s.cost, s.personalPartsCost, team, s.prepaidAmount);
    groups[key].count++;
    groups[key].totalCost += s.cost;
    groups[key].totalFinal += breakdown.finalAmount;
    if (s.settlementStatus !== '정산완료') groups[key].pending++;
    groups[key].schedules.push(s);
  }
  return groups;
}

// CSV 행 생성 — 엑셀 원본 컬럼 구조 매칭 (requirements.md 5-2)
export function scheduleToCSVRow(s: Schedule, team: Team | null): string[] {
  const b = calculateSettlement(s.cost, s.personalPartsCost, team, s.prepaidAmount);
  return [
    s.date,
    s.storeName,                     // 매장(지점)
    s.request,                       // 작업내용
    s.assignee,                      // 담당
    String(s.cost),                  // 총작업비
    String(s.personalPartsCost),     // 개인부품
    String(s.prepaidAmount || 0),    // 선지급
    String(b.vatDeduction),          // 부가세
    String(b.agencyFee),             // 대행사수수료
    String(b.dunoFee),           // 두노케어수수료
    String(b.technicianBase),        // 기사수수료(세전)
    String(b.incomeTax),             // 소득세(3.3%)
    String(b.finalAmount),           // 정산금
    s.settlementStatus,              // 정산상태
    s.paidAt || '',                  // 송금일
    s.ownerInvoice,                  // 점주계산서
    s.partnerSettlement,             // 협력사정산
  ];
}

export const CSV_HEADERS = [
  '날짜', '매장', '작업내용', '담당',
  '총작업비', '개인부품', '선지급',
  '부가세', '대행사수수료', '두노케어수수료', '기사수수료', '소득세(3.3%)', '정산금',
  '정산상태', '송금일', '점주계산서', '협력사정산',
];
