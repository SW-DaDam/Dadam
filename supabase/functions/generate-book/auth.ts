// generate-book 내부 호출(service_role) 인증 헬퍼
//
// [보안 배경]
// 이전 구현은 Bearer JWT의 payload를 atob()로 디코딩해 payload.role === 'service_role'
// 인지만 확인했다. JWT 서명은 검증하지 않았기 때문에, 공격자가 헤더/페이로드를
// {"role":"service_role"} 로 위조한 토큰을 보내면 service_role(RLS 우회) 실행 경로로
// 그대로 진입할 수 있었다 (권한 상승).
//
// [수정 방향]
// service_role 호출자는 항상 정확히 동일한 service_role 키를 사용한다
// (pg_cron 은 current_setting('app.supabase_service_role_key') 로 SUPABASE_SERVICE_ROLE_KEY
//  그 자체를 Bearer 로 전송). 따라서 role 클레임을 신뢰하는 대신, 토큰이 실제
// service_role 키와 "정확히" 일치하는지만 확인한다. 키를 모르는 공격자는 위조 불가.

// 타이밍 공격 방지를 위한 상수 시간 문자열 비교
// - 길이가 다르면 즉시 false 반환 (문자열 길이 자체는 비밀이 아니므로 누출돼도 무방)
// - 길이가 같으면 모든 문자 코드의 XOR 결과를 누적해, 일치 여부와 무관하게 끝까지 순회
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

// Bearer 토큰이 실제 service_role 키와 정확히 일치할 때만 내부 호출(service_role)로 인정.
// serviceRoleKey 가 비어 있으면(환경변수 미설정) 어떤 토큰도 service_role 로 인정하지 않는다.
export function isServiceRoleToken(token: string, serviceRoleKey: string): boolean {
  if (!serviceRoleKey || !token) return false
  return timingSafeEqual(token, serviceRoleKey)
}

// job_id 처리 권한 판정 (IDOR 방지)
// - 내부(service_role/pg_cron) 호출(isInternalCall=true): 모든 job 처리 허용
// - 일반 사용자: 본인 소유(callerUserId === jobSeniorId) job 만 허용
//   (callerUserId 가 null 이면 일반 사용자 인증 정보가 없는 것이므로 거부)
export function canProcessJob(
  isInternalCall: boolean,
  callerUserId: string | null,
  jobSeniorId: string,
): boolean {
  if (isInternalCall) return true
  return callerUserId !== null && callerUserId === jobSeniorId
}
