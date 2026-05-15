// generate-cover: gpt-image-2로 책 표지를 챕터 수만큼 생성 후 book-covers 버킷 저장
// 트리거: generate-book의 chaptering 완료 후 내부 호출
// 인증: service_role JWT 필수
// 참고: DALL-E 2/3는 2026-05-12 deprecated → gpt-image-1 → gpt-image-2(2026-04-21 출시)

import { createClient } from 'npm:@supabase/supabase-js'
import OpenAI from 'npm:openai'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXTRA_COVER_LIMIT = 3      // 사용자가 추가로 생성할 수 있는 최대 표지 수 (챕터 수 기준 초과분)
const IMAGE_SIZE = '1024x1024'   // gpt-image-2 지원 크기: 1024x1024 | 1536x1024 | 1024x1536
const BUCKET = 'book-covers'     // Supabase Storage 버킷명

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface GenerateCoverRequest {
  book_id: string      // 대상 책 UUID
  senior_id: string    // 어르신 UUID (Storage 경로용)
  mode?: 'batch' | 'single' | 'batch_single'
  // batch: 구버전 호환용 (전체 챕터 — Webhook 방식, 현재 미사용)
  // batch_single: 챕터 1개씩 개별 호출 (generate-book → pg_net, 타임아웃 방지)
  // single: 사용자가 직접 1장 추가 재생성 (anon 인증)
  chapter_id?: string  // batch_single / single 모드 전용: 처리할 챕터 UUID
}

interface Chapter {
  id: string
  title: string
  theme: string
  content: string
  sort_order: number
}

// 성별별 색조 팔레트 — 밝고 화사하되 쨍하지 않은 봄날 느낌
const GENDER_PALETTE: Record<string, string> = {
  female: 'soft coral pink, warm peach, light sage green, gentle lavender, creamy white',
  male: 'clear sky blue, warm amber, fresh olive green, soft teal, light sandy beige',
}

// ─── 헬퍼: GPT-4o mini로 챕터 내용 기반 구체적 이미지 씬 생성 ─────────────────
// 챕터 내용을 분석해 "어떤 장면을 그릴지" 자체를 GPT-4o mini가 결정하도록 위임
// gpt-image-2에는 씬 묘사 + 스타일 지시만 넘겨 내용 반영도를 높임
async function generateSceneDescription(
  openai: OpenAI,
  chapter: Chapter,
  genderLabel: string,
  ageLabel: string,
): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: [
            'You are an art director creating book cover scene descriptions for a Korean senior memoir.',
            'Given a chapter title and content (in Korean), describe ONE specific visual scene in English that captures the essence of the story.',
            'Rules:',
            '- The scene must be directly tied to the specific story content — not generic.',
            `- Include ONE ${ageLabel} ${genderLabel} figure naturally placed in the scene. Choose the most fitting pose and angle — side view, looking away, sitting, walking, standing, etc. No need to show the back only.`,
            '- The scene can be indoors or outdoors depending on the story (a bakery interior, a stream, a village alley, etc.).',
            '- Write only the scene description in 2-3 sentences. No explanation, no title, no style instructions.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Chapter title: ${chapter.title}\nChapter content: ${chapter.content.slice(0, 300)}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    })
    return res.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    return ''
  }
}

// ─── 헬퍼: 챕터별 이미지 프롬프트 구성 ──────────────────────────────────────
// - GPT-4o mini가 생성한 씬 묘사를 중심으로 프롬프트 구성
// - 스타일·색감·금지 지시는 고정 래퍼로 감쌈

function buildDallePrompt(
  sceneDescription: string,
  palette: string,
): string {
  return `A beautiful illustrated book cover for a Korean senior memoir. ` +
    `Scene: ${sceneDescription} ` +
    `Style: bright and cheerful watercolor illustration — warm light, clear and luminous colors, ` +
    `not gloomy or dark, not overly saturated or garish. ` +
    `Think Korean literary novel cover art or Japanese watercolor picture book with a gentle brightness. ` +
    `NOT photorealistic, NOT manga, NOT comic book style. ` +
    `Faces may appear but should be soft and impressionistic — no hyper-realistic or detailed facial features. ` +
    `Color palette: ${palette} — bright, airy, and emotionally warm. Avoid dark or muddy tones. ` +
    `Absolutely NO text, NO letters, NO numbers anywhere in the image. ` +
    `High quality publishing-grade illustration.`
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
  // gpt-image-2는 n=1 고정 — 3장은 반드시 3회 별도 호출 필요
  // response_format 파라미터 없음 — 항상 b64_json으로 반환
  const imageRes = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: dallePrompt,
    n: 1,
    size: IMAGE_SIZE,
  })

  const b64 = imageRes.data[0]?.b64_json
  if (!b64) throw new Error(`gpt-image-2 응답에 b64_json 없음 (index ${index})`)

  // base64 → Uint8Array 변환 (fetch URL 다운로드 불필요)
  const imageBuffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

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

  console.log(`[generate-cover] 표지 ${index + 1} 생성 완료 (gpt-image-2) — chapter ${chapterId}`)
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

    if (mode === 'batch' || mode === 'batch_single') {
      // batch / batch_single 모드: X-Internal-Secret으로 내부 호출 인증
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

    // ── batch_single 모드: 챕터 1개 처리 (generate-book → pg_net 개별 호출) ──────
    // 전체 챕터를 한 번에 처리하면 150s 타임아웃 초과 → 챕터마다 독립 호출로 변경
    if (mode === 'batch_single') {
      const { chapter_id: chapterId } = body
      if (!chapterId) {
        return new Response(
          JSON.stringify({ error: 'batch_single 모드는 chapter_id가 필요합니다' }),
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

      // 저자 프로필 조회
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
      const genderLabel = gender === 'male' ? 'male elderly' : 'female elderly'
      const ageLabel = age ? `${Math.floor(age / 10) * 10}s` : 'elderly'
      const palette = gender ? (GENDER_PALETTE[gender] ?? GENDER_PALETTE['female']) : GENDER_PALETTE['female']

      // 이미지 생성·업로드 실패 시 job을 failed로 마킹해 영구 limbo 방지
      try {
        const sceneDescription = await generateSceneDescription(openai, chapter as Chapter, genderLabel, ageLabel)
        const dallePrompt = buildDallePrompt(sceneDescription, palette)

        console.log(`[generate-cover] batch_single — chapter ${chapterId} (${chapter.title}) 씬: ${sceneDescription}`)
        await generateAndUploadCover(openai, supabaseAdmin, bookId, seniorId, chapterId, dallePrompt, chapter.sort_order - 1)
      } catch (genErr) {
        console.error(`[generate-cover] batch_single 실패 — chapter ${chapterId}:`, genErr)

        // job을 failed로 전환해 cover_requested limbo 방지
        const { data: failedJob } = await supabaseAdmin
          .from('book_generation_jobs')
          .select('id')
          .eq('book_id', bookId)
          .eq('status', 'cover_requested')
          .maybeSingle()
        if (failedJob) {
          await supabaseAdmin
            .from('book_generation_jobs')
            .update({ status: 'failed', stage_payload: { error: String(genErr), failed_chapter_id: chapterId } })
            .eq('id', failedJob.id)
        }

        return new Response(
          JSON.stringify({ error: '표지 생성 실패', chapter_id: chapterId }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      // 모든 챕터 표지가 완성됐는지 확인 후 job/book 상태 업데이트
      const [{ data: allChapters }, { data: allCovers }] = await Promise.all([
        supabaseAdmin.from('chapters').select('id').eq('book_id', bookId).eq('is_deleted', false),
        supabaseAdmin.from('cover_images').select('id').eq('book_id', bookId).eq('status', 'candidate'),
      ])

      const totalChapters = allChapters?.length ?? 0
      const totalCovers = allCovers?.length ?? 0

      console.log(`[generate-cover] batch_single 완료 — ${totalCovers}/${totalChapters}개 표지 완성`)

      if (totalCovers >= totalChapters && totalChapters > 0) {
        // 전체 챕터 표지 완성 → job done + book editing + 알림
        const { data: job } = await supabaseAdmin
          .from('book_generation_jobs')
          .select('id')
          .eq('book_id', bookId)
          .eq('status', 'cover_requested')
          .maybeSingle()

        if (job) {
          await supabaseAdmin.from('book_generation_jobs').update({ status: 'done' }).eq('id', job.id)
        }
        await supabaseAdmin.from('books').update({ status: 'editing' }).eq('id', bookId)
        await supabaseAdmin.from('notifications').insert({
          recipient_id: seniorId,
          type: 'book_draft_ready',
          title: '이달의 책이 준비됐어요!',
          body: '표지를 골라보세요.',
          reference_id: bookId,
          reference_type: 'book',
        })
        console.log(`[generate-cover] 전체 챕터 표지 완성 → book editing, 알림 발송`)
      }

      return new Response(
        JSON.stringify({ message: '챕터 표지 생성 완료', chapter_id: chapterId, covers: `${totalCovers}/${totalChapters}` }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

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

      // 현재 candidate 표지 수 + 초기 챕터 수 조회 (초기 N장 초과분이 추가 생성분)
      const [{ data: allCovers }, { data: bookChapters }] = await Promise.all([
        supabaseAdmin.from('cover_images').select('id, created_at')
          .eq('book_id', bookId).eq('status', 'candidate').order('created_at'),
        supabaseAdmin.from('chapters').select('id')
          .eq('book_id', bookId).eq('is_deleted', false),
      ])

      const totalCount = allCovers?.length ?? 0
      const initialCoverCount = bookChapters?.length ?? 0  // 초기 표지 수 = 챕터 수
      const extraCount = Math.max(0, totalCount - initialCoverCount)

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

      const genderLabel = gender === 'male' ? 'male elderly' : 'female elderly'
      const ageLabel = age ? `${Math.floor(age / 10) * 10}s` : 'elderly'
      const palette = gender ? (GENDER_PALETTE[gender] ?? GENDER_PALETTE['female']) : GENDER_PALETTE['female']

      // GPT-4o mini로 챕터 내용 기반 구체적 씬 생성
      const sceneDescription = await generateSceneDescription(openai, chapter as Chapter, genderLabel, ageLabel)
      const dallePrompt = buildDallePrompt(sceneDescription, palette)

      console.log(`[generate-cover] single 모드 — 챕터 재생성 (chapter_id: ${chapterId}, extra: ${extraCount + 1}/${EXTRA_COVER_LIMIT})`)
      console.log(`[generate-cover] 씬 묘사: ${sceneDescription}`)
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

    // 챕터 전체 조회 — 챕터 수만큼 표지 생성 (limit 없음)
    const { data: chapters, error: chaptersErr } = await supabaseAdmin
      .from('chapters')
      .select('id, title, theme, content, sort_order')
      .eq('book_id', bookId)
      .eq('is_deleted', false)
      .order('sort_order')

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

    const genderLabel = gender === 'male' ? 'male elderly' : 'female elderly'
    const ageLabel = age ? `${Math.floor(age / 10) * 10}s` : 'elderly'
    const palette = gender ? (GENDER_PALETTE[gender] ?? GENDER_PALETTE['female']) : GENDER_PALETTE['female']

    // GPT-4o mini로 챕터별 씬 묘사 병렬 생성 — 각 챕터 내용에 맞는 구체적 장면 결정
    console.log(`[generate-cover] 챕터별 씬 묘사 생성 시작 (${(chapters as Chapter[]).length}개)`)
    const chaptersWithScene = await Promise.all(
      (chapters as Chapter[]).map(async (chapter) => {
        const sceneDescription = await generateSceneDescription(openai, chapter, genderLabel, ageLabel)
        console.log(`[generate-cover] 챕터 "${chapter.title}" 씬: ${sceneDescription}`)
        return { chapter, sceneDescription }
      }),
    )

    // 챕터별 표지 병렬 생성 — gpt-image-2 장당 ~50s, Promise.allSettled로 병렬 처리
    console.log(`[generate-cover] 챕터별 표지 병렬 생성 시작 (${(chapters as Chapter[]).length}장, book_id: ${bookId})`)

    const results = await Promise.allSettled(
      chaptersWithScene.map(({ chapter, sceneDescription }, i) => {
        const dallePrompt = buildDallePrompt(sceneDescription, palette)
        return generateAndUploadCover(openai, supabaseAdmin, bookId, seniorId, chapter.id, dallePrompt, i)
      }),
    )

    let successCount = 0
    const errorLogs: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        successCount++
      } else {
        const chapter = (chapters as Chapter[])[i]
        const msg = `chapter ${chapter.id} (${chapter.title}): ${String(result.reason)}`
        console.error(`[generate-cover] gpt-image-2 오류 — ${msg}`)
        errorLogs.push(msg)
      }
    })

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

    console.log(`[generate-cover] 완료 — ${successCount}/${chapters.length}장 생성 (book_id: ${bookId})`)

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
