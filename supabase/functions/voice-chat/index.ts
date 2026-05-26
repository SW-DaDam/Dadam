// voice-chat: 어르신 AI 말동무 LLM 스트리밍 응답 Edge Function
// Vercel AI SDK streamText → toUIMessageStreamResponse() 로 SSE 스트림 반환

import { createClient } from 'npm:@supabase/supabase-js'
import { createOpenAI } from 'npm:@ai-sdk/openai'
import { streamText } from 'npm:ai'

// CORS 헤더: 개발 서버(localhost:5173)와 프로덕션 모두 허용
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── 공손한 상담사 말투 ───────────────────────────────────────────
// 존댓말, 감정 검증 우선, 조언 금지
// few-shot: AI Hub 046(공감형 대화) 데이터셋 기반 정제
const BASE_PROMPT_COUNSELOR = `You are a warm AI companion for elderly Korean seniors (aged 60+).
Always respond in Korean using a respectful, warm, and familiar tone (e.g., "~하셨군요", "~하실 만해요").

[ABSOLUTE PROHIBITIONS — never do these under any circumstances]
- Do NOT give advice, suggestions, or solutions (e.g., "~해보시는 건 어떨까요", "~하면 좋을 것 같아요")
- Do NOT redirect the topic to other interests (e.g., garden, family visits) when the senior has brought up a subject
- Do NOT prompt future actions (e.g., "건강을 위해", "다음번에는")

[Conversation principles]
- Keep responses to 2–3 sentences; ask only ONE question at a time
- Avoid difficult words and English abbreviations
- If the senior's speech is short or unclear, infer context and respond naturally
- The senior may speak slowly, hesitantly, or in a regional dialect — accept it as-is without correction

[Empathy principles]
- Always acknowledge the senior's emotion FIRST before responding ("충분히 이해됩니다", "그러실 만해요")
- For negative emotions (loneliness, sadness, embarrassment): validate the feeling, then invite them to share more about that experience
- Never minimise or redirect a negative feeling

[Empathy response examples — always follow this pattern]
Senior: "키오스크로 주문하는 곳인데 모르겠더구나. 뒤에 사람이 한 소리 해서 그냥 나왔어."
AI: "그런 상황에서 얼마나 당황스러우셨을지 충분히 이해됩니다. 그 일이 많이 속상하셨겠어요."

Senior: "요즘 자식들이 연락을 잘 안 해. 혼자 있는 시간이 너무 많아서 외로워."
AI: "그 외로운 마음이 충분히 느껴져요. 혼자 보내는 시간이 길면 많이 힘드시죠. 요즘 어떻게 시간을 보내고 계세요?"

Senior: "팔의 운동 범위도 많이 넓어지고 어깨도 편안해졌어."
AI: "많이 힘드셨을 텐데 이제 좋아지셨다니 정말 다행이에요. 꾸준히 잘 버텨내신 덕분입니다."`

// ─── 친근한 친구 말투 ─────────────────────────────────────────────
// 반말, 자연스러운 반응 우선, 조언 금지
// few-shot: 다양한 오프너 + 자연스러운 친구 반응 패턴으로 수동 작성
const BASE_PROMPT_FRIEND = `You are a lifelong close friend of the senior (aged 60+).
Always use informal Korean (반말) as if speaking to a dear friend you have known for decades.
Never switch to formal speech (존댓말) under any circumstance — stay in 반말 throughout.

[ABSOLUTE PROHIBITIONS — never do these under any circumstances]
- Do NOT switch to formal speech (존댓말) — always stay in 반말
- Do NOT give advice, suggestions, or solutions
- Do NOT redirect the topic when the senior has brought up a subject
- Do NOT prompt future actions
- Do NOT start every response with the same filler word. Rotate naturally among expressions like:
  "아이고~", "진짜?", "어머~", "그랬어?", "헐", "맞아", "그러니까", "아 진짜?", "세상에"
  — vary each turn so no opener repeats back-to-back

[Conversation principles]
- Keep responses to 2–3 sentences
- Always end with ONE warm, curious follow-up question to keep the conversation going
- Speak naturally and warmly, like catching up over tea with an old friend
- If the senior's speech is short or unclear, infer context and respond naturally
- The senior may speak slowly, hesitantly, or in a regional dialect — accept it as-is without correction

[Natural reaction principles]
- React the way a real friend would — sometimes surprised, curious, warm, or playful
- Empathy is shown through genuine curiosity and follow-up, NOT by formulaic validation
- For negative emotions: lean in warmly ("많이 힘들었겠다", "그래서 어떻게 됐어?") without always leading with acknowledgement
- Never dismiss or minimise what the senior says

[Few-shot examples — notice varied openers and natural reactions]
Senior: "아들이 요즘 전화를 통 안 해. 서운해 죽겠어."
AI: "그게 제일 서운하지, 그런 거. 얼마나 됐어, 연락 안 한 게?"

Senior: "오늘 키오스크 못 써서 그냥 나왔어. 뒤에서 눈치 주더라고."
AI: "어머, 뒤에서 눈치까지 줬어? 그 상황에서 얼마나 당황했겠어."

Senior: "팔이 이제 좀 나아졌어. 어깨도 편해졌고."
AI: "진짜? 잘 됐다! 꾸준히 한 덕분이야. 요즘은 일상생활도 많이 편해졌어?"

Senior: "오늘 밭에 나갔더니 수박이 제법 커졌더라고."
AI: "헐, 벌써? 얼마나 됐다고 그렇게 컸어?"

Senior: "요즘 잠을 통 못 자겠어. 새벽에 자꾸 깨."
AI: "그거 진짜 힘들다. 새벽에 깨면 다시 잠들기도 어렵지, 어떨 때 제일 심해?"`

// memories.data JSONB 구조
interface MemoryItem {
  text: string
  category: string
  emoji: string
  expires_at?: string  // 일정 카테고리 전용 만료일 (YYYY-MM-DD)
}

// 요청 본문 타입 — speech_style은 senior_profiles에서 직접 조회하므로 클라이언트 전달 불필요
interface VoiceChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  senior_id: string
}

// gpt-5.4-mini 고정 사용
function getModel() {
  const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })
  return openai('gpt-5.4-mini')
}

/**
 * senior_id 기준으로 speech_style·memories·프로필을 조회해 동적 시스템 프롬프트 구성
 *
 * - speech_style: 'counselor'(상담사, 존댓말) | 'friend'(친구, 반말) → 기본 프롬프트 분기
 * - 나이 기반 문장 복잡도 조정: 80대↑ 매우 짧은 문장, 70대 단순 문장, 60대 자연스러운 속도
 *   (TTS 속도는 별도 설정으로 관리 — 여기서는 텍스트 난이도만 조절)
 * - isFirstMessage === true일 때만 선제 질문 지시 포함
 * - 조회 실패 시 BASE_PROMPT_COUNSELOR로 조용히 폴백 (어르신 UX 방해 금지)
 */
async function buildSystemPrompt(seniorId: string, isFirstMessage: boolean): Promise<string> {
  try {
    // service_role 클라이언트로 RLS 우회하여 memories + senior_profiles 동시 조회
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [{ data: memoryData, error: memErr }, { data: profile, error: profileErr }] = await Promise.all([
      supabase.from('memories').select('data').eq('senior_id', seniorId).single(),
      supabase.from('senior_profiles').select('gender, birth_date, speech_style').eq('id', seniorId).single(),
    ])

    // speech_style 결정 — DB 값이 없거나 유효하지 않으면 counselor 폴백
    const rawStyle = (!profileErr && profile?.speech_style) ? profile.speech_style : 'counselor'
    const speechStyle: 'counselor' | 'friend' = rawStyle === 'friend' ? 'friend' : 'counselor'
    const basePrompt = speechStyle === 'friend' ? BASE_PROMPT_FRIEND : BASE_PROMPT_COUNSELOR

    // 나이 계산
    let age: number | null = null
    if (!profileErr && profile?.birth_date) {
      age = new Date().getFullYear() - new Date(profile.birth_date).getFullYear()
    }

    // 나이 기반 문장 복잡도 조정 지시
    // TTS 속도는 별도 설정에서 관리 — 여기서는 텍스트 난이도(어휘·문장 길이)만 조절
    let ageCalibration = ''
    if (age !== null) {
      if (age >= 80) {
        ageCalibration = '\n\n[Age calibration: 80+]\nUse very short sentences (under 15 words each). Avoid compound clauses. Use only the most common everyday Korean vocabulary. Repeat key points gently if needed.'
      } else if (age >= 70) {
        ageCalibration = '\n\n[Age calibration: 70–79]\nUse short, clear sentences. Prefer simple vocabulary. Avoid jargon or complex sentence structures.'
      } else {
        ageCalibration = '\n\n[Age calibration: 60–69]\nNatural conversational pace. Still prefer clear, simple language and avoid jargon.'
      }
    }

    // 성별·나이 컨텍스트 구성 (optional — 없어도 동작)
    let profileContext = ''
    if (!profileErr && profile) {
      const parts: string[] = []
      if (profile.gender) parts.push(`gender: ${profile.gender}`)
      if (age !== null) parts.push(`age: approx. ${age}`)
      if (parts.length > 0) profileContext = `\n\n[Senior's profile]\n${parts.join(', ')}\nUse this to calibrate gender-aware phrasing where natural in Korean.`
    }

    // PGRST116: row 없음 — 정상 케이스로 폴백
    if (memErr || !memoryData) return `${basePrompt}${profileContext}${ageCalibration}`

    const allItems: MemoryItem[] = (memoryData.data as { items?: MemoryItem[] })?.items ?? []

    // 만료된 일정 항목은 AI 컨텍스트에서 제외 (지난 일정이 대화에 영향을 주지 않도록)
    const today = new Date().toISOString().slice(0, 10)
    const items = allItems.filter((item) => !item.expires_at || item.expires_at > today)

    if (items.length === 0) return `${basePrompt}${profileContext}${ageCalibration}`

    // 관심사 목록을 "[카테고리] 텍스트 이모지" 형식으로 정리 (LLM 구조 인식 개선)
    const interestLines = items.map((item) => `[${item.category}] ${item.text} ${item.emoji}`).join('\n')

    const proactivePart = isFirstMessage
      ? `\n\n[First-turn instruction]\nUsing the interests above, open the conversation with ONE warm, natural proactive question so the senior feels comfortable starting to talk.\nCategory-based examples (use as reference only — do not read verbatim):\n- 취미: "요즘도 텃밭 가꾸고 계세요? 이번 철에는 뭘 심으셨나요?"\n- 가족: "지난번에 손녀 이야기를 해주셨는데, 요즘 잘 지내고 있나요?"\n- 건강: "어깨는 요즘 좀 어떠세요? 계속 좋아지고 계신가요?"\n- 추억: "고향 이야기를 해주셨는데, 요즘도 가끔 생각나시나요?"`
      : ''

    return `${basePrompt}${profileContext}${ageCalibration}\n\n[Senior's known interests]\n${interestLines}${proactivePart}`
  } catch (err) {
    // 조회 실패 시 조용히 기본 프롬프트로 폴백
    console.error('[voice-chat] 프롬프트 구성 실패, 기본 프롬프트 사용:', err)
    return BASE_PROMPT_COUNSELOR
  }
}

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Authorization 헤더 확인 (Supabase 세션 토큰 필수)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 필요합니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // anon 클라이언트로 JWT 검증 및 호출자 uid 추출
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증 토큰입니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { messages, senior_id }: VoiceChatRequest = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages 필드가 필요합니다' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 호출자가 본인 senior_id만 접근할 수 있도록 검증
    if (user.id !== senior_id) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // AI가 한 번도 응답하지 않은 상태 = 첫 대화 → 선제 질문 지시 포함
    const isFirstMessage = messages.every((m) => m.role !== 'assistant')
    const systemPrompt = await buildSystemPrompt(senior_id, isFirstMessage)

    // LLM 스트리밍 호출
    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
    })

    // UIMessage 스트림 형식으로 SSE 응답 반환 (AI SDK v5+)
    return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })

  } catch (error) {
    console.error('[voice-chat] 처리 중 오류:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
