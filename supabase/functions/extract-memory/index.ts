// extract-memory: 세션 종료 후 어르신 발화 → LLM 분석 → memories.data JSONB 병합 갱신
// LLM이 기존 memories 전체를 보고 통합/업데이트/추가를 직접 판단하여 최종 배열 반환
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js'
import { createOpenAI } from 'npm:@ai-sdk/openai'
import { generateText } from 'npm:ai'

// CORS 헤더: 개발 서버(localhost:5173)와 프로덕션 모두 허용
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// memories.data JSONB — items 플랫 배열 구조
interface MemoryItem {
  text: string
  category: string
  emoji: string
  expires_at?: string  // 일정 카테고리 전용 만료일 (YYYY-MM-DD)
}

interface MemoryData {
  items?: MemoryItem[]
}

// 한 기억 항목의 최대 텍스트 길이 (공백 포함)
const MAX_TEXT_LENGTH = 150

// 자연 경계(쉼표·마침표)를 우선 탐색해 텍스트를 maxLen 이하 청크로 재귀 분리
function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const separators = [', ', ',', '. ', ' ']
  for (const sep of separators) {
    const idx = text.lastIndexOf(sep, maxLen)
    if (idx > maxLen / 2) {
      const cutAt = idx + sep.length
      // sep이 maxLen 경계에 걸쳐 있으면 first가 maxLen을 초과할 수 있으므로 확인
      if (cutAt > maxLen) continue
      const first = text.slice(0, cutAt).trim()
      const rest = text.slice(cutAt).trim()
      if (first && rest) return [first, ...splitText(rest, maxLen)]
    }
  }
  // 마지막 공백에서 강제 절단
  const spaceIdx = text.lastIndexOf(' ', maxLen)
  if (spaceIdx > 0) return [text.slice(0, spaceIdx).trim(), ...splitText(text.slice(spaceIdx + 1).trim(), maxLen)]
  return [text.slice(0, maxLen), ...splitText(text.slice(maxLen), maxLen)]
}

// LLM이 150자 제한을 넘긴 항목을 후처리로 분리하는 안전망
// LLM이 올바르게 압축했다면 이 함수는 아무것도 바꾸지 않음
function enforceTextLimit(items: MemoryItem[]): MemoryItem[] {
  const result: MemoryItem[] = []
  for (const item of items) {
    if (item.text.length <= MAX_TEXT_LENGTH) {
      result.push(item)
      continue
    }
    for (const chunk of splitText(item.text, MAX_TEXT_LENGTH)) {
      result.push({ ...item, text: chunk })
    }
  }
  return result
}

// 요청 본문 타입
interface ExtractMemoryRequest {
  conversation_id: string
  senior_id: string
  consolidate_only?: boolean  // true이면 새 발화 없이 기존 기억만 STEP 1 통합
  admin_secret?: string       // 일치 시 JWT 우회 (consolidate_only 여부 무관)
}

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // 요청 본문 파싱 (auth 검증보다 먼저 — admin_secret 우회 여부 확인 필요)
    const body = await req.json() as Partial<ExtractMemoryRequest>
    const { conversation_id, senior_id, consolidate_only, admin_secret } = body

    // admin_secret이 일치하면 JWT 검증 없이 통과 (consolidate_only 여부 무관)
    // consolidate_only=true: 기억만 통합 / false+conversation_id: 새 발화도 처리
    // 토큰은 환경 변수로 관리 — 소스에 하드코딩 금지
    const ADMIN_TOKEN = Deno.env.get('ADMIN_CONSOLIDATE_SECRET') ?? ''
    const isAdminConsolidate = ADMIN_TOKEN.length > 0 && admin_secret === ADMIN_TOKEN

    if (!isAdminConsolidate) {
      // 일반 경로: Authorization 헤더 JWT 검증
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: '인증 토큰이 필요합니다' }),
          { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

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

      if (!senior_id || (!consolidate_only && !conversation_id)) {
        return new Response(
          JSON.stringify({ error: 'senior_id 필드가 필요합니다. 일반 모드에서는 conversation_id도 필요합니다.' }),
          { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      if (user.id !== senior_id) {
        return new Response(
          JSON.stringify({ error: '권한이 없습니다' }),
          { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
    } else {
      // admin consolidate 경로: senior_id 필수만 확인
      if (!senior_id) {
        return new Response(
          JSON.stringify({ error: 'senior_id 필드가 필요합니다' }),
          { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
    }

    // DB 작업용 service_role 클라이언트 (RLS 우회 — utterances 직접 조회 필요)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // consolidate_only 모드: 새 발화 없이 기존 기억만 STEP 1 통합
    let utterances: { content: string; sequence_number: number }[] = []

    if (!consolidate_only) {
      // conversation이 인증된 senior 소유인지 검증 (service_role이 RLS 우회하므로 명시적 확인)
      const { data: conversation, error: convErr } = await supabase
        .from('conversations')
        .select('senior_id')
        .eq('id', conversation_id)
        .single()

      if (convErr || !conversation) {
        return new Response(
          JSON.stringify({ error: '대화를 찾을 수 없습니다' }),
          { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      if (conversation.senior_id !== senior_id) {
        return new Response(
          JSON.stringify({ error: '권한이 없습니다' }),
          { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      // 어르신 발화만 조회 (speaker = 'senior')
      const { data: fetched, error: uttErr } = await supabase
        .from('utterances')
        .select('content, sequence_number')
        .eq('conversation_id', conversation_id)
        .eq('speaker', 'senior')
        .order('sequence_number', { ascending: true })

      if (uttErr) {
        console.error('[extract-memory] utterances 조회 실패', uttErr)
        return new Response(
          JSON.stringify({ success: false, error: uttErr.message }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      // 발화가 없으면 early return
      if (!fetched || fetched.length === 0) {
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      utterances = fetched
    }

    // 기존 memories.data 조회
    const { data: memoryRow, error: memErr } = await supabase
      .from('memories')
      .select('data')
      .eq('senior_id', senior_id)
      .single()

    if (memErr && memErr.code !== 'PGRST116') {
      console.error('[extract-memory] memories 조회 실패', memErr)
      return new Response(
        JSON.stringify({ success: false, error: memErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const existingItems: MemoryItem[] = ((memoryRow?.data as MemoryData)?.items) ?? []

    // LLM 호출: 기존 memories 전체 + 새 발화(consolidate_only이면 없음)를 보고 최종 배열 반환
    const utteranceTexts = utterances.length > 0
      ? utterances.map((u) => u.content).join('\n')
      : '(none — run STEP 1 consolidation only)'
    const existingJson = JSON.stringify(existingItems, null, 2)
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })

    // 영문 system prompt: LLM의 지시 이해도·토큰 효율이 한국어보다 높음
    const systemPrompt = `You are a memory curator for a Korean elderly senior's AI companion app.
Today's date: ${today}

Your job is to return the COMPLETE, FINAL memory list after these steps IN ORDER:
  STEP 0 — Subject Clustering: identify clusters by person/place/time-period, aggressively consolidate each.
  STEP 1 — General Consolidation: merge any remaining overlapping items not addressed by STEP 0.
  STEP 2 — New Utterances: integrate new conversation utterances into the result.

[Output rules]
- Return a pure JSON array only — no markdown, no explanation.
- The array must contain ALL memory items (kept, merged, updated, and new).
- Each item format: { "text": "...", "category": "...", "emoji": "..." }
- For schedule items only, add: "expires_at": "YYYY-MM-DD" (the day after the event)

══════════════════════════════════════════
STEP 0: SUBJECT CLUSTERING
══════════════════════════════════════════
Scan ALL existing items and group them into subject clusters by anchor type:

  PERSON anchor — all items that are primarily about the same individual.
    Examples: all facts about 집사람 / 아들 민준이 / 딸 지연이 / 손자 재원이

  PLACE anchor — all items whose core context is the same specific location.
    Examples: all items set in 안동 / 북한산 / 성북천 / 구로공단 공장

  TIME PERIOD anchor — all items that belong to the same life era.
    Examples: 어린 시절 안동 / 서울 상경 초기 / 공장 근무 35년 / IMF 시기 / 은퇴 후

For EACH cluster, apply concentrated merging:
  - Merge items within the cluster as aggressively as possible (each merged item ≤ 130 chars).
  - TARGET: at most 2 items per cluster anchor after merging.
    Exception: a cluster with only 1 item stays as-is.
    Exception: if merging all cluster items into 2 × 130-char items is genuinely impossible, allow 3.
  - Items that don't belong to any cluster are handled in STEP 1.

[Category soft caps — enforce after STEP 0, before finalizing]
After STEP 0 + STEP 1, check each category. If still over cap, merge the most similar remaining pair.
  추억 ≤ 13    가족 ≤ 11    일상 ≤ 8    취미 ≤ 7    가치관 ≤ 5    건강 ≤ 4
  Overall target: total items ≤ 60. Keep merging until this is reached.
  NEVER delete facts — only merge and compress. Names, places, dates, relationships MUST be preserved.

[Recall Distinctiveness — the key question before keeping any two items separate]
Ask: "Will the AI ever need to recall these two facts INDEPENDENTLY in a future conversation?"
  YES → keep separate  (e.g., "혈압약 복용" vs. "무릎 부상" — different health contexts)
  NO / RARELY → merge  (e.g., "낙동강에서 물고기 잡음" + "메기 매운탕 어머니가 해주심" — one single memory)

══════════════════════════════════════════
STEP 1: GENERAL CONSOLIDATION
══════════════════════════════════════════
For any items NOT already merged in STEP 0:

ALWAYS MERGE (mandatory):
  1. Bare existence fact + detail about the same person:
     Any item "[관계/이름]이/가 있음" MUST merge with all related items (if combined ≤ 130 chars).
     A standalone "X가 있음" item with related detail items elsewhere must NEVER remain as-is.
  2. Sequential life events by the same subject (진학→졸업→합격 chain):
     Merge into one narrative if combined ≤ 130 chars.

MERGE IF fits in 130 chars (default for same-entity items):
  Estimate merged length. If ≤ 130: MERGE. This is the default, not optional.
  If all items for one entity exceed 130 together: try pairs. Each pair must stay ≤ 130.

KEEP SEPARATE only when: genuinely different recall contexts AND even the closest pair exceeds 130 chars.

══════════════════════════════════════════
STEP 2: NEW UTTERANCES
══════════════════════════════════════════
Apply after STEP 0 + STEP 1. For each new utterance, choose one operation:

1. KEEP: No related new info → keep item exactly as-is.
2. MERGE: New utterance adds detail to an existing item → combine (result ≤ ${MAX_TEXT_LENGTH} chars).
3. UPDATE: New utterance contradicts or supersedes → replace old fact.
   Triggers: life stage change / location change / health state change / plan resolution / explicit correction.
4. ADD: Completely new information → append as new item.

[When in doubt]
- STEP 0/1: Same entity + fits in 130 chars → MERGE. Bare "X가 있음" must never stay standalone.
- STEP 2: Unsure if new info fits existing → keep separate rather than merging incorrectly.
- NEVER delete an item unless new utterance explicitly contradicts or supersedes it.

[text writing rules]
- Bare existence facts ("아들 민준이 있음") MUST be enriched with available details — never standalone.
- Use predicative endings (했음, 좋아함, 다님) or natural connective phrasing when merging.
- Include known relationship when writing about a person (e.g., "딸 수빈이가 서울로 이사함").
- For a new person not yet in memories, use only their name — do NOT infer a relationship.
- Each text ≤ ${MAX_TEXT_LENGTH} characters. When over limit, in this strict order:
    1. COMPRESS — remove filler/vague qualifiers. Keep names, places, dates, relationships.
    2. UPDATE — check if part supersedes existing memory.
    3. SPLIT (last resort) — split on clearly different aspects; each part starts with the key identifier.
- Add context hint in parentheses only when it genuinely aids future recall:
  Good: "손자 영훈이 대학생 (고3 때 입학)"   Skip for already-clear short texts.

[Emoji rules]
- Exactly ONE emoji per item. Reuse the existing emoji when keeping or merging.

[Categories — prefer these 7; new 2–4 char Korean word only if none fit]
취미, 가족, 건강, 일상, 추억, 가치관, 일정

[Schedule items — expires_at]
- Only for category "일정". Set to the day AFTER the event. Format: "YYYY-MM-DD".
- No specific date mentioned → do NOT add expires_at.

[Filtering — do NOT extract from new utterances]
- Simple affirmations: "네", "그렇군요", "맞아요", "그래요", bare yes/no with no concrete information.

══════════════════════════════════════════
FEW-SHOT EXAMPLES
══════════════════════════════════════════

Example 1 — STEP 0 PLACE cluster (안동 어린 시절) 5 items → 2:
Cluster items:
  "안동 하회마을 옆 동네에서 자람"
  "초가집에서 자랐고, 여름엔 마루와 처마 밑 바람이 시원했음"
  "동네 어른들 탈춤 구경하러 따라다니곤 했음"
  "할머니가 부채 부치며 귀신 이야기해주시던 기억이 남"
  "안동이 선비 고장이라 어릴 때부터 역사 이야기를 들으며 자라 역사에 관심이 생김"
Target: ≤ 2 items.
After STEP 0: [
  {"text": "안동 하회마을 옆 초가집에서 자람, 여름엔 마루 바람 시원하고 탈춤 구경하며 놀았음", "category": "추억", "emoji": "🏡"},
  {"text": "할머니 귀신 이야기·선비 고장 역사 이야기 들으며 자라 역사에 관심 생김", "category": "추억", "emoji": "📚"}
]

Example 2 — STEP 0 TIME PERIOD cluster (IMF 시기) 2 items → 1:
Cluster items:
  "IMF 때 공장이 반 토막 나고 동료들 해고를 보며 가장 힘들었음"
  "IMF 때 다음 차례가 될까 매일 불안했고 집사람에게도 내색 못 했음"
Recall Distinctiveness: same event, same emotional context → merge.
After STEP 0: [
  {"text": "IMF 때 동료 해고 지켜보며 가장 힘들었음, 내 차례 될까 불안했지만 집사람에게 내색 못 했음", "category": "추억", "emoji": "😰"}
]

Example 3 — STEP 0 PERSON cluster (집사람 일상) 3 items → 1~2:
Cluster items:
  "집사람과 함께 트로트 프로그램을 봄"
  "오후에 집에 들어오면 집사람과 티비 보거나 커피 마시며 이야기함"
  "은퇴 후 집사람과 둘이 마주 앉아 이야기하는 시간이 생겨 다행이라 여김"
All describe daily time with 집사람 → merge into 1:
After STEP 0: [
  {"text": "은퇴 후 집사람과 마주 앉아 커피 마시고 트로트 보며 이야기하는 시간이 생겨 다행", "category": "가족", "emoji": "☕"}
]

Example 4 — Category soft cap: 건강 6 items → cap ≤ 4:
Before: "등산할 때 무릎이 쑤실 때가 있음" / "무릎이 쑤셔도 스틱 짚고 천천히 내려오면 괜찮음" / "50대 중반부터 혈압약을 먹고 있음" / "혈압은 약으로 잘 조절되는 편임" / ...
Merge pairs:
  "등산 시 무릎이 쑤실 때 있지만 스틱 짚고 천천히 내려오면 괜찮음" (2→1)
  "50대 중반부터 혈압약 복용, 현재 잘 조절되는 편임" (2→1)
Result: 4 items (within cap).

Example 5 — STEP 1: mandatory bare existence fact merge:
"아들 민준이 있음" + "민준이는 강남에 살고 있음" → "아들 민준이는 강남에 거주함"

Example 6 — STEP 2: UPDATE (life stage change):
Existing: {"text": "손자 영훈이 고등학교 3학년", ...}
New utterance: "영훈이가 이번에 대학에 입학했어"
Result: {"text": "손자 영훈이 대학 입학 (고3 졸업)", "category": "가족", "emoji": "👦"}

Example 7 — STEP 2: Schedule with expires_at:
New utterance: "다음 달 15일에 손녀 졸업식이야" (today: 2026-05-12)
Result: {"text": "손녀 졸업식 (2026-06-15)", "category": "일정", "emoji": "🎓", "expires_at": "2026-06-16"}

[Existing memories]
${existingJson}

[New utterances from this conversation]
${utteranceTexts}

Return the complete final memory array:`

    // LLM 실패 시 기존 memories 보존하고 즉시 실패 반환
    let finalItems: MemoryItem[]
    try {
      const { text } = await generateText({
        model: openai('gpt-5.4-mini'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Return the complete final memory array integrating the new utterances.' },
        ],
        temperature: 0.2,  // 낮은 temperature: 병합 판단의 일관성 확보
      })

      const parsed = JSON.parse(text.trim()) as MemoryItem[]
      if (!Array.isArray(parsed) || parsed.length === 0) {
        // LLM이 빈 배열을 반환하면 기존 데이터를 잃을 위험 → 기존 items 유지
        console.warn('[extract-memory] LLM이 빈 배열 반환, 기존 memories 보존')
        finalItems = existingItems
      } else {
        // 2차 방어: LLM이 150자 제한을 지키지 않은 항목을 후처리로 강제 분리
        finalItems = enforceTextLimit(parsed)
      }
    } catch (llmErr) {
      console.error('[extract-memory] LLM 호출 또는 JSON 파싱 실패', llmErr)
      return new Response(
        JSON.stringify({ success: false, error: 'LLM 추출 실패 — 기존 memories 보존됨' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // memories 테이블 UPSERT (최초 대화 시 row가 없을 수 있음)
    const { error: upsertErr } = await supabase
      .from('memories')
      .upsert(
        {
          senior_id,
          data: { items: finalItems },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'senior_id' },
      )

    if (upsertErr) {
      console.error('[extract-memory] memories upsert 실패', upsertErr)
      return new Response(
        JSON.stringify({ success: false, error: upsertErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // conversations.memory_extracted = true 업데이트 (consolidate_only 모드에서는 skip)
    if (!consolidate_only && conversation_id) {
      await supabase
        .from('conversations')
        .update({ memory_extracted: true })
        .eq('id', conversation_id)
    }

    const addedCount = finalItems.length - existingItems.length
    return new Response(
      JSON.stringify({ success: true, total_count: finalItems.length, added_count: addedCount }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('[extract-memory] 처리 중 오류:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
