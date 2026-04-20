-- ============================================================
-- seed.sql — 개발용 목업 데이터
-- ⚠️ auth.users에 테스트 계정이 없으면 handle_new_user 트리거 실행 불가
-- 실행: Supabase MCP execute_sql (apply_migration 아님)
-- ============================================================

DO $$
DECLARE
  v_senior_id   UUID := '00000000-0000-0000-0000-000000000001';
  v_family1_id  UUID := '00000000-0000-0000-0000-000000000002';
  v_family2_id  UUID := '00000000-0000-0000-0000-000000000003';
  v_family3_id  UUID := '00000000-0000-0000-0000-000000000004';
  v_book1_id    UUID;
  v_book2_id    UUID;
  v_book3_id    UUID;
  v_conv1_id    UUID;
  v_conv2_id    UUID;
  v_chap1_id    UUID;
  v_chap2_id    UUID;
  v_chap3_id    UUID;
  v_comment1_id UUID;
  v_comment2_id UUID;
BEGIN
  -- auth.users 테스트 계정 (handle_new_user 트리거가 profiles 자동 생성)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_senior_id,  'senior@dadam.test',  '', now(), '{"role":"senior","display_name":"김순자 할머니"}', now(), now()),
    (v_family1_id, 'family1@dadam.test', '', now(), '{"role":"family","display_name":"김민준 (아들)"}', now(), now()),
    (v_family2_id, 'family2@dadam.test', '', now(), '{"role":"family","display_name":"이수아 (손녀)"}', now(), now()),
    (v_family3_id, 'family3@dadam.test', '', now(), '{"role":"family","display_name":"박영희 (딸)"}',   now(), now())
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.senior_profiles
  SET birth_date = '1948-03-15', region = '경상남도 진주시', dialect = '경상도',
      interests_summary = '텃밭 가꾸기, 화투, 트로트 음악을 좋아하시며 손주 이야기를 자주 하십니다.',
      onboarding_completed = true
  WHERE id = v_senior_id;

  UPDATE public.memories
  SET data = '{"hobbies":["텃밭 가꾸기","화투","트로트 듣기"],"relationships":{"민준":{"relation":"아들","mentions":8},"수아":{"relation":"손녀","mentions":12}},"health":["무릎 안 좋음","당뇨 관리 중"],"recurring_topics":["텃밭 토마토","고향 이야기"]}'::jsonb
  WHERE senior_id = v_senior_id;

  INSERT INTO public.family_links (senior_id, family_id, invite_code, invite_status, relationship, accepted_at, expires_at)
  VALUES
    (v_senior_id, v_family1_id, 'INVITE-001', 'accepted', '아들', now(), now() + INTERVAL '7 days'),
    (v_senior_id, v_family2_id, 'INVITE-002', 'accepted', '손녀', now(), now() + INTERVAL '7 days'),
    (v_senior_id, v_family3_id, 'INVITE-003', 'accepted', '딸',   now(), now() + INTERVAL '7 days')
  ON CONFLICT (senior_id, family_id) DO NOTHING;

  INSERT INTO public.conversations (senior_id, started_at, ended_at, duration_seconds, summary, memory_extracted, utterance_count)
  VALUES
    (v_senior_id, now() - INTERVAL '10 days', now() - INTERVAL '10 days' + INTERVAL '25 minutes', 1500, '텃밭 토마토와 손녀 수아 이야기를 주로 나눴습니다.', true, 6),
    (v_senior_id, now() - INTERVAL '3 days',  now() - INTERVAL '3 days'  + INTERVAL '18 minutes', 1080, '고향 진주와 어린 시절 추억을 이야기하셨습니다.', true, 5);

  SELECT id INTO v_conv1_id FROM public.conversations WHERE senior_id = v_senior_id ORDER BY started_at LIMIT 1;
  SELECT id INTO v_conv2_id FROM public.conversations WHERE senior_id = v_senior_id ORDER BY started_at DESC LIMIT 1;

  INSERT INTO public.utterances (conversation_id, speaker, content, tags, sequence_number) VALUES
    (v_conv1_id, 'ai',     '오늘 텃밭은 어떠셨어요?',                                       '{}',                                  1),
    (v_conv1_id, 'senior', '토마토가 드디어 빨갛게 익었어. 올해는 풍년이야.',                '{memory_recall,emotional_peak}',      2),
    (v_conv1_id, 'ai',     '정말요! 손수 키우신 거잖아요. 뿌듯하시겠어요.',                  '{}',                                  3),
    (v_conv1_id, 'senior', '그럼. 수아한테 따다 줬더니 맛있다고 하더라고. 그게 제일 좋아.',  '{relationship_event,emotional_peak}', 4),
    (v_conv1_id, 'ai',     '손녀분이 좋아하셨군요. 수아 양은 요즘 어떻게 지내나요?',         '{}',                                  5),
    (v_conv1_id, 'senior', '대학원 다닌다고 바쁘대. 그래도 주말엔 가끔 와.',                 '{relationship_event}',                6),
    (v_conv2_id, 'ai',     '고향이 어디세요?',                                               '{}',                          1),
    (v_conv2_id, 'senior', '경남 진주야. 거기서 나고 자랐지. 남강이 참 예뻤어.',             '{memory_recall}',             2),
    (v_conv2_id, 'ai',     '남강이요? 어떤 추억이 있으세요?',                                '{}',                          3),
    (v_conv2_id, 'senior', '어릴 때 거기서 빨래도 하고 물고기도 잡았지.',                    '{memory_recall,philosophy}',  4),
    (v_conv2_id, 'senior', '고향은 마음에 남는 거야. 어디 가도 잊을 수가 없어.',             '{philosophy}',                5);

  INSERT INTO public.books (senior_id, title, subtitle, book_type, status, year, month, chapter_count, published_at) VALUES
    (v_senior_id, '봄날의 텃밭 이야기',   '토마토가 익어가는 계절',  'monthly', 'draft',     2026, 3, 0, NULL),
    (v_senior_id, '내 마음속의 진주',     '고향을 그리며',           'monthly', 'editing',   2026, 2, 3, NULL),
    (v_senior_id, '손녀에게 보내는 편지', '수아야, 할머니가 쓴다',   'monthly', 'published', 2026, 1, 3, now() - INTERVAL '20 days')
  ON CONFLICT (senior_id, year, month) DO NOTHING;

  SELECT id INTO v_book1_id FROM public.books WHERE senior_id = v_senior_id AND status = 'draft'     LIMIT 1;
  SELECT id INTO v_book2_id FROM public.books WHERE senior_id = v_senior_id AND status = 'editing'   LIMIT 1;
  SELECT id INTO v_book3_id FROM public.books WHERE senior_id = v_senior_id AND status = 'published' LIMIT 1;

  INSERT INTO public.chapters (book_id, title, theme, content, sort_order, is_deleted) VALUES
    (v_book3_id, '첫 번째 만남',       '가족',  '수아를 처음 품에 안던 날, 그 작은 손이 아직도 기억나.',       1, false),
    (v_book3_id, '텃밭에서 보낸 하루', '일상',  '매일 아침 텃밭에 나가는 게 낙이야. 내 손으로 키운 것들.',     2, false),
    (v_book3_id, '나의 소원',          '가치관','건강하게 오래 살아서 수아 결혼식은 봐야 할 텐데.',             3, false),
    (v_book2_id, '남강의 기억',        '추억',  '진주 남강에서 빨래를 하던 어머니 모습이 아직도 눈에 선해.',   1, false),
    (v_book2_id, '고향 장터',          '추억',  '5일장이 서는 날이면 온 동네가 들썩였어.',                      2, false),
    (v_book2_id, '고향을 떠나며',      '관계',  '상경하던 날, 어머니가 역까지 배웅해 주셨어.',                  3, false);

  SELECT id INTO v_chap1_id FROM public.chapters WHERE book_id = v_book3_id ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_chap2_id FROM public.chapters WHERE book_id = v_book3_id ORDER BY sort_order OFFSET 1 LIMIT 1;
  SELECT id INTO v_chap3_id FROM public.chapters WHERE book_id = v_book3_id ORDER BY sort_order OFFSET 2 LIMIT 1;

  INSERT INTO public.cover_images (book_id, image_url, prompt, status) VALUES
    (v_book3_id, 'https://placehold.co/800x600/FFD700/333?text=Cover+1', '따뜻한 봄날 할머니와 손녀가 텃밭에서 함께 있는 수채화', 'selected'),
    (v_book3_id, 'https://placehold.co/800x600/87CEEB/333?text=Cover+2', '파란 하늘 아래 꽃밭에 서 있는 어르신 실루엣',           'rejected'),
    (v_book3_id, 'https://placehold.co/800x600/98FB98/333?text=Cover+3', '따뜻한 편지지 위에 꽃과 채소가 어우러진 일러스트',       'rejected');

  INSERT INTO public.comments (id, chapter_id, author_id, content) VALUES
    (gen_random_uuid(), v_chap1_id, v_family1_id, '어머니, 저도 그날 기억나요. 수아가 어찌나 작던지 ㅎㅎ'),
    (gen_random_uuid(), v_chap1_id, v_family2_id, '할머니! 저 읽다가 울었어요 😭 사랑해요'),
    (gen_random_uuid(), v_chap2_id, v_family3_id, '어머니 텃밭 토마토 진짜 맛있었는데 또 먹고 싶어요!'),
    (gen_random_uuid(), v_chap2_id, v_family1_id, '올여름에 가서 같이 수확해요 어머니~'),
    (gen_random_uuid(), v_chap3_id, v_family2_id, '할머니 소원 꼭 이뤄질 거예요. 제가 빨리 결혼할게요 💕');

  SELECT id INTO v_comment1_id FROM public.comments WHERE chapter_id = v_chap1_id AND author_id = v_family2_id LIMIT 1;
  SELECT id INTO v_comment2_id FROM public.comments WHERE chapter_id = v_chap3_id AND author_id = v_family2_id LIMIT 1;

  INSERT INTO public.replies (comment_id, senior_id, content) VALUES
    (v_comment1_id, v_senior_id, '수아야 고맙다. 할머니도 그날이 제일 행복했어.'),
    (v_comment2_id, v_senior_id, '하하, 우리 수아 기다리고 있을게. 건강히 잘 지내라.');

  INSERT INTO public.notifications (recipient_id, type, title, body, reference_id, reference_type, is_read) VALUES
    (v_senior_id,  'new_comment', '민준님이 댓글을 남겼어요',   '어머니, 저도 그날 기억나요.',        v_chap1_id, 'chapter', false),
    (v_senior_id,  'new_comment', '수아님이 댓글을 남겼어요',   '할머니! 저 읽다가 울었어요',          v_chap1_id, 'chapter', false),
    (v_family1_id, 'new_book',    '새 책이 출간됐어요',          '손녀에게 보내는 편지가 출간됐습니다.', v_book3_id, 'book',    false),
    (v_family2_id, 'new_book',    '새 책이 출간됐어요',          '손녀에게 보내는 편지가 출간됐습니다.', v_book3_id, 'book',    true),
    (v_family3_id, 'new_book',    '새 책이 출간됐어요',          '손녀에게 보내는 편지가 출간됐습니다.', v_book3_id, 'book',    false);

END $$;
