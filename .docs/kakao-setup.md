# 카카오 소셜 로그인 설정 가이드

두노케어 스케줄러의 카카오 로그인 기능을 활성화하려면 카카오 개발자 앱을 등록하고 키를 받아야 합니다.

---

## 1단계: 카카오 개발자 앱 등록

1. [카카오 개발자센터](https://developers.kakao.com/) 접속 → 카카오 계정으로 로그인
2. **내 애플리케이션** → **애플리케이션 추가하기**
   - 앱 이름: `두노케어 스케줄러` (또는 원하는 이름)
   - 사업자명: `두노케어`
   - 저장

## 2단계: 앱 키 확인

생성된 앱의 **앱 키** 메뉴에서:
- **REST API 키** 복사 → `.env.local`의 `NEXT_PUBLIC_KAKAO_REST_API_KEY`에 붙여넣기

## 3단계: 카카오 로그인 활성화

좌측 메뉴 **제품 설정 → 카카오 로그인**
1. **활성화 설정** → ON
2. **Redirect URI** → **Redirect URI 등록**:
   - 개발용: `http://localhost:3000/api/auth/kakao/callback`
   - 운영용 (배포 후): `https://{실 도메인}/api/auth/kakao/callback`
3. 저장

## 4단계: 동의 항목 설정

좌측 **동의항목**:
- **프로필 정보(닉네임/프로필 사진)** → `필수 동의`
- **카카오계정(이메일)** → `선택 동의` (권장) 

## 5단계 (선택): Client Secret 설정 (보안 강화)

좌측 **보안**:
- **Client Secret** → 코드 발급
- `.env.local`의 `KAKAO_CLIENT_SECRET`에 붙여넣기 (옵션, 없어도 작동)

---

## 6단계: 환경변수 반영

`.env.local` 파일:

```env
NEXT_PUBLIC_KAKAO_REST_API_KEY=발급받은_REST_API_키
KAKAO_CLIENT_SECRET=발급받은_시크릿(선택)
NEXT_PUBLIC_KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback
```

**주의**: `NEXT_PUBLIC_*` 변수는 dev server 재시작이 필요합니다.

---

## 7단계: DB 마이그레이션

Supabase SQL Editor에서 아래 파일을 순서대로 실행:

1. `migrations/005_kakao_auth.sql` (kakao_id 컬럼 + pending 테이블 추가)

## 8단계: 관리자 계정

운영 관리자 계정은 **관리자 계정 페이지(/admin-users)** 에서 슈퍼어드민이 생성합니다.
개발 자동로그인은 `.env.local` 의 `DEV_LOGIN_ID` / `DEV_LOGIN_PW` 가 처리합니다.

---

## 테스트

1. 브라우저에서 `/` 접속 → 로그인 페이지
2. **카카오로 시작하기** 버튼 클릭
3. 카카오 인증 화면에서 승인
4. 최초 사용자면 `/signup`으로 리다이렉트 → 역할 선택 + 매장명/팀명 입력
5. 가입 완료 → 자동 로그인 → 메인 페이지
