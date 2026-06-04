// retry-book-job: 책 생성 실패 시 자동 재시도 (최대 3회, retry_count 관리)
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
    // TODO: 7주차 구현 — book_generation_jobs retry_count 증가 + generate-book 재호출
    return new Response(
      JSON.stringify({ message: "retry-book-job: not implemented yet" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  }
})
