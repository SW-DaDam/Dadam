-- ============================================================
-- 20260529000006_notifications_insert_family_circle.sql
-- 보안 수정(P2-5): notifications INSERT 를 같은 가족 서클로 제한
--
-- [문제]
-- INSERT 정책 `WITH CHECK (auth.uid() IS NOT NULL)` → 인증 사용자가 임의 recipient 에게
-- 알림 삽입(스팸) 가능.
--
-- [제약 조건]
-- 알림은 senior↔가족뿐 아니라 같은 senior의 책에서 가족↔가족(서로 직접 연결 안 됨)
-- 답글 알림도 발생한다. 따라서 단순 recipient=auth.uid() 나 senior↔family 양방향 체크로는
-- 정상 알림이 깨진다. "같은 가족 서클(같은 senior의 accepted 멤버)" 공동 소속 판정이 필요.
--
-- [해결]
-- shares_family_circle(a, b) SECURITY DEFINER 헬퍼로 두 사용자가 같은 서클에 속하는지 판정
-- (family_links RLS 우회해 신뢰 가능하게 평가). 정책은 recipient=본인 또는 같은 서클일 때만 허용.
-- ============================================================

-- 1) 가족 서클 공동 소속 판정 헬퍼
--    a, b 가 같은 senior 의 accepted 서클(senior 본인 + accepted 가족)에 동시에 속하면 true.
--    SECURITY DEFINER 로 family_links RLS 를 우회해 일관되게 평가한다.
CREATE OR REPLACE FUNCTION public.shares_family_circle(p_user_a uuid, p_user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_links fa
    JOIN public.family_links fb ON fa.senior_id = fb.senior_id
    WHERE fa.invite_status = 'accepted'
      AND fb.invite_status = 'accepted'
      AND (fa.senior_id = p_user_a OR fa.family_id = p_user_a)
      AND (fb.senior_id = p_user_b OR fb.family_id = p_user_b)
  )
$$;

-- 함수 소유권/권한: 익명 차단, 인증 사용자만 호출(정책 평가 시 호출자 권한 필요)
ALTER FUNCTION public.shares_family_circle(uuid, uuid) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.shares_family_circle(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.shares_family_circle(uuid, uuid) TO authenticated;

-- 2) 느슨한 INSERT 정책 교체
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;

CREATE POLICY "notifications_insert_connected" ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      recipient_id = auth.uid()                            -- 본인에게
      OR public.shares_family_circle(auth.uid(), recipient_id)  -- 같은 가족 서클 상대에게만
    )
  );
