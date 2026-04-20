// tag-utterances: 발화를 5개 태그로 분류 (daily_mundane·memory_recall·emotional_peak·philosophy·relationship_event)
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
    // TODO: 5주차 구현 — utterances 태그 분류 + 화제 후보 선별
    return new Response(
      JSON.stringify({ message: "tag-utterances: not implemented yet" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    )
  }
})
