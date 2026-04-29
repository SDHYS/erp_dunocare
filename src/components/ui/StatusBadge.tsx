import { getStatusDotClass, getStatusPingClass, isStatusAnimated } from '@/lib/statusStyle';

interface StatusBadgeProps {
  value: string;
  className?: string;
}

/**
 * 상태 표시 — 점(빈/채움) + 신호등 색 글자.
 * 페어 전반(접수/진행중/일정연기): 빈 동그라미 + ping 애니메이션
 * 페어 후반(배정중/진행완료/취소): 채워진 동그라미
 */
export default function StatusBadge({ value, className = '' }: StatusBadgeProps) {
  const colorClass = 'text-gray-900';
  const dotClass = getStatusDotClass(value);
  const pingClass = getStatusPingClass(value);
  const animated = isStatusAnimated(value);
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${colorClass} ${className}`}>
      <span className="relative inline-flex w-2.5 h-2.5 shrink-0" aria-hidden>
        {animated && (
          <span className={`absolute inset-0 rounded-full opacity-60 animate-ping ${pingClass}`} />
        )}
        <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${dotClass}`} />
      </span>
      <span>{value}</span>
    </span>
  );
}
