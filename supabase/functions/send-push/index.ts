import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

// Web Push 서명용 유틸
async function importKey(raw: Uint8Array, usage: KeyUsage[]) {
  return crypto.subtle.importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, usage)
}

function base64UrlToUint8Array(base64: string): Uint8Array {
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - base64.length % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// VAPID JWT 생성
async function createVapidJwt(endpoint: string): Promise<string> {
  const origin = new URL(endpoint).origin
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  }
  const enc = (obj: unknown) => uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(obj)))
  const unsigned = `${enc(header)}.${enc(payload)}`

  const keyData = base64UrlToUint8Array(VAPID_PRIVATE_KEY)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  ).catch(async () => {
    // raw 키로 재시도 (web-push 형식)
    const rawKey = await crypto.subtle.importKey('raw', keyData, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
    const exported = await crypto.subtle.exportKey('pkcs8', rawKey)
    return crypto.subtle.importKey('pkcs8', exported, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  })

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  )
  return `${unsigned}.${uint8ArrayToBase64Url(new Uint8Array(sig))}`
}

// 단일 구독에 Web Push 전송
async function sendPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const jwt = await createVapidJwt(subscription.endpoint)
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'TTL': '86400',
    },
    body: payload,
  })
  return res.status
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
  }

  const { recipient_id, title, body, url } = await req.json() as {
    recipient_id: string
    title: string
    body?: string
    url?: string
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', recipient_id)

  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/' })
  const results = await Promise.allSettled(subs.map(s => sendPush(s, payload)))
  const sent = results.filter(r => r.status === 'fulfilled').length

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
})
