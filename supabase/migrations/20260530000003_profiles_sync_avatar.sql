-- handle_new_user 트리거에 avatar_url 저장 추가
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'family')::user_role,
    COALESCE(NEW.raw_user_meta_data->>'display_name', '사용자'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '사용자'),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'family') = 'senior' THEN
    INSERT INTO public.senior_profiles (id) VALUES (NEW.id);
    INSERT INTO public.memories (senior_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 유저 avatar_url 채우기
UPDATE profiles p
SET avatar_url = (SELECT raw_user_meta_data->>'avatar_url' FROM auth.users WHERE id = p.id)
WHERE avatar_url IS NULL;
