-- cover_images에 chapter_id 추가: 각 표지 후보가 어느 챕터에 대응하는지 추적
-- NULL 허용: 추가 생성 시 챕터 미지정으로 호출하는 경우 대비
ALTER TABLE public.cover_images
  ADD COLUMN chapter_id UUID NULL REFERENCES public.chapters(id) ON DELETE SET NULL;

-- 챕터당 표지 1개 보장 (추가 생성 시 upsert onConflict 조건으로 사용)
ALTER TABLE public.cover_images
  ADD CONSTRAINT cover_images_book_chapter_unique UNIQUE (book_id, chapter_id);

CREATE INDEX idx_cover_images_chapter_id ON public.cover_images(chapter_id);
