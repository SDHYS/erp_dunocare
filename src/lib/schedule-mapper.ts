// schedules 테이블 row 매퍼 — 단일 출처
import 'server-only';

export interface ScheduleRow {
  id: string;
  date: string;
  store_name: string;
  request: string;
  maintenance_time?: string | null;
  cost?: number | null;
  personal_parts_cost?: number | null;
  prepaid_amount?: number | null;
  paid_at?: string | null;
  progress_status?: string | null;
  assignee?: string | null;
  work_result?: string | null;
  satisfaction?: string | null;
  payment?: string | null;
  settlement_amount?: number | null;
  deduction_rate?: string | null;
  settlement_status?: string | null;
  owner_invoice?: string | null;
  partner_settlement?: string | null;
  field_manager?: string | null;
  notes?: string | null;
}

export interface ScheduleDTO {
  id: string;
  date: string;
  storeName: string;
  request: string;
  maintenanceTime: string;
  cost: number;
  personalPartsCost: number;
  prepaidAmount: number;
  paidAt: string;            // YYYY-MM-DD or ''
  progressStatus: string;
  assignee: string;
  workResult: string;
  satisfaction: string;
  payment: string;
  settlementAmount: number;
  deductionRate: string;
  settlementStatus: string;
  ownerInvoice: string;
  partnerSettlement: string;
  fieldManager: string;
  notes: string;
}

export function mapRowToSchedule(row: Record<string, unknown>): ScheduleDTO {
  return {
    id: (row.id as string) || '',
    date: (row.date as string) || '',
    storeName: (row.store_name as string) || '',
    request: (row.request as string) || '',
    maintenanceTime: (row.maintenance_time as string) || '',
    cost: Number(row.cost) || 0,
    personalPartsCost: Number(row.personal_parts_cost) || 0,
    prepaidAmount: Number(row.prepaid_amount) || 0,
    paidAt: (row.paid_at as string) || '',
    progressStatus: (row.progress_status as string) || '접수',
    assignee: (row.assignee as string) || '',
    workResult: (row.work_result as string) || '',
    satisfaction: (row.satisfaction as string) || '미응답',
    payment: (row.payment as string) || '미결제',
    settlementAmount: Number(row.settlement_amount) || 0,
    deductionRate: (row.deduction_rate as string) || '10%',
    settlementStatus: (row.settlement_status as string) || '정산대기',
    ownerInvoice: (row.owner_invoice as string) || '미발행',
    partnerSettlement: (row.partner_settlement as string) || '미발행',
    fieldManager: (row.field_manager as string) || '',
    notes: (row.notes as string) || '',
  };
}

// 텍스트 normalize — 공백/유니코드 정규화 (수동 입력 typo 보호)
function norm(s: string | undefined | null): string {
  return (s || '').trim().normalize('NFC');
}

// 다른 매장/팀 일정에 적용할 강한 마스킹 (요구사항: 일시/시간/요청사항/방문자/매장명만 공개)
function maskOtherSchedule(s: ScheduleDTO): ScheduleDTO {
  return {
    ...s,
    cost: 0,
    personalPartsCost: 0,
    settlementAmount: 0,
    prepaidAmount: 0,
    paidAt: '',
    deductionRate: '',
    settlementStatus: '',
    ownerInvoice: '',
    partnerSettlement: '',
    payment: '',
    workResult: '',
    satisfaction: '',
    fieldManager: '',
    notes: '',
  };
}

/**
 * store role 용 — 모든 일정 노출(빈 자리 확인용) + 민감 필드 마스킹
 * 요구사항(.docs/requirements.md):
 *   - 공개: 일시 / 시간 / 요청사항 / 방문자 / 매장명
 *   - 관리자 전용: 비용 / 결제 / 세금계산서 / 연락처/주소/이메일
 *
 *   - 본인 매장: 비용 등 관리자 전용 필드만 마스킹 (작업결과/만족도/비고는 노출)
 *   - 다른 매장: 강한 마스킹 (공개 5종 외 모두)
 */
export function maskScheduleForStore(s: ScheduleDTO, ownStoreName?: string): ScheduleDTO {
  const isOwn = !!ownStoreName && norm(s.storeName) === norm(ownStoreName);
  if (!isOwn) return maskOtherSchedule(s);
  // 본인 매장 — 관리자 전용 필드만 마스킹
  return {
    ...s,
    cost: 0,
    personalPartsCost: 0,
    settlementAmount: 0,
    prepaidAmount: 0,
    paidAt: '',
    deductionRate: '',
    settlementStatus: '',
    ownerInvoice: '',
    partnerSettlement: '',
    payment: '',
  };
}

/**
 * team role 용 — 모든 일정 노출(빈 자리 확인용) + 민감 필드 마스킹
 *   - 본인 배정 일정: 풀 노출 (cost/정산도 봐야 정산 확인 가능)
 *   - 다른 팀 일정: 강한 마스킹 (점주가 다른 매장 보는 것과 동일)
 */
export function maskScheduleForTeam(s: ScheduleDTO, ownTeamName?: string): ScheduleDTO {
  const isOwn = !!ownTeamName && norm(s.assignee) === norm(ownTeamName);
  if (isOwn) return s; // 본인 일정 — 풀 노출
  return maskOtherSchedule(s);
}
