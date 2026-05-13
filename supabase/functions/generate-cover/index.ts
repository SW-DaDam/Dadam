// generate-cover: DALL-E 3로 책 표지 후보 3장 생성 후 book-covers 버킷 저장
// 트리거: generate-book의 chaptering 완료 후 fire-and-forget 내부 호출
// 인증: service_role JWT 필수

import { createClient } from 'npm:@supabase/supabase-js'
import OpenAI from 'npm:openai'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COVER_COUNT = 3            // 최초 생성할 표지 후보 수
const EXTRA_COVER_LIMIT = 3      // 사용자가 추가로 생성할 수 있는 최대 표지 수
const IMAGE_SIZE = '1024x1024'   // DALL-E 3 이미지 크기 (향후 1024×1792 변경 가능)
const BUCKET = 'book-covers'     // Supabase Storage 버킷명

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface GenerateCoverRequest {
  book_id: string      // 대상 책 UUID
  senior_id: string    // 어르신 UUID (Storage 경로용)
  mode?: 'batch' | 'single'  // batch: 최초 생성(service_role), single: 1장 추가 생성(anon)
  chapter_id?: string  // single 모드 전용: 재생성할 챕터 UUID
}

interface Chapter {
  id: string
  title: string
  theme: string
  content: string
  sort_order: number
}

// 챕터 테마별 시각적 무드 (사람 없는 오브젝트·풍경 중심)
const THEME_MOOD: Record<string, string> = {
  '가족': 'warm family heirlooms, handwritten letters, a wooden dining table with empty chairs bathed in afternoon light',
  '추억': 'nostalgic objects from the past, faded photographs, an old clock, soft morning mist over a quiet countryside road',
  '일상': 'simple everyday objects, a teacup on a windowsill, gentle sunlight through curtains, seasonal vegetables on a wooden board',
  '가치관': 'a solitary tree on a hilltop at dusk, calm water reflecting clouds, timeless natural scenery with a contemplative mood',
}

// 성별별 색조 팔레트
const GENDER_PALETTE: Record<string, string> = {
  female: 'warm pastel tones — soft rose, cream, sage green',
  male: 'earthy muted tones — slate blue, warm brown, aged ivory',
}

// ─── 헬퍼: 챕터별 DALL-E 프롬프트 구성 ──────────────────────────────────────
// - 챕터 테마 + 내용 요약 + 성별/나이 팔레트 기반
// - 사람·얼굴 없는 오브젝트·풍경 중심의 책 표지 스타일

function buildDallePrompt(chapter: Chapter, gender?: string | null, age?: number | null): string {
  const mood = THEME_MOOD[chapter.theme] ?? THEME_MOOD['일상']
  const palette = gender ? (GENDER_PALETTE[gender] ?? GENDER_PALETTE['female']) : 'warm neutral tones'
  const ageHint = age && age >= 60
    ? 'with a vintage, nostalgic quality reminiscent of mid-20th-century Korea'
    : 'with a timeless, classic quality'
  const snippet = chapter.content.slice(0, 60).replace(/"/g, '')

  return `A beautiful book cover illustration for a Korean memoir chapter titled "${chapter.title}". ` +
    `The visual theme is: ${mood}. ` +
    `Color palette: ${palette}. ` +
    `Style: soft painterly illustration ${ageHint}, suitable for a literary memoir cover. ` +
    `The mood evoked by the chapter: "${snippet}...". ` +
    `No text, no people, no faces. Composition: centered subject with soft bokeh background. ` +
    `High quality, publishing-grade artwork.`
}

// ─── 헬퍼: 이미지 1장 생성 + Storage 업로드 + cover_images upsert ─────────────

async function generateAndUploadCover(
  openai: OpenAI,
  supabaseAdmin: ReturnType<typeof createClient>,
  bookId: string,
  seniorId: string,
  chapterId: string,
  dallePrompt: string,
  index: number,
): Promise<void> {
  // DALL-E 3는 n=1 고정 — 3장은 반드시 3회 별도 호출 필요
  const imageRes = await openai.images.generate({
    model: 'dall-e-3',
    prompt: dallePrompt,
    n: 1,
    size: IMAGE_SIZE,
    response_format: 'url',
  })

  const imageUrl = imageRes.data[0]?.url
  if (!imageUrl) throw new Error(`DALL-E 응답에 URL 없음 (index ${index})`)

  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) throw new Error(`이미지 다운로드 실패 (index ${index}): ${imageResponse.status}`)
  const imageBuffer = await imageResponse.arrayBuffer()

  // Storage 경로: {senior_id}/{book_id}/{chapter_id}.png (챕터 1:1 대응)
  const storagePath = `${seniorId}/${bookId}/${chapterId}.png`

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: true,  // 추가 생성 시 덮어쓰기 허용
    })
  if (uploadErr) throw new Error(`Storage 업로드 실패 (index ${index}): ${uploadErr.message}`)

  const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath)

  // upsert: 추가 생성 시 기존 레코드 교체 (챕터당 1개 유지)
  const { error: upsertErr } = await supabaseAdmin.from('cover_images').upsert(
    {
      book_id: bookId,
      chapter_id: chapterId,
      image_url: publicUrl,
      prompt: dallePrompt,
      status: 'candidate',
    },
    { onConflict: 'book_id,chapter_id' },
  )
  if (upsertErr) throw new Error(`cover_images upsert 실패 (index ${index}): ${upsertErr.message}`)

  console.log(`[generate-cover] 표지 ${index + 1} 생성 완료 — chapter ${chapterId}`)
}

// ─── 메인 핸들러 ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 인증 검증 (generate-book과 동일한 service_role JWT 패턴) ──────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization 헤더가 필요합니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 파라미터 파싱 및 검증 ────────────────────────────────────────────────
    const body: GenerateCoverRequest = await req.json()
    const { book_id: bookId, senior_id: seniorId, mode = 'batch' } = body

    if (!bookId || !seniorId) {
      return new Response(
        JSON.stringify({ error: 'book_id, senior_id는 필수입니다' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 모드별 인증 처리 ──────────────────────────────────────────────────────
    // batch 모드: generate-book 내부 호출 전용 — X-Internal-Secret 헤더로 인증
    //   SUPABASE_SERVICE_ROLE_KEY가 Edge Function 환경에서 자동 주입되지 않으므로
    //   generate-book이 공유 secret 헤더를 전달하는 방식으로 내부 호출을 증명함
    //   외부(브라우저/클라이언트)에서는 이 secret을 알 수 없으므로 접근 불가
    // single 모드: 어르신 본인 JWT를 Supabase Auth로 검증 후 소유권 확인
    let tokenSub: string | null = null

    if (mode === 'batch') {
      const internalSecret = req.headers.get('X-Internal-Secret')
      const expectedSecret = Deno.env.get('INTERNAL_COVER_SECRET')
      if (!expectedSecret || internalSecret !== expectedSecret) {
        return new Response(
          JSON.stringify({ error: 'batch 모드는 내부 호출 전용입니다' }),
          { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
    } else {
      // single 모드: JWT 서명을 Supabase Auth로 검증 (payload 직접 파싱 금지)
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      const { createClient: createVerifyClient } = await import('npm:@supabase/supabase-js')
      const verifyClient = createVerifyClient(
        Deno.env.get('SUPABASE_URL')!,
        anonKey,
        { global: { headers: { Authorization: authHeader } } },
      )
      const { data: { user }, error: authErr } = await verifyClient.auth.getUser()
      if (authErr || !user) {
        return new Response(
          JSON.stringify({ error: '유효하지 않은 인증 토큰입니다' }),
          { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
      tokenSub = user.id
      // 본인 책의 표지만 재생성 가능 (senior_id 일치 확인)
      if (tokenSub !== seniorId) {
        return new Response(
          JSON.stringify({ error: '본인 책의 표지만 재생성할 수 있습니다' }),
          { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
    }

    // ── service_role 클라이언트 초기화 (RLS 우회) ────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── single 모드: 1장 추가 생성 ──────────────────────────────────────────
    if (mode === 'single') {
      // book_id로 책을 조회해 실제 소유자 확인 (senior_id만 비교하면 타인의 book_id 전달 가능)
      const { data: bookData } = await supabaseAdmin
        .from('books')
        .select('senior_id')
        .eq('id', bookId)
        .single()

      if (!bookData || bookData.senior_id !== tokenSub) {
        return new Response(
          JSON.stringify({ error: '본인 책의 표지만 재생성할 수 있습니다' }),
          { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      // 현재 candidate 표지 수 조회 (초기 3장 + 추가 생성분)
      const { data: allCovers } = await supabaseAdmin
        .from('cover_images')
        .select('id, created_at')
        .eq('book_id', bookId)
        .eq('status', 'candidate')
        .order('created_at')

      const totalCount = allCovers?.length ?? 0
      // 초기 3장은 제외하고 추가 생성분만 카운트
      const extraCount = Math.max(0, totalCount - COVER_COUNT)

      if (extraCount >= EXTRA_COVER_LIMIT) {
        return new Response(
          JSON.stringify({ error: `추가 표지는 최대 ${EXTRA_COVER_LIMIT}장까지 생성할 수 있습니다` }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      // chapter_id 필수 (single 모드는 특정 챕터 재생성)
      const { chapter_id: chapterId } = body
      if (!chapterId) {
        return new Response(
          JSON.stringify({ error: 'single 모드는 chapter_id가 필요합니다' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      const { data: chapter, error: chapterErr } = await supabaseAdmin
        .from('chapters')
        .select('id, title, theme, content, sort_order')
        .eq('id', chapterId)
        .eq('book_id', bookId)
        .eq('is_deleted', false)
        .single()

      if (chapterErr || !chapter) {
        return new Response(
          JSON.stringify({ error: '챕터를 찾을 수 없습니다' }),
          { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      // 저자 프로필 (성별·나이)
      let gender: string | null = null
      let age: number | null = null
      try {
        const { data: profile } = await supabaseAdmin
          .from('senior_profiles').select('gender, birth_date').eq('id', seniorId).single()
        if (profile) {
          gender = profile.gender ?? null
          if (profile.birth_date) age = new Date().getFullYear() - new Date(profile.birth_date).getFullYear()
        }
      } catch { /* 기본값으로 진행 */ }

      const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })
      const dallePrompt = buildDallePrompt(chapter as Chapter, gender, age)

      console.log(`[generate-cover] single 모드 — 챕터 재생성 (chapter_id: ${chapterId}, extra: ${extraCount + 1}/${EXTRA_COVER_LIMIT})`)
      await generateAndUploadCover(openai, supabaseAdmin, bookId, seniorId, chapterId, dallePrompt, totalCount)

      return new Response(
        JSON.stringify({ message: '표지 1장 추가 생성 완료', extra_count: extraCount + 1, extra_limit: EXTRA_COVER_LIMIT }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── batch 모드: 최초 3장 생성 ────────────────────────────────────────────

    // idempotent 체크: 이미 생성됐으면 skip
    const [{ data: existingCovers }, { data: doneJobs }] = await Promise.all([
      supabaseAdmin.from('cover_images').select('id').eq('book_id', bookId).limit(1),
      supabaseAdmin.from('book_generation_jobs')
        .select('id').eq('book_id', bookId).eq('status', 'done').limit(1),
    ])

    if ((existingCovers?.length ?? 0) > 0 || (doneJobs?.length ?? 0) > 0) {
      console.log(`[generate-cover] 이미 생성된 표지가 있어 skip (book_id: ${bookId})`)
      return new Response(
        JSON.stringify({ message: 'already generated' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // job_id 조회 (book_id로 cover_requested 상태 job 탐색)
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('book_generation_jobs')
      .select('id')
      .eq('book_id', bookId)
      .eq('status', 'cover_requested')
      .single()

    if (jobErr || !job) {
      console.error(`[generate-cover] cover_requested 상태 job 없음 (book_id: ${bookId})`, jobErr)
      return new Response(
        JSON.stringify({ error: 'cover_requested 상태 job을 찾을 수 없습니다' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const jobId = job.id

    // 챕터 조회 (최대 3개, 챕터별 1:1 표지 생성)
    const { data: chapters, error: chaptersErr } = await supabaseAdmin
      .from('chapters')
      .select('id, title, theme, content, sort_order')
      .eq('book_id', bookId)
      .eq('is_deleted', false)
      .order('sort_order')
      .limit(COVER_COUNT)

    if (chaptersErr || !chapters || chapters.length === 0) {
      console.error(`[generate-cover] 챕터 조회 실패 (book_id: ${bookId})`, chaptersErr)
      await supabaseAdmin
        .from('book_generation_jobs')
        .update({ status: 'failed', error_log: '챕터 조회 실패' })
        .eq('id', jobId)
      return new Response(
        JSON.stringify({ error: '챕터 조회 실패' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 저자 프로필 조회 (성별·나이 — 없어도 진행)
    let gender: string | null = null
    let age: number | null = null
    try {
      const { data: profile } = await supabaseAdmin
        .from('senior_profiles')
        .select('gender, birth_date')
        .eq('id', seniorId)
        .single()
      if (profile) {
        gender = profile.gender ?? null
        if (profile.birth_date) {
          age = new Date().getFullYear() - new Date(profile.birth_date).getFullYear()
        }
      }
    } catch { /* 프로필 없으면 기본값으로 진행 */ }

    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })

    // 챕터별 순차 생성 (DALL-E rate limit 고려)
    console.log(`[generate-cover] 챕터별 표지 생성 시작 (${chapters.length}장, book_id: ${bookId})`)
    let successCount = 0
    const errorLogs: string[] = []

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i] as Chapter
      try {
        const dallePrompt = buildDallePrompt(chapter, gender, age)
        await generateAndUploadCover(openai, supabaseAdmin, bookId, seniorId, chapter.id, dallePrompt, i)
        successCount++
      } catch (err) {
        const msg = `chapter ${chapter.id} (${chapter.title}): ${String(err)}`
        console.error(`[generate-cover] DALL-E 오류 — ${msg}`)
        errorLogs.push(msg)
      }
    }

    if (successCount === 0) {
      const errorLog = errorLogs.join(' | ')
      await supabaseAdmin
        .from('book_generation_jobs')
        .update({ status: 'failed', error_log: `[generate-cover] 전체 실패: ${errorLog}` })
        .eq('id', jobId)

      return new Response(
        JSON.stringify({ error: '표지 생성 전체 실패', details: errorLog }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    await supabaseAdmin
      .from('book_generation_jobs')
      .update({ status: 'done' })
      .eq('id', jobId)

    await supabaseAdmin
      .from('books')
      .update({ status: 'editing' })
      .eq('id', bookId)

    const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
      recipient_id: seniorId,
      type: 'book_draft_ready',
      title: '이달의 책이 준비됐어요!',
      body: '표지를 골라보세요.',
      reference_id: bookId,
      reference_type: 'book',
    })

    if (notifErr) {
      console.error(`[generate-cover] 알림 발송 실패 (job: ${jobId})`, notifErr)
    }

    console.log(`[generate-cover] 완료 — ${successCount}/${COVER_COUNT}장 생성 (book_id: ${bookId})`)

    return new Response(
      JSON.stringify({ message: '표지 생성 완료', success_count: successCount }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('[generate-cover] 예상치 못한 오류:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
