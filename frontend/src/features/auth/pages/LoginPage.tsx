import { supabase } from '@/lib/supabase'

function KakaoIcon() {
  return (
    <svg width="24" height="22" viewBox="0 0 40 36" fill="#3C1E1E" aria-hidden="true">
      <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
    </svg>
  )
}

function AiAvatar() {
  return (
    <div className="relative flex items-center justify-center w-[140px] h-[140px] rounded-full bg-[#FFF0DC]">
      {/* 장식 원들 */}
      <div className="absolute top-2 right-3 w-5 h-5 rounded-full bg-[#FFF0DC] border-2 border-[#E8820C]" />
      <div className="absolute bottom-3 left-2 w-[14px] h-[14px] rounded-full bg-[#E8820C] opacity-50" />
      <div className="absolute bottom-6 right-2 w-3 h-3 rounded-full bg-[#E8820C] opacity-30" />
      <div className="absolute top-4 left-3 w-[18px] h-[18px] rounded-full bg-[#FFF0DC] border-[1.5px] border-[#E8820C]" />
      {/* 내부 원 */}
      <div className="w-24 h-24 rounded-full bg-[#E8820C] flex items-center justify-center">
        <span className="text-[1.625rem] text-white leading-none">AI</span>
      </div>
    </div>
  )
}

export default function LoginPage() {
  // 카카오 OAuth 시작 — Supabase가 카카오 인가 페이지로 리다이렉트하고,
  //   완료 후 redirectTo로 돌아와 detectSessionInUrl이 자동으로 세션 파싱
  // queryParams.scope로 카카오 OAuth URL의 scope 파라미터를 완전 덮어쓰기.
  //   options.scopes는 Supabase 기본값(account_email 포함)에 추가되는 구조라
  //   account_email을 제거하려면 queryParams를 써야 함 (KOE205 회피).
  //   카카오 개인 앱은 account_email 권한을 받을 수 없기 때문에 필수 조치
  async function handleKakaoStart() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          scope: 'profile_nickname profile_image',
        },
      },
    })
    if (error) {
      // TASK-11에서 한국어 에러 메시지 매핑 예정, 우선 콘솔 로깅만
      console.error('카카오 OAuth 시작 실패:', error.message)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 md:px-8 py-8 md:py-10 gap-5 md:gap-6 w-full max-w-2xl mx-auto">

        {/* 로고 영역 */}
        <section className="flex flex-col items-center gap-4 pt-6">
          <AiAvatar />
          <h1 className="text-xl sm:text-[1.75rem] text-[#1F2937] text-center leading-snug">
            내 이야기 책
          </h1>
          <p className="text-lg text-[#6B7280] text-center leading-[22px]">
            AI 말동무와 함께 만드는 가족 출판 플랫폼
          </p>
        </section>

        {/* 웰컴 카드 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-8 py-6 flex flex-col items-center gap-2">
          <p className="text-xl text-[#1F2937] leading-snug">처음 오셨나요?</p>
          <p className="text-lg text-[#6B7280] leading-[22px]">카카오톡으로 바로 시작할 수 있어요</p>
          <p className="text-base text-[#6B7280] leading-[19px]">별도 회원가입이 필요 없어요</p>
        </div>

        {/* 카카오 버튼 영역 */}
        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            onClick={handleKakaoStart}
            className="w-full h-[72px] rounded-xl bg-[#FEE500] flex items-center justify-center gap-3 text-xl text-[#3C1E1E]"
          >
            <KakaoIcon />
            카카오톡으로 시작하기
          </button>
        </div>

        {/* 안내 카드 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-8 py-6 flex flex-col gap-4">
          <p className="text-lg text-[#1F2937] leading-[22px]">카카오톡 연동으로 할 수 있어요</p>
          <ul className="flex flex-col gap-3">
            {[
              '가족을 카카오 링크로 손쉽게 초대',
              '새 댓글·답장 알림을 카카오로 받기',
              '별도 비밀번호 없이 안전하게 로그인',
            ].map((text) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#E8820C] shrink-0" />
                <span className="text-[1.0625rem] text-[#1F2937] leading-[21px]">{text}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-[#E5E7EB] pt-3">
            <p className="text-[0.9375rem] text-[#6B7280] text-center leading-[18px]">
              카카오 이름·프로필 사진만 사용해요
            </p>
          </div>
        </div>

        {/* 약관 */}
        <div className="flex flex-col items-center gap-1 pb-4">
          <p className="text-[0.9375rem] text-[#6B7280] text-center leading-[18px]">
            로그인 시
          </p>
          <p className="text-[0.9375rem] text-[#6B7280] text-center leading-[18px]">
            개인정보 처리방침 및 이용약관에 동의하게 돼요
          </p>
          <button type="button" className="text-[0.9375rem] text-[#E8820C] leading-[18px] min-h-0">
            개인정보 처리방침
          </button>
        </div>

      </main>

      {/* 하단 푸터 */}
      <footer className="w-full h-[60px] bg-white border-t border-[#E5E7EB] flex items-center justify-center">
        <p className="text-[0.9375rem] text-[#6B7280] leading-[18px]">
          오브젠 · AI 말동무 시니어 가족 출판 플랫폼
        </p>
      </footer>
    </div>
  )
}
