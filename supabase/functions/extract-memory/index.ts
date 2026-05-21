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

// 요청 본문 타입
interface ExtractMemoryRequest {
  conversation_id: string
  senior_id: string
}

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Authorization 헤더 검증
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 필요합니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // anon 클라이언트로 JWT를 검증하고 호출자 uid 추출
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

    // 요청 본문 파싱
    const body = await req.json() as Partial<ExtractMemoryRequest>
    const { conversation_id, senior_id } = body

    if (!conversation_id || !senior_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id, senior_id 필드가 필요합니다' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 호출자가 본인 senior_id만 처리할 수 있도록 검증
    if (user.id !== senior_id) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // DB 작업용 service_role 클라이언트 (RLS 우회 — utterances 직접 조회 필요)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

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
    const { data: utterances, error: uttErr } = await supabase
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
    if (!utterances || utterances.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
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

    // LLM 호출: 기존 memories 전체 + 새 발화를 보고 최종 배열을 직접 반환
    const utteranceTexts = utterances.map((u) => u.content).join('\n')
    const existingJson = JSON.stringify(existingItems, null, 2)
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })

    // 영문 system prompt: LLM의 지시 이해도·토큰 효율이 한국어보다 높음
    const systemPrompt = `You are a memory curator for a Korean elderly senior's AI companion app.
Today's date: ${today}

Your job is to return the COMPLETE, FINAL memory list after integrating the new conversation utterances into the existing memories.

[Output rules]
- Return a pure JSON array only — no markdown, no explanation.
- The array must contain ALL memory items (kept, merged, updated, and new).
- If there is nothing to add or change, return the existing array unchanged.
- Each item format: { "text": "...", "category": "...", "emoji": "..." }
- For schedule items only, add: "expires_at": "YYYY-MM-DD" (the day after the event)

[Four operations — apply the most appropriate one per existing item]
1. KEEP: No related new information → keep the item exactly as-is.
2. MERGE: New utterance adds detail to an existing item on the same topic/person/activity → combine into one richer item. Prefer the existing item's wording as the base.
3. UPDATE: New utterance contradicts or supersedes an existing item (e.g., moved house, cancelled plan) → replace with the new information.
4. ADD: Completely new information not related to any existing item → append as a new item.

[When in doubt]
- If unsure whether new info belongs to an existing item, keep them separate rather than merging incorrectly.
- Never delete an existing item unless the new utterance explicitly contradicts it.

[text writing rules]
- Short noun-form or predicative endings. No long run-on sentences.
  Good: "수빈이는 자주 못 온다", "텃밭 가꾸기를 좋아함", "무릎이 안 좋아서 병원 다님"
  Bad: "수빈이는 자주 못 와서 혼자 먹어야지", "텃밭에서 토마토를 키우고 있어서 수확했어"
- If a fact involves a person already in existing memories with a known relationship, include that relationship.
  Example: existing has "딸 수빈이" → new: "수빈이가 이사했어" → write: "딸 수빈이가 이사함"
- For a new person not yet in memories, use only their name — do NOT infer a relationship.

[Emoji rules]
- Exactly ONE emoji per item. Reuse the existing emoji when keeping or merging.

[Categories — prefer these 7; create a new 2–4 character Korean word only if none fit]
취미, 가족, 건강, 일상, 추억, 가치관, 일정

[Schedule items — expires_at]
- Only add "expires_at" for category "일정".
- Set expires_at to the day AFTER the event (so the item is excluded from AI context once the event passes).
- If no specific date is mentioned, do NOT add expires_at.
- Format: "YYYY-MM-DD"

[Filtering rules — do NOT extract from new utterances]
- Simple affirmations or back-channels: "네", "그렇군요", "맞아요", "그래요"
- Utterances that contain only a bare yes/no with no concrete information

[Few-shot examples]

Example 1 — MERGE (same activity):
Existing: [{"text": "동네 바둑 모임에 나감", "category": "일상", "emoji": "♟️"}]
New utterance: "이번 주에 후배와 바둑 두러 가기로 함"
Result: [{"text": "동네 바둑 모임 나가고, 후배와도 바둑을 즐김", "category": "취미", "emoji": "♟️"}]

Example 2 — MERGE (same person, add detail):
Existing: [{"text": "민준이와 자주 낚시 가는 편임", "category": "가족", "emoji": "🎣"}]
New utterance: "작년 봄에 민준이랑 충주호에서 낚시함"
Result: [{"text": "민준이와 자주 낚시 가는 편, 작년 봄엔 충주호 방문", "category": "가족", "emoji": "🎣"}]

Example 3 — UPDATE (contradicts existing):
Existing: [{"text": "딸 수빈이가 부산에 살고 있음", "category": "가족", "emoji": "👧"}]
New utterance: "수빈이가 이사를 서울로 왔어"
Result: [{"text": "딸 수빈이가 서울로 이사함", "category": "가족", "emoji": "👧"}]

Example 4 — Schedule with expires_at:
New utterance: "다음 달 15일에 손녀 졸업식이야" (assume today is 2026-05-12)
Result item: {"text": "손녀 졸업식 (2026-06-15)", "category": "일정", "emoji": "🎓", "expires_at": "2026-06-16"}

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
        finalItems = parsed
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

    // conversations.memory_extracted = true 업데이트
    await supabase
      .from('conversations')
      .update({ memory_extracted: true })
      .eq('id', conversation_id)

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
