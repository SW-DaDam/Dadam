-- profiles에 카카오 실명 컬럼 추가
-- full_name: 카카오에서 가져온 실제 이름 (변경 불가, 댓글 등 표시용)
-- display_name: 저자가 설정한 호칭 (아빠, 할머니 등)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 신규 가입 트리거에 full_name 추가
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'family')::user_role,
    COALESCE(NEW.raw_user_meta_data->>'display_name', '사용자'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '사용자')
  );

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'family') = 'senior' THEN
    INSERT INTO public.senior_profiles (id) VALUES (NEW.id);
    INSERT INTO public.memories (senior_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
