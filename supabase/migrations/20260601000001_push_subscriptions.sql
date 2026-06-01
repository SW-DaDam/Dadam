-- PWA 웹 푸시 구독 정보 저장
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 본인 구독만 관리
CREATE POLICY "own_push_subscriptions" ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- Edge Function에서 다른 유저 구독 조회 허용 (service_role로 호출)
