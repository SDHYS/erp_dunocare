// 진행 상태 색상 — 노랑·초록·빨강 팔레트 + 진하기로 차이
// 노랑 = 접수/배정 단계 (대기)
// 초록 = 진행/완료 (정상 진행)
// 빨강 = 정지/취소 (중단)

export const PROGRESS_STATUSES = ['접수', '배정중', '진행중', '진행완료', '일정연기', '취소'] as const;
export type ProgressStatusName = typeof PROGRESS_STATUSES[number];

/** 점 표시 — 페어 전반 = 빈 동그라미 / 후반 = 채워진 (노랑·초록·빨강) */
export function getStatusDotClass(status: string): string {
  switch (status) {
    case '접수':     return 'border-2 border-yellow-300 bg-white';
    case '진행중':   return 'border-2 border-green-300 bg-white';
    case '일정연기': return 'border-2 border-red-300 bg-white';
    case '배정중':   return 'bg-yellow-400';
    case '진행완료': return 'bg-green-400';
    case '취소':     return 'bg-red-400';
    default:         return 'bg-gray-400';
  }
}

/** 애니메이션 ping ring 색상 */
export function getStatusPingClass(status: string): string {
  switch (status) {
    case '접수':     return 'bg-yellow-300';
    case '배정중':   return 'bg-yellow-400';
    case '진행중':   return 'bg-green-300';
    case '진행완료': return 'bg-green-400';
    case '일정연기': return 'bg-red-300';
    case '취소':     return 'bg-red-400';
    default:         return 'bg-gray-400';
  }
}

/** 페어의 전반(초기/진행 중) → ping 애니메이션 적용 */
export function isStatusAnimated(status: string): boolean {
  return status === '접수' || status === '진행중' || status === '일정연기';
}

/** 그래프/프로그레스 바 hex (점 색과 동일) */
export function getStatusColor(status: string): string {
  switch (status) {
    case '접수':     return '#fde047';   // yellow-300
    case '배정중':   return '#facc15';   // yellow-400
    case '진행중':   return '#86efac';   // blue-300
    case '진행완료': return '#4ade80';   // blue-500
    case '일정연기': return '#fca5a5';   // red-300
    case '취소':     return '#f87171';   // red-400
    default:         return '#9ca3af';
  }
}

