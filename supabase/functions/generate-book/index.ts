// generate-book: 월말 자동 책 초안 생성 (aggregating→chaptering→cover 3단계)
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
    // TODO: 5~6주차 구현 — 발화 선별 → 챕터 구성 → 서사 문장화
    return new Response(
      JSON.stringify({ message: "generate-book: not implemented yet" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  }
})
