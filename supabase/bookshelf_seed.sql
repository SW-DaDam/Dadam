-- ============================================================
-- bookshelf_seed.sql — 책장 더미데이터 (책장 UI 테스트용)
-- 실행: Supabase 대시보드 SQL 에디터에 붙여넣기
-- 전제: seed.sql이 먼저 실행되어 senior_id / family_id 행이 존재해야 함
-- ============================================================

DO $$
DECLARE
  v_senior_id  UUID := 'cca782ad-75b7-400c-8113-22ac4f8c51b5';
  v_family1_id UUID := '00000000-0000-0000-0000-000000000002';
  v_family2_id UUID := '00000000-0000-0000-0000-000000000003';
  v_family3_id UUID := '00000000-0000-0000-0000-000000000004';

  -- 책 ID
  v_b2024_12 UUID;
  v_b2025_01 UUID;
  v_b2025_02 UUID;
  v_b2025_03 UUID;
  v_b2025_04 UUID;
  v_b2025_05 UUID;
  v_b2025_06 UUID;
  v_b2025_07 UUID;
  v_b2025_08 UUID;
  v_b2025_09 UUID;
  v_b2025_10 UUID;
  v_b2025_11 UUID;
  v_b2025_12 UUID;

  -- 챕터 ID (댓글 연결용)
  v_ch1 UUID; v_ch2 UUID; v_ch3 UUID;
BEGIN

  -- ── 책 INSERT (ON CONFLICT DO NOTHING으로 중복 방지) ──────────
  INSERT INTO public.books (senior_id, title, subtitle, book_type, status, year, month, chapter_count, cover_image_url, published_at)
  VALUES
    (v_senior_id, '겨울 끝자락의 기억',     '눈 내리던 그날',               'monthly', 'published', 2024, 12, 4, 'https://placehold.co/400x560/E0F2FE/0369A1?text=2024.12', now() - INTERVAL '120 days'),
    (v_senior_id, '새해 첫 아침',           '2025년의 시작',                'monthly', 'published', 2025, 1,  3, 'https://placehold.co/400x560/FFF0DC/E8820C?text=2025.01', now() - INTERVAL '90 days'),
    (v_senior_id, '매화꽃 피던 날',         '봄을 기다리며',                'monthly', 'published', 2025, 2,  4, 'https://placehold.co/400x560/FCE7F3/BE185D?text=2025.02', now() - INTERVAL '60 days'),
    (v_senior_id, '텃밭에 씨앗을 뿌리며',  '봄 햇살 아래',                 'monthly', 'published', 2025, 3,  3, 'https://placehold.co/400x560/DCFCE7/16A34A?text=2025.03', now() - INTERVAL '30 days'),
    (v_senior_id, '벚꽃 지는 길목에서',    '꽃비 내리는 4월',              'monthly', 'published', 2025, 4,  3, 'https://placehold.co/400x560/F3E8FF/7C3AED?text=2025.04', now() - INTERVAL '15 days'),
    (v_senior_id, '어버이날의 선물',        '자식 이기는 부모 없다더니',    'monthly', 'published', 2025, 5,  4, 'https://placehold.co/400x560/FEF9C3/CA8A04?text=2025.05', now() - INTERVAL '5 days'),
    (v_senior_id, '장마 속 이야기',         '빗소리와 함께',                'monthly', 'editing',   2025, 6,  3, NULL, NULL),
    (v_senior_id, '폭염 속 수박 한 조각',   '여름의 한 가운데',             'monthly', 'editing',   2025, 7,  2, NULL, NULL),
    (v_senior_id, '가을 운동회 추억',       '운동장의 함성',                'monthly', 'draft',     2025, 8,  0, NULL, NULL),
    (v_senior_id, '고추 말리는 가을',       '빨간 고추 담장 가득',          'monthly', 'draft',     2025, 9,  0, NULL, NULL),
    (v_senior_id, '단풍 따라 걷던 길',      '가을 단풍이 절정일 때',        'monthly', 'draft',     2025, 10, 0, NULL, NULL),
    (v_senior_id, '김장하던 날',            '온 가족이 모인 겨울',          'monthly', 'draft',     2025, 11, 0, NULL, NULL),
    (v_senior_id, '올해의 마지막 페이지',   '2025년을 보내며',              'monthly', 'draft',     2025, 12, 0, NULL, NULL)
  ON CONFLICT (senior_id, year, month) DO NOTHING;

  -- 책 ID 수집
  SELECT id INTO v_b2024_12 FROM public.books WHERE senior_id = v_senior_id AND year = 2024 AND month = 12;
  SELECT id INTO v_b2025_01 FROM public.books WHERE senior_id = v_senior_id AND year = 2025 AND month = 1;
  SELECT id INTO v_b2025_02 FROM public.books WHERE senior_id = v_senior_id AND year = 2025 AND month = 2;
  SELECT id INTO v_b2025_03 FROM public.books WHERE senior_id = v_senior_id AND year = 2025 AND month = 3;
  SELECT id INTO v_b2025_04 FROM public.books WHERE senior_id = v_senior_id AND year = 2025 AND month = 4;
  SELECT id INTO v_b2025_05 FROM public.books WHERE senior_id = v_senior_id AND year = 2025 AND month = 5;
  SELECT id INTO v_b2025_06 FROM public.books WHERE senior_id = v_senior_id AND year = 2025 AND month = 6;
  SELECT id INTO v_b2025_07 FROM public.books WHERE senior_id = v_senior_id AND year = 2025 AND month = 7;

  -- ── 챕터 INSERT (published / editing 책만) ───────────────────

  -- 2024.12
  INSERT INTO public.chapters (book_id, title, theme, content, sort_order) VALUES
    (v_b2024_12, '첫눈이 오던 날',       '추억', '창문 너머로 하얀 눈이 내리기 시작했어. 수아가 뛰어와서 할머니 눈 와요! 했던 게 생각나.',    1),
    (v_b2024_12, '동지 팥죽',            '일상', '동짓날 팥죽을 끓였어. 시어머니한테 배운 레시피대로 정성껏.',                                  2),
    (v_b2024_12, '한 해를 돌아보며',     '가치관', '올 한 해도 건강하게 지냈으니 그것만으로도 감사하지.',                                       3),
    (v_b2024_12, '새해 소원',            '가족', '제야의 종소리 들으며 가족 모두 건강하길 빌었어.',                                              4);

  -- 2025.01
  INSERT INTO public.chapters (book_id, title, theme, content, sort_order) VALUES
    (v_b2025_01, '설날 아침 차례',       '가족', '새벽부터 일어나 전 부치고 나물 무쳤어. 온 가족이 모이는 날이 제일 좋아.',                      1),
    (v_b2025_01, '세배돈 이야기',        '추억', '손주들한테 세배돈 주면서 이 돈으로 공부 열심히 해라 했더니 다들 씩씩하게 절하더라고.',          2),
    (v_b2025_01, '겨울 텃밭 준비',       '일상', '봄에 심을 씨앗을 골랐어. 상추, 깻잎, 토마토. 올해도 풍년이 들면 좋겠어.',                     3);

  -- 2025.02
  INSERT INTO public.chapters (book_id, title, theme, content, sort_order) VALUES
    (v_b2025_02, '매화꽃 구경',          '일상', '동네 매화나무에 꽃이 피기 시작했어. 봄이 오는 거지.',                                          1),
    (v_b2025_02, '민준이 생일',          '가족', '아들 생일이라 미역국 끓여줬어. 몇 살이 되어도 엄마 미역국이 최고래.',                           2),
    (v_b2025_02, '어릴 적 봄 소풍',      '추억', '국민학교 때 봄 소풍 가던 기억. 도시락 싸주시던 어머니 생각.',                                  3),
    (v_b2025_02, '봄맞이 대청소',        '일상', '이불 빨고 창문 닦고. 집이 환해지니 마음도 환해져.',                                            4);

  -- 2025.03
  INSERT INTO public.chapters (book_id, title, theme, content, sort_order) VALUES
    (v_b2025_03, '씨앗 심는 날',         '일상', '텃밭에 토마토 모종을 심었어. 올해도 잘 자라라.',                                               1),
    (v_b2025_03, '삼일절 태극기',        '가치관', '현관에 태극기 달았어. 나라가 있어야 가족도 있는 거야.',                                      2),
    (v_b2025_03, '봄비 맞은 텃밭',       '일상', '봄비가 흠뻑 내렸어. 씨앗들이 기뻐하겠지.',                                                     3);

  -- 2025.04
  INSERT INTO public.chapters (book_id, title, theme, content, sort_order) VALUES
    (v_b2025_04, '벚꽃 구경 나들이',     '가족', '수아가 데리고 나가서 벚꽃길 걸었어. 꽃비가 내려서 수아 머리에 꽃잎이 앉았지.',                1),
    (v_b2025_04, '식목일 나무 심기',     '일상', '마당 한켠에 작은 나무 하나 심었어. 내가 떠나도 이 나무는 계속 자라겠지.',                       2),
    (v_b2025_04, '봄 텃밭 첫 수확',      '일상', '상추가 이만큼 자랐어. 쌈 싸 먹으니 봄 맛이 나더라.',                                           3);

  -- 2025.05
  INSERT INTO public.chapters (book_id, title, theme, content, sort_order) VALUES
    (v_b2025_05, '어버이날 카네이션',    '가족', '민준이가 카네이션 달아줬어. 이게 세상에서 제일 예쁜 꽃이야.',                                   1),
    (v_b2025_05, '스승의 날 추억',       '추억', '국민학교 선생님이 생각났어. 참 무섭지만 정 많으셨지.',                                          2),
    (v_b2025_05, '토마토 꽃이 피었어',   '일상', '텃밭 토마토에 노란 꽃이 피었어. 곧 열매가 달리겠지.',                                           3),
    (v_b2025_05, '오월의 감사',          '가치관', '이 나이에 이렇게 건강하게 살 수 있다는 게 얼마나 감사한 일인지.',                             4);

  -- 2025.06 (editing - 챕터 있음)
  INSERT INTO public.chapters (book_id, title, theme, content, sort_order) VALUES
    (v_b2025_06, '장마 시작',            '일상', '장마가 시작됐어. 빗소리 들으면서 옛날 생각이 많이 났어.',                                       1),
    (v_b2025_06, '비 오는 날 전 부치기', '가족', '비 오는 날엔 전이 생각나지. 민준이한테 전화했더니 퇴근하고 온대.',                              2),
    (v_b2025_06, '장마 속 텃밭 걱정',    '일상', '비가 너무 많이 와서 토마토가 걱정돼. 내일 나가봐야지.',                                          3);

  -- 2025.07 (editing - 챕터 있음)
  INSERT INTO public.chapters (book_id, title, theme, content, sort_order) VALUES
    (v_b2025_07, '수박 한 통',           '가족', '수아가 수박 들고 왔어. 이 더위에 얼마나 무거웠을꼬.',                                            1),
    (v_b2025_07, '여름밤 마당',          '추억', '더워서 마당에 평상 펴고 누웠어. 별이 쏟아질 것 같았어.',                                         2);

  -- ── 챕터 ID 수집 (댓글 달 챕터) ─────────────────────────────
  SELECT id INTO v_ch1 FROM public.chapters WHERE book_id = v_b2025_05 AND sort_order = 1;
  SELECT id INTO v_ch2 FROM public.chapters WHERE book_id = v_b2025_05 AND sort_order = 4;
  SELECT id INTO v_ch3 FROM public.chapters WHERE book_id = v_b2025_04 AND sort_order = 1;

  -- ── 댓글 INSERT ─────────────────────────────────────────────
  INSERT INTO public.comments (chapter_id, author_id, content) VALUES
    (v_ch1, v_family1_id, '어머니 그날 저도 너무 좋았어요. 매년 달아드릴게요 💐'),
    (v_ch1, v_family2_id, '할머니 저도 드리고 싶었는데 멀리 있어서 ㅠㅠ 다음엔 꼭!'),
    (v_ch2, v_family3_id, '어머니 정말 건강하게 오래오래 사세요. 우리가 더 감사해요'),
    (v_ch2, v_family1_id, '맞아요 어머니. 저희가 더 잘 해드려야 하는데 항상 감사해요'),
    (v_ch3, v_family2_id, '할머니 그날 너무 좋았어요!! 꽃잎 사진 아직도 간직하고 있어요 🌸'),
    (v_ch3, v_family3_id, '수아 머리에 꽃 얹힌 거 저도 봤어요 ㅎㅎ 너무 예뻤잖아요');

  -- ── 표지 이미지 (published 책 대표) ──────────────────────────
  INSERT INTO public.cover_images (book_id, image_url, prompt, status) VALUES
    (v_b2025_05, 'https://placehold.co/400x560/FEF9C3/CA8A04?text=May+Cover', '어버이날 카네이션을 달고 웃는 할머니 수채화', 'selected'),
    (v_b2025_04, 'https://placehold.co/400x560/F3E8FF/7C3AED?text=April+Cover', '벚꽃 길을 걷는 할머니와 손녀 일러스트', 'selected');

  -- ── 알림 추가 ────────────────────────────────────────────────
  INSERT INTO public.notifications (recipient_id, type, title, body, reference_id, reference_type, is_read) VALUES
    (v_senior_id,  'new_comment',     '민준님이 댓글을 남겼어요',         '어머니 그날 저도 너무 좋았어요.',      v_ch1, 'chapter', false),
    (v_senior_id,  'new_comment',     '수아님이 댓글을 남겼어요',         '할머니 그날 너무 좋았어요!!',          v_ch3, 'chapter', false),
    (v_family1_id, 'new_book',        '어버이날의 선물이 출간됐어요',      '5월 이야기를 확인해보세요.',           v_b2025_05, 'book', false),
    (v_family2_id, 'new_book',        '어버이날의 선물이 출간됐어요',      '5월 이야기를 확인해보세요.',           v_b2025_05, 'book', false),
    (v_family3_id, 'new_book',        '어버이날의 선물이 출간됐어요',      '5월 이야기를 확인해보세요.',           v_b2025_05, 'book', true);

END $$;
