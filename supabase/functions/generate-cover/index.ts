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
const IMAGE_SIZE = '1024x1536'   // 책 표지 2:3 세로 비율 — 상단 여백 확보용
const BUCKET = 'book-covers'     // Supabase Storage 버킷명
// gpt-5.4-mini는 추론 모델 — max_completion_tokens는 추론 토큰 + 실제 JSON 출력(~300토큰)을
// 합산해 소비함. 추론 토큰이 출력 예산을 잠식하지 않도록 넉넉히 확보
const SCENE_LAYOUT_MAX_TOKENS = 4000

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

// ─── 씬 레이아웃 타입 (LLM Blueprint 패턴) ───────────────────────────────────
// GPT-4o mini가 출력하는 구조화된 씬 정보
interface SceneLayout {
  background: string          // 구체적 장소·시대·날씨·빛 방향
  foreground_objects: Array<{
    object: string            // 인물 또는 사물
    age_description: string  // 해당 씬 시점 기준 나이 묘사 (e.g. "man in his late 20s", "boy around 8")
    position: string          // 화면 내 위치 (lower-left, center, etc.)
    action: string            // 구체적 동작 또는 자세
  }>
  lighting: string            // 빛의 성질·방향·분위기
  mood: string                // 감정 톤 1단어 (English)
  selected_scene_reason: string  // 이 씬을 선택한 이유 (디버깅용)
}

// ─── 헬퍼: 3단계 씬 파이프라인 ───────────────────────────────────────────────
//
// [Step 1] 챕터 전체 내용 분석 → 시각화 후보 3개 추출
//   기준: 감정 강도 / 시각적 구체성(장소·사물·행동) / 인물 관계 표현
//
// [Step 2] 후보 중 gpt-image-2 수채화로 가장 임팩트 있을 1개 선택
//   + LLM Blueprint 방식으로 레이아웃 JSON 구조화 출력
//
// [Step 3] JSON → buildDallePrompt()로 최종 프롬프트 조립
//
// 이전 방식 문제:
//   - 챕터 앞 300자만 입력 → 핵심 장면 누락 가능
//   - 씬 후보 선택 없음 → "혼자 먼 곳 바라보기" 패턴 수렴
//   - 구조 없음 → 배경·인물 배치가 모델 임의 결정
async function generateSceneLayout(
  openai: OpenAI,
  chapter: Chapter,
  genderLabel: string,
  ageLabel: string,
): Promise<SceneLayout | null> {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert art director for a Korean senior memoir publishing house.
Your task is a two-step process to select and describe the BEST scene from a chapter for a watercolor book cover.

[Step 1 — Extract 3 candidate scenes]
Read the FULL chapter content carefully. Identify 3 specific moments that would make great book cover images.
Score each candidate on:
- Emotional intensity (joy, longing, warmth, pride — NOT vague nostalgia)
- Visual specificity (concrete place, object, action — NOT abstract feelings)
- Relationship expression (are other people involved? interaction is better than solitude)

[Step 2 — Select best scene and output layout JSON]
Choose the candidate with the highest total score.
Then output a layout JSON with this exact structure — no markdown, no explanation, ONLY the JSON object:

{
  "background": "<specific location, era, time of day, weather, light direction>",
  "foreground_objects": [
    { "object": "<who or what>", "age_description": "<age at the time of THIS scene — e.g. 'man in his late 20s', 'boy around 8', 'middle-aged woman in her 40s', 'elderly man in his 70s'>", "position": "<lower-center / left / right / etc.>", "action": "<concrete physical action>" },
    { "object": "<optional second figure or key prop>", "age_description": "<age at the time of THIS scene>", "position": "<position>", "action": "<action>" }
  ],
  "lighting": "<quality and direction of light — e.g. warm afternoon sunlight streaming through window>",
  "mood": "<single English word — e.g. joy / warmth / longing / pride>",
  "selected_scene_reason": "<one sentence: why this scene beats the other two>"
}

[CRITICAL — Age and Era Rules]
BEFORE describing any character, follow these three steps:

STEP A — Determine WHEN the scene takes place:
- PAST MEMORY signals: 어릴 때, 그 시절, 옛날, 어린 시절, 그때, 보릿고개, 젊었을 때, 학교 다닐 때, 6·25, 피난, 전쟁, 예전에, 고향에서, 신혼, 신혼여행, 결혼, 결혼식, 군대, 입대, 대학, 학창시절, 취직, 사회 초년생, 청년, 젊을 때, 그 무렵, 당시, ~살 때, ~년에
- PRESENT signals: 요즘, 매일, 오늘, 지금, 요즈음, 가보려 한다
- If no clear signal, default to PRESENT

STEP B — For EVERY person in the scene, infer their age AT THAT POINT IN TIME and write it in "age_description":
- Use explicit clues: "아들이 초등학교 다닐 때" → son ~8, narrator ~30s
- Use life-event clues: "신혼여행" → narrator and spouse both ~20s–30s
- Use relationship math: if narrator is in their 20s, their child cannot be a teenager
- PAST MEMORY defaults (when no explicit clue): narrator = young adult (20s–40s), family members at proportionally younger ages
- PRESENT defaults: narrator = ${ageLabel} ${genderLabel}, adult son = middle-aged, grandchild = child or teen
- Elderly descriptions ("elderly", "old", "aged") are ONLY appropriate when the scene is in the present day or the character is genuinely old in that memory

STEP C — Match background era to the time period:
- Pre-1990 memories: thatched-roof or tile-roof houses, dirt roads, traditional Korean village, period clothing — NO modern buildings or devices
- 1990s–2000s: modern but dated setting
- Present: contemporary Korean setting

STORYTELLING TO OTHERS — if the chapter describes telling a past story to grandchildren/family:
→ Show the PAST SCENE being described (the memory itself), NOT the act of telling

Rules for foreground_objects:
- The protagonist is a ${genderLabel}.
- If the chapter mentions another person (spouse, child, grandchild, friend, colleague), INCLUDE them.
- Actions must be concrete and specific: "handing a letter", "lifting a child", "sharing kimbap", "shaking hands", "cooking together" — NEVER "looking away" or "gazing nostalgically".
- Position protagonist in the lower 60% of frame to leave upper 30% as open sky or soft background for title text.`,
        },
        {
          role: 'user',
          // 전체 챕터 내용 전달 (이전: 앞 300자만)
          content: `Chapter title: ${chapter.title}\nChapter content (full):\n${chapter.content}`,
        },
      ],
      // gpt-5.4-mini는 GPT-5 계열 추론 모델 — OpenAI API가 max_tokens와
      // temperature 커스텀값을 거부함. max_completion_tokens를 쓰고, temperature는
      // 기본값(1)만 허용되므로 생략한다. (generate-book이 멀쩡한 건 AI SDK가
      // 이 보정을 자동 처리하기 때문 — raw SDK는 파라미터를 그대로 전달함)
      max_completion_tokens: SCENE_LAYOUT_MAX_TOKENS,
      response_format: { type: 'json_object' },
    })

    const raw = res.choices[0]?.message?.content?.trim()
    if (!raw) {
      console.error('[generate-cover] SceneLayout — 응답 content 없음 (finish_reason:', res.choices[0]?.finish_reason, ')')
      return null
    }
    return JSON.parse(raw) as SceneLayout
  } catch (e) {
    // OpenAI API 에러·JSON 파싱 실패 모두 여기로 — 실제 메시지를 남겨 원인 추적
    const detail = (e instanceof Error) ? e.message : String(e)
    console.error('[generate-cover] SceneLayout 생성 실패:', detail)
    return null
  }
}

// ─── 헬퍼: SceneLayout JSON → gpt-image-2 프롬프트 조립 ─────────────────────
// LLM Blueprint 방식: 구조화된 레이아웃을 자연어 프롬프트로 변환
// subject → lighting → composition → style → constraints 순서 (OpenAI Cookbook 권장)
function buildDallePrompt(
  layout: SceneLayout,
  palette: string,
): string {
  // foreground_objects를 자연어로 조립 — age_description을 앞에 붙여 나이가 이미지에 반영되도록 함
  const subjects = layout.foreground_objects
    .map(o => `${o.age_description} ${o.object} (${o.position}): ${o.action}`)
    .join('; ')

  return [
    // 1. 장르·용도 선언
    `A beautiful watercolor book cover illustration for a Korean senior memoir.`,
    // 2. 배경 (구체적 장소·시대·빛)
    `Background: ${layout.background}.`,
    // 3. 인물·오브젝트 (위치+동작 명시)
    `Foreground: ${subjects}.`,
    // 4. 조명
    `Lighting: ${layout.lighting}.`,
    // 5. 감정 톤
    `Overall mood: ${layout.mood}.`,
    // 6. 레이아웃 — 상단 여백 (제목 텍스트용)
    `Composition: subjects placed in the lower 60% of the frame; upper 30% is open sky, soft bokeh, or minimal background to leave space for title text overlay.`,
    // 7. 스타일 (재질·기법 명시로 실제 수채화 느낌 유도)
    `Style: hand-painted watercolor illustration, soft cold-pressed paper texture, visible brushwork at edges, translucent color washes, gentle ink outline.`,
    `Warm light, clear and luminous colors, not gloomy or dark, not overly saturated.`,
    `Think Korean literary novel cover art or Japanese watercolor picture book with gentle brightness.`,
    `NOT photorealistic, NOT manga, NOT comic book style.`,
    `Faces may appear but should be soft and impressionistic — no hyper-realistic facial features.`,
    // 8. 색 팔레트
    `Color palette: ${palette} — bright, airy, emotionally warm. Avoid dark or muddy tones.`,
    // 9. 절대 금지
    `Absolutely NO text, NO letters, NO numbers, NO watermarks anywhere in the image.`,
  ].join(' ')
}


// ─── 헬퍼: 이미지 1장 생성 + Storage 업로드 + cover_images upsert ─────────────
// rate limit(429) 시 최대 3회까지 재시도 (60초 대기)
const IMAGE_GEN_MAX_RETRIES = 3
const RATE_LIMIT_WAIT_MS = 65_000  // 429 에러 후 65초 대기 (분당 5개 제한 리셋)

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
  // rate limit(429) 발생 시 65초 대기 후 재시도
  let imageRes: Awaited<ReturnType<typeof openai.images.generate>> | null = null
  for (let attempt = 1; attempt <= IMAGE_GEN_MAX_RETRIES; attempt++) {
    try {
      imageRes = await openai.images.generate({
        model: 'gpt-image-2',
        prompt: dallePrompt,
        n: 1,
        size: IMAGE_SIZE,
        quality: 'low',  // low: 3~8초, medium: 20~40초 — 퀄리티 테스트 후 결정
      })
      break  // 성공 시 루프 탈출
    } catch (err: unknown) {
      const msg = String(err)
      const is429 = msg.includes('429') || msg.includes('Rate limit')
      if (is429 && attempt < IMAGE_GEN_MAX_RETRIES) {
        console.warn(`[generate-cover] rate limit 429 — ${RATE_LIMIT_WAIT_MS / 1000}초 대기 후 재시도 (${attempt}/${IMAGE_GEN_MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, RATE_LIMIT_WAIT_MS))
        continue
      }
      throw err  // 429 아닌 에러 또는 최대 재시도 초과 시 즉시 throw
    }
  }
  if (!imageRes) throw new Error(`gpt-image-2 이미지 생성 실패 (최대 재시도 초과, index ${index})`)
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
      const genderLabel = gender === 'male' ? 'male' : 'female'
      const ageLabel = age ? `${Math.floor(age / 10) * 10}s` : 'elderly'
      const palette = gender ? (GENDER_PALETTE[gender] ?? GENDER_PALETTE['female']) : GENDER_PALETTE['female']

      // 이미지 생성·업로드 실패 시 job을 failed로 마킹해 영구 limbo 방지
      try {
        const layout = await generateSceneLayout(openai, chapter as Chapter, genderLabel, ageLabel)
        if (!layout) throw new Error('SceneLayout 생성 실패')
        const dallePrompt = buildDallePrompt(layout, palette)

        console.log(`[generate-cover] batch_single — chapter ${chapterId} (${chapter.title}) 선택 이유: ${layout.selected_scene_reason}`)
        console.log(`[generate-cover] batch_single — mood: ${layout.mood}, layout:`, JSON.stringify(layout.foreground_objects))
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

      const genderLabel = gender === 'male' ? 'male' : 'female'
      const ageLabel = age ? `${Math.floor(age / 10) * 10}s` : 'elderly'
      const palette = gender ? (GENDER_PALETTE[gender] ?? GENDER_PALETTE['female']) : GENDER_PALETTE['female']

      // 동기 실행 — waitUntil은 Supabase Edge Runtime에서 응답 후 즉시 종료되어 동작하지 않음
      // 실패 시 500을 반환해 프론트엔드가 즉시 에러를 인지하도록 함
      const layout = await generateSceneLayout(openai, chapter as Chapter, genderLabel, ageLabel)
      if (!layout) {
        console.error('[generate-cover] single 모드 — SceneLayout 생성 실패')
        return new Response(
          JSON.stringify({ error: 'SceneLayout 생성에 실패했습니다' }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      const dallePrompt = buildDallePrompt(layout, palette)
      console.log(`[generate-cover] single 모드 — 챕터 재생성 (chapter_id: ${chapterId}, extra: ${extraCount + 1}/${EXTRA_COVER_LIMIT})`)
      console.log(`[generate-cover] 선택 씬 이유: ${layout.selected_scene_reason}, mood: ${layout.mood}`)
      await generateAndUploadCover(openai, supabaseAdmin, bookId, seniorId, chapterId, dallePrompt, totalCount)
      console.log(`[generate-cover] single 모드 — 생성 완료 (chapter_id: ${chapterId})`)

      return new Response(
        JSON.stringify({ message: '표지 생성 완료', extra_count: extraCount + 1, extra_limit: EXTRA_COVER_LIMIT }),
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

    const genderLabel = gender === 'male' ? 'male' : 'female'
    const ageLabel = age ? `${Math.floor(age / 10) * 10}s` : 'elderly'
    const palette = gender ? (GENDER_PALETTE[gender] ?? GENDER_PALETTE['female']) : GENDER_PALETTE['female']

    // GPT-4o mini로 챕터별 씬 묘사 병렬 생성 — 각 챕터 내용에 맞는 구체적 장면 결정
    console.log(`[generate-cover] 챕터별 씬 묘사 생성 시작 (${(chapters as Chapter[]).length}개)`)
    // 챕터별 씬 레이아웃 병렬 생성 (GPT-4o mini — 빠름)
    console.log(`[generate-cover] 챕터별 씬 레이아웃 생성 시작 (${(chapters as Chapter[]).length}개)`)
    const chaptersWithLayout = await Promise.all(
      (chapters as Chapter[]).map(async (chapter) => {
        const layout = await generateSceneLayout(openai, chapter, genderLabel, ageLabel)
        console.log(`[generate-cover] 챕터 "${chapter.title}" — 선택 이유: ${layout?.selected_scene_reason ?? '실패'}, mood: ${layout?.mood ?? '-'}`)
        return { chapter, layout }
      }),
    )

    // 챕터별 표지 병렬 생성 — gpt-image-2 장당 ~50s, Promise.allSettled로 병렬 처리
    console.log(`[generate-cover] 챕터별 표지 병렬 생성 시작 (${(chapters as Chapter[]).length}장, book_id: ${bookId})`)

    const results = await Promise.allSettled(
      chaptersWithLayout.map(({ chapter, layout }, i) => {
        if (!layout) return Promise.reject(new Error(`chapter ${chapter.id} SceneLayout 생성 실패`))
        const dallePrompt = buildDallePrompt(layout, palette)
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
