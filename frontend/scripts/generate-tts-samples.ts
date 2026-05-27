/**
 * TTS 미리듣기 샘플 사전 생성 스크립트 (1회성)
 *
 * Phase 2: 6개 voice × 3개 speed = 18개 MP3 생성
 * 여성: nyejin(예진), noyj(봄달), vara(아라/Pro)
 * 남성: nminsang(민상), nsiyoon(시윤), vian(이안/Pro)
 *
 * Naver Clova Voice Premium TTS API 사용 → Supabase Storage tts-samples 버킷 업로드
 *
 * 실행 방법 (frontend/ 디렉터리에서):
 *   npx tsx scripts/generate-tts-samples.ts
 *
 * 필요 환경변수:
 *   NCP_CLOVA_CLIENT_ID         — supabase/functions/.env.local
 *   NCP_CLOVA_CLIENT_SECRET     — supabase/functions/.env.local
 *   VITE_SUPABASE_URL           — frontend/.env.local
 *   SUPABASE_SERVICE_ROLE_KEY   — supabase/functions/.env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// ESM에서는 __dirname 대신 import.meta.dirname 사용 (Node.js v20.11+)
const ROOT = path.resolve(import.meta.dirname, '../..')
dotenv.config({ path: path.join(ROOT, 'frontend/.env.local') })
dotenv.config({ path: path.join(ROOT, 'supabase/functions/.env.local') })

// ── 상수 ──────────────────────────────────────────────────────
// Phase 2: 6종 확정 (NCP 콘솔 청취 기준)
const VOICES = ['nyejin', 'noyj', 'vara', 'nminsang', 'nsiyoon', 'vian'] as const
const SPEEDS = ['slow', 'normal', 'fast'] as const

// Clova speed 매핑 — Edge Function tts-clova/index.ts의 CLOVA_SPEED_MAP과 동일하게 유지
// 실청취 기준: slow +2(살짝 느림), normal 0(기본), fast -2(약간 빠름)
const CLOVA_SPEED_MAP: Record<typeof SPEEDS[number], number> = {
  slow: 2,
  normal: 0,
  fast: -2,
}

// Phase 1에서 사용하던 화자 — 샘플 파일 삭제 대상
const DEPRECATED_VOICES = ['ngoeun'] as const

const SAMPLE_TEXT = '안녕하세요! 저는 어르신과 매일 이야기 나누는 AI 친구예요.'
const BUCKET_NAME = 'tts-samples'
const CLOVA_TTS_ENDPOINT = 'https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts'

// ── 환경변수 확인 ──────────────────────────────────────────────
const NCP_CLOVA_CLIENT_ID = process.env.NCP_CLOVA_CLIENT_ID
const NCP_CLOVA_CLIENT_SECRET = process.env.NCP_CLOVA_CLIENT_SECRET
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!NCP_CLOVA_CLIENT_ID || !NCP_CLOVA_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 필요한 환경변수가 없습니다:')
  console.error('  NCP_CLOVA_CLIENT_ID:', NCP_CLOVA_CLIENT_ID ? '✓' : '✗')
  console.error('  NCP_CLOVA_CLIENT_SECRET:', NCP_CLOVA_CLIENT_SECRET ? '✓' : '✗')
  console.error('  VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗')
  process.exit(1)
}

// service_role 클라이언트 — RLS 우회해서 Storage에 업로드/삭제
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

type Voice = typeof VOICES[number]
type Speed = typeof SPEEDS[number]

// Clova Voice Premium TTS API 호출 → MP3 Buffer 반환
async function callClovaTts(voice: Voice, speed: Speed): Promise<Buffer> {
  const clovaSpeed = CLOVA_SPEED_MAP[speed]
  const res = await fetch(CLOVA_TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-NCP-APIGW-API-KEY-ID': NCP_CLOVA_CLIENT_ID!,
      'X-NCP-APIGW-API-KEY': NCP_CLOVA_CLIENT_SECRET!,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      speaker: voice,
      text: SAMPLE_TEXT,
      speed: String(clovaSpeed),
      format: 'mp3',
    }),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Clova TTS 오류 (${res.status}): ${errBody}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

async function generateAndUpload(voice: Voice, speed: Speed): Promise<void> {
  const fileName = `${voice}_${speed}.mp3`
  console.log(`  생성 중: ${fileName}...`)

  const buffer = await callClovaTts(voice, speed)

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (error) throw new Error(`업로드 실패 (${fileName}): ${error.message}`)
  console.log(`  ✓ ${fileName} 업로드 완료`)
}

// Phase 1 샘플 파일 삭제 — ngoeun_slow/normal/fast.mp3
async function deleteDeprecatedSamples(): Promise<void> {
  const filesToDelete = DEPRECATED_VOICES.flatMap(
    (voice) => SPEEDS.map((speed) => `${voice}_${speed}.mp3`),
  )

  console.log('\n🗑️  Phase 1 샘플 파일 삭제 중...')
  const { error } = await supabase.storage.from(BUCKET_NAME).remove(filesToDelete)

  if (error) {
    // 파일이 없어도 에러가 날 수 있으므로 경고만 출력 (중단 X)
    console.warn(`  ⚠️  삭제 중 오류 (이미 없는 파일일 수 있음): ${error.message}`)
  } else {
    console.log(`  ✓ 삭제 완료: ${filesToDelete.join(', ')}`)
  }
}

async function main(): Promise<void> {
  console.log(`🎙️  TTS 샘플 생성 시작 (${VOICES.length}개 voice × ${SPEEDS.length}개 speed = ${VOICES.length * SPEEDS.length}개)`)
  console.log(`📝 샘플 텍스트: "${SAMPLE_TEXT}"`)
  console.log(`🔊 엔진: Naver Clova Voice Premium`)
  console.log()

  let successCount = 0
  let failCount = 0

  for (const voice of VOICES) {
    console.log(`\n[${voice}]`)
    for (const speed of SPEEDS) {
      try {
        await generateAndUpload(voice, speed)
        successCount++
      } catch (err) {
        console.error(`  ✗ ${voice}_${speed}: ${err instanceof Error ? err.message : String(err)}`)
        failCount++
      }
    }
  }

  console.log()
  console.log(`✅ 완료: ${successCount}개 성공, ${failCount}개 실패`)

  if (failCount > 0) {
    console.log('⚠️  실패한 파일은 스크립트를 다시 실행하면 재생성됩니다 (upsert: true)')
    // 모든 샘플이 올라간 후에만 Phase 1 파일 삭제
    process.exit(1)
  }

  // 신규 샘플 모두 성공한 경우에만 Phase 1 파일 삭제
  await deleteDeprecatedSamples()

  console.log('\n📌 샘플 public URL 예시:')
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl('noyj_normal.mp3')
  console.log(`  noyj_normal.mp3 → ${data.publicUrl}`)
}

main().catch((err) => {
  console.error('예상치 못한 오류:', err)
  process.exit(1)
})
