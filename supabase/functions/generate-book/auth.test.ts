// auth.ts 보안 헬퍼 테스트
// 실행: deno test supabase/functions/generate-book/auth.test.ts
//
// 핵심 검증: 위조한 role=service_role JWT 가 service_role 호출로 인정되지 않아야 한다.

import assert from 'node:assert/strict'
import { canProcessJob, isServiceRoleToken, timingSafeEqual } from './auth.ts'

Deno.test('isServiceRoleToken: 실제 service_role 키와 정확히 일치하면 true', () => {
  // pg_cron 은 SUPABASE_SERVICE_ROLE_KEY 그 자체를 Bearer 로 보낸다
  const key = 'eyJhbGciOiJIUzI1Ni.real-service-role-key.signature-xyz'
  assert.equal(isServiceRoleToken(key, key), true)
})

Deno.test('isServiceRoleToken: 위조한 role=service_role JWT 는 거부된다', () => {
  // {"role":"service_role"} 페이로드를 담았지만 서명이 무효한 위조 토큰
  // 이전 구현은 payload.role 만 보고 통과시켰으나, 이제는 키와 불일치하므로 거부돼야 한다
  const forgedPayload = btoa(JSON.stringify({ role: 'service_role' }))
  const forgedJwt = `eyJhbGciOiJIUzI1NiJ9.${forgedPayload}.fakesignature`
  const realKey = 'eyJhbGciOiJIUzI1Ni.real-service-role-key.signature-xyz'
  assert.equal(isServiceRoleToken(forgedJwt, realKey), false)
})

Deno.test('isServiceRoleToken: 일반 사용자 access_token 은 service_role 로 인정되지 않는다', () => {
  const userToken = 'eyJhbGciOiJIUzI1Ni.user-authenticated-token.usersig'
  const realKey = 'eyJhbGciOiJIUzI1Ni.real-service-role-key.signature-xyz'
  assert.equal(isServiceRoleToken(userToken, realKey), false)
})

Deno.test('isServiceRoleToken: 키 환경변수가 비어 있으면 어떤 토큰도 거부', () => {
  assert.equal(isServiceRoleToken('any-token', ''), false)
  assert.equal(isServiceRoleToken('', ''), false)
})

Deno.test('timingSafeEqual: 동일 문자열은 true', () => {
  assert.equal(timingSafeEqual('hello-world', 'hello-world'), true)
})

Deno.test('timingSafeEqual: 한 글자만 달라도 false', () => {
  assert.equal(timingSafeEqual('hello-world', 'hello-w0rld'), false)
})

Deno.test('timingSafeEqual: 길이가 다르면 false (prefix 일치라도)', () => {
  assert.equal(timingSafeEqual('secret', 'secret-extra'), false)
})

// ── canProcessJob: job 처리 권한(IDOR 방지) ──────────────────────────────
const UID_A = '11111111-1111-1111-1111-111111111111'
const UID_B = '22222222-2222-2222-2222-222222222222'

Deno.test('canProcessJob: 내부(service_role) 호출은 임의 job 허용', () => {
  // 내부 호출은 callerUserId가 null이라도 모든 job 처리 가능 (pg_cron 배치)
  assert.equal(canProcessJob(true, null, UID_A), true)
  assert.equal(canProcessJob(true, null, UID_B), true)
})

Deno.test('canProcessJob: 일반 사용자는 본인 소유 job만 허용', () => {
  assert.equal(canProcessJob(false, UID_A, UID_A), true)
})

Deno.test('canProcessJob: 일반 사용자가 타인 job을 처리하려 하면 거부 (IDOR 차단)', () => {
  assert.equal(canProcessJob(false, UID_A, UID_B), false)
})

Deno.test('canProcessJob: 인증 정보(uid) 없는 일반 호출은 거부', () => {
  assert.equal(canProcessJob(false, null, UID_A), false)
})
