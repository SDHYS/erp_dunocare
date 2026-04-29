// 비밀번호 정책 — 관리자/팀/매장 계정 공통
//
// 정책:
//   - 최소 8자
//   - 최대 128자
//   - 숫자 + 영문 + 특수문자 중 2종 이상 포함
//   - 단순 시퀀스(1234, abcd, qwerty) / 동일문자 반복(aaaa) 거부
//   - 흔한 비밀번호 denylist

const COMMON_DENYLIST = new Set([
  'password', '12345678', 'qwerty12', 'admin1234', '11111111', '00000000',
  'abcd1234', 'asdf1234', 'qwer1234', 'zxcv1234', 'duno1234', 'super1234',
  'dev1234', 'hihihihi',
]);

export interface PasswordCheck {
  ok: boolean;
  error?: string;
}

export function validatePassword(pw: string): PasswordCheck {
  if (typeof pw !== 'string') return { ok: false, error: '비밀번호가 올바르지 않습니다.' };
  if (pw.length < 8) return { ok: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' };
  if (pw.length > 128) return { ok: false, error: '비밀번호가 너무 깁니다.' };

  if (COMMON_DENYLIST.has(pw.toLowerCase())) {
    return { ok: false, error: '너무 흔한 비밀번호입니다. 다른 비밀번호를 사용하세요.' };
  }

  // 동일문자 4회 이상 반복 (aaaa, 1111)
  if (/(.)\1\1\1/.test(pw)) {
    return { ok: false, error: '같은 문자를 4번 이상 반복할 수 없습니다.' };
  }

  // 단순 연속 (1234, abcd) 4자 이상
  for (let i = 0; i < pw.length - 3; i++) {
    const a = pw.charCodeAt(i);
    const b = pw.charCodeAt(i + 1);
    const c = pw.charCodeAt(i + 2);
    const d = pw.charCodeAt(i + 3);
    if (b - a === 1 && c - b === 1 && d - c === 1) {
      return { ok: false, error: '연속된 문자(1234, abcd 등)는 사용할 수 없습니다.' };
    }
  }

  // 종류 카운트
  let kinds = 0;
  if (/[a-zA-Z]/.test(pw)) kinds++;
  if (/[0-9]/.test(pw)) kinds++;
  if (/[^a-zA-Z0-9]/.test(pw)) kinds++;
  if (kinds < 2) {
    return { ok: false, error: '영문/숫자/특수문자 중 2종 이상 포함해야 합니다.' };
  }

  return { ok: true };
}
