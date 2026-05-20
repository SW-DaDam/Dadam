/**
 * TTS 미리듣기 샘플 18개 사전 생성 스크립트 (1회성)
 *
 * 6개 voice × 3개 speed = 18개 MP3를 OpenAI gpt-4o-mini-tts로 생성해
 * Supabase Storage tts-samples 버킷에 업로드합니다.
 *
 * 실행 방법:
 *   npx tsx scripts/generate-tts-samples.ts
 *
 * 필요 환경변수 (.env.local 또는 실행 환경에 설정):
 *   OPENAI_API_KEY        — OpenAI API 키
 *   VITE_SUPABASE_URL     — Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service_role 키 (업로드 권한)
 *
 * 예상 비용: 18회 × ~$0.015 ≈ $0.27 (1회성)
 */

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// 루트 및 frontend/.env.local 모두 로드 시도
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), 'frontend/.env.local') })

// ── 상수 ──────────────────────────────────────────────────────
const VOICES = ['shimmer', 'nova', 'coral', 'onyx', 'echo', 'sage'] as const
const SPEEDS = ['slow', 'normal', 'fast'] as const

// 어르신 친화 베이스 instruction
const BASE_INSTRUCTION = `You are a warm AI companion for a Korean senior. Use a respectful, familiar, empathetic tone (like a granddaughter or grandson). Speak in Korean with natural prosody.`

const SPEED_INSTRUCTIONS = {
  slow: 'Speak slowly and clearly for an elderly listener. Pause naturally between sentences.',
  normal: 'Speak at a natural, gentle pace for a senior.',
  fast: 'Speak at a normal conversational pace.',
} as const

// 미리듣기 고정 샘플 텍스트 (C3 확정)
const SAMPLE_TEXT = '안녕하세요! 저는 어르신과 매일 이야기 나누는 AI 친구예요.'

const BUCKET_NAME = 'tts-samples'

// ── 환경변수 확인 ──────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 필요한 환경변수가 없습니다:')
  console.error('  OPENAI_API_KEY:', OPENAI_API_KEY ? '✓' : '✗')
  console.error('  VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗')
  process.exit(1)
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
// service_role 클라이언트: RLS 우회해서 Storage에 업로드
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

type Voice = typeof VOICES[number]
type Speed = typeof SPEEDS[number]

async function generateAndUpload(voice: Voice, speed: Speed): Promise<void> {
  const instructions = `${BASE_INSTRUCTION} ${SPEED_INSTRUCTIONS[speed]}`
  const fileName = `${voice}_${speed}.mp3`

  console.log(`  생성 중: ${fileName}...`)

  // OpenAI TTS API 호출
  const audio = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice,
    input: SAMPLE_TEXT,
    instructions,
    response_format: 'mp3',
  })

  const buffer = Buffer.from(await audio.arrayBuffer())

  // Supabase Storage 업로드 (덮어쓰기)
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,  // 재실행 시 덮어쓰기 허용
    })

  if (error) {
    throw new Error(`업로드 실패 (${fileName}): ${error.message}`)
  }

  console.log(`  ✓ ${fileName} 업로드 완료`)
}

async function main(): Promise<void> {
  console.log(`🎙️  TTS 샘플 생성 시작 (${VOICES.length}개 voice × ${SPEEDS.length}개 speed = ${VOICES.length * SPEEDS.length}개)`)
  console.log(`📝 샘플 텍스트: "${SAMPLE_TEXT}"`)
  console.log(`💰 예상 비용: ≈ $0.27 (1회성)`)
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
    process.exit(1)
  }

  // 업로드된 파일 public URL 확인
  console.log('\n📌 샘플 public URL 예시:')
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl('shimmer_slow.mp3')
  console.log(`  shimmer_slow.mp3 → ${data.publicUrl}`)
}

main().catch((err) => {
  console.error('예상치 못한 오류:', err)
  process.exit(1)
})
