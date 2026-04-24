// extract-memory: 세션 종료 후 대화에서 관심사 메모리 추출 (LLM 호출)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    // TODO: 4주차 구현 — 대화 utterances → memories.data JSONB 갱신
    return new Response(
      JSON.stringify({ message: "extract-memory: not implemented yet" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  }
})
