import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronLeft, Check, Mic, Pencil, X, RotateCcw, RefreshCw, BookOpen, Camera, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBookEdit } from '@/features/bookshelf/hooks/useBookEdit'
import { useAuthStore } from '@/shared/stores/authStore'
import { supabase } from '@/lib/supabase'
import type { Chapter, CoverImage } from '@/types/domain'

// ─── 상수 ────────────────────────────────────────────────────────

// STEPS는 book_type에 따라 다르므로 컴포넌트 내부에서 정의 (isShortBook 플래그 참조)

const MOCK_CHAPTERS: Chapter[] = [
  { id: 'mock-1', book_id: '', content: '4월 초부터 시작한 텃밭 가꾸기. 드디어 빨간 토마토가 열렸다. 손녀에게도 나눠주며 행복한 시간을 보냈다.', title: '봄 텃밭과 토마토', sort_order: 1, is_deleted: false, theme: '일상', source_utterance_ids: null, photo_url: null, created_at: '', updated_at: '' },
  { id: 'mock-2', book_id: '', content: '드디어 수빈이가 중학생이 되었다. 교복을 입은 모습이 어찌나 예쁘고 대견하던지 눈물이 날 것 같았다.', title: '손녀 수빈이의 중학교 입학', sort_order: 2, is_deleted: false, theme: '가족', source_utterance_ids: null, photo_url: null, created_at: '', updated_at: '' },
  { id: 'mock-3', book_id: '', content: '오랜만에 봄비가 내렸다. 빗소리를 들으며 옛 생각이 났다. 젊은 시절 남편과 함께 걷던 골목이 떠올랐다.', title: '봄비 오던 날의 추억', sort_order: 3, is_deleted: false, theme: '추억', source_utterance_ids: null, photo_url: null, created_at: '', updated_at: '' },
]

const CONTENT_MAX = 2000  // 챕터 내용 수정 최대 글자 수

// ─── 진행 표시기 ─────────────────────────────────────────────────

// steps와 accent를 props로 받아 월간(4단계, 주황)과 단편(3단계, 노랑)에 모두 대응
function StepIndicator({
  currentStep,
  steps,
  accent,
  onStepClick,
}: {
  currentStep: number
  steps: { n: number; label: string }[]
  accent: string
  onStepClick: (n: number) => void
}) {
  return (
    <div className="bg-white border-b border-[#E5E7EB] px-6 sm:px-8 pt-2 pb-2 shrink-0">
      <div className="relative h-[2px] bg-[#D1D5DB] rounded-full mb-2 mx-3">
        <div className="absolute top-0 left-0 h-full rounded-full transition-all"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`, background: accent }} />
      </div>
      <div className="flex justify-between">
        {steps.map((step) => {
          const done = step.n < currentStep
          const active = step.n === currentStep
          const clickable = step.n <= currentStep
          return (
            <button key={step.n} type="button"
              onClick={() => clickable && onStepClick(step.n)}
              className={cn('flex flex-col items-center gap-1', clickable ? 'cursor-pointer' : 'cursor-default')}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: done ? '#16A34A' : active ? accent : '#D1D5DB' }}>
                {done
                  ? <Check size={14} className="text-white" strokeWidth={3} />
                  : <span className={cn('text-sm font-bold', active ? 'text-white' : 'text-[#6B7280]')}>{step.n}</span>}
              </div>
              <span className="text-xs"
                style={{ color: done ? '#16A34A' : active ? accent : '#6B7280', fontWeight: (done || active) ? 700 : 400 }}>
                {step.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────

export default function BookEditPage() {
  const navigate = useNavigate()
  const { bookId } = useParams<{ bookId: string }>()
  const user = useAuthStore((s) => s.user)
  const {
    book, chapters: realChapters, coverImages, loading, coverLoading, coverError,
    regenerating, extraCoverCount, extraCoverLimit,
    softDeleteChapter, restoreChapter, updateChapterTitle, updateChapterContent, updateChapterPhotoUrl,
    selectCover, publishBook, regenerateCover,
  } = useBookEdit(bookId)

  const [currentStep, setCurrentStep] = useState(1)
  const [selectedCoverId, setSelectedCoverId] = useState<string>('')

  // 최초 로드 시에만 첫 번째 표지로 초기화
  // 재생성 후 coverImages가 갱신될 때 사용자가 선택한 표지가 리셋되지 않도록
  useEffect(() => {
    if (coverImages.length > 0 && !coverImages.some(c => c.id === selectedCoverId)) {
      setSelectedCoverId(coverImages[0].id)
    }
  }, [coverImages, selectedCoverId])

  const [viewingChapter, setViewingChapter] = useState<Chapter | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  // 제목 편집
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  // 내용 편집 모달
  const [editingContentChapter, setEditingContentChapter] = useState<Chapter | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [savingContent, setSavingContent] = useState(false)

  const [authorNote, setAuthorNote] = useState('')  // 작가의 말 (구 헌사)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetChapterRef = useRef<string | null>(null)

  const chapters = realChapters.length > 0 ? realChapters : MOCK_CHAPTERS
  const isMock = realChapters.length === 0
  const activeChapters = chapters.filter(c => !c.is_deleted)
  const deletedChapters = chapters.filter(c => c.is_deleted)
  const confirmChapter = chapters.find(c => c.id === confirmRemoveId)

  // 단편집 여부에 따라 accent 색상과 스텝 구조를 분기
  const isShortBook = book?.book_type === 'short'
  const ACCENT       = isShortBook ? '#FACC15' : '#E8820C'
  const ACCENT_LIGHT = isShortBook ? '#FEF9C3' : '#FFF0DC'  // 연한 배경
  const ACCENT_TEXT  = isShortBook ? '#1F2937' : 'white'    // accent 배경 위 텍스트

  // 단편: 챕터확인 → 표지선택 → 출간(3단계) / 월간: 챕터확인 → 표지선택 → 작가의말 → 출간(4단계)
  const STEPS = isShortBook
    ? [{ n: 1, label: '챕터 확인' }, { n: 2, label: '표지 선택' }, { n: 3, label: '출간' }]
    : [{ n: 1, label: '챕터 확인' }, { n: 2, label: '표지 선택' }, { n: 3, label: '작가의 말' }, { n: 4, label: '출간' }]
  const LAST_STEP = STEPS.length

  const bookTitle = book
    ? (isShortBook ? (book.title ?? `${book.year}년 ${book.month}월 단편`) : `${book.year}년 ${book.month}월 책`)
    : '이번 달 책 만들기'

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // ─── 챕터 제목 편집 ─────────────────────────────────────────────

  function startEditTitle(chapter: Chapter) {
    setEditingChapterId(chapter.id)
    setEditingTitle(chapter.title)
  }

  async function confirmEditTitle() {
    if (!editingChapterId || !editingTitle.trim()) return
    if (isMock) { setEditingChapterId(null); return }
    try {
      await updateChapterTitle(editingChapterId, editingTitle.trim())
    } catch {
      showToast('제목 변경에 실패했어요')
    }
    setEditingChapterId(null)
  }

  // ─── 챕터 내용 편집 ─────────────────────────────────────────────

  function openEditContent(chapter: Chapter) {
    setEditingContentChapter(chapter)
    setEditingContent(chapter.content)
  }

  async function confirmEditContent() {
    if (!editingContentChapter || !editingContent.trim()) return
    if (isMock) { setEditingContentChapter(null); return }
    setSavingContent(true)
    try {
      await updateChapterContent(editingContentChapter.id, editingContent.trim())
      showToast('내용이 수정됐어요')
    } catch {
      showToast('내용 수정에 실패했어요')
    } finally {
      setSavingContent(false)
      setEditingContentChapter(null)
    }
  }

  // ─── 챕터 빼기 / 되돌리기 ───────────────────────────────────────

  async function handleRemoveChapter(id: string) {
    setConfirmRemoveId(null)
    if (isMock) {
      showToast('목업 데이터입니다. 실제 데이터 연동 후 적용돼요')
      return
    }
    try {
      await softDeleteChapter(id)
    } catch {
      showToast('챕터를 뺄 수 없었어요')
    }
  }

  async function handleRestoreChapter(id: string) {
    if (isMock) { showToast('목업 데이터입니다'); return }
    try {
      await restoreChapter(id)
    } catch {
      showToast('되돌리기에 실패했어요')
    }
  }

  // ─── 챕터 사진 업로드/삭제 ────────────────────────────────────────

  function openPhotoUpload(chapterId: string) {
    if (isMock) { showToast('목업 데이터입니다'); return }
    uploadTargetChapterRef.current = chapterId
    photoInputRef.current?.click()
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const chapterId = uploadTargetChapterRef.current
    if (!file || !chapterId || !user) return
    e.target.value = ''

    if (!file.type.startsWith('image/')) { showToast('이미지 파일만 올릴 수 있어요'); return }
    if (file.size > 10 * 1024 * 1024) { showToast('10MB 이하 사진만 올릴 수 있어요'); return }

    setUploadingPhotoId(chapterId)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${chapterId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('chapter-photos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) {
        console.error('[사진 업로드 실패]', upErr.message, upErr)
        throw upErr
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chapter-photos')
        .getPublicUrl(path)

      const { error: dbErr } = await supabase
        .from('chapters')
        .update({ photo_url: publicUrl })
        .eq('id', chapterId)
      if (dbErr) throw dbErr

      updateChapterPhotoUrl(chapterId, publicUrl)
      showToast('사진을 추가했어요')
    } catch {
      showToast('사진 업로드에 실패했어요')
    } finally {
      setUploadingPhotoId(null)
      uploadTargetChapterRef.current = null
    }
  }

  async function handlePhotoDelete(chapter: Chapter) {
    if (!chapter.photo_url || isMock) return
    try {
      const url = new URL(chapter.photo_url)
      const storagePath = decodeURIComponent(url.pathname.split('/chapter-photos/')[1])
      await supabase.storage.from('chapter-photos').remove([storagePath])
      await supabase.from('chapters').update({ photo_url: null }).eq('id', chapter.id)
      updateChapterPhotoUrl(chapter.id, null)
      showToast('사진을 삭제했어요')
    } catch {
      showToast('사진 삭제에 실패했어요')
    }
  }

  // ─── 출간 ────────────────────────────────────────────────────────

  async function handlePublish() {
    setPublishConfirmOpen(false)
    setPublishing(true)
    try {
      if (!isMock && coverImages.length > 0) {
        await selectCover(selectedCoverId)
      }
      if (!isMock && bookId) {
        // dedication 파라미터에 작가의 말 저장 (DB 컬럼명 유지)
        await publishBook(authorNote.trim())
      }
      setPublished(true)
      setCurrentStep(isShortBook ? 3 : 4)
    } catch {
      showToast('출간에 실패했어요. 다시 시도해 주세요')
    } finally {
      setPublishing(false)
    }
  }

  // ─── 렌더 ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8F0]">
        <p className="text-[1.125rem] text-[#6B7280]">불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0]">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button"
          onClick={() => currentStep > 1 ? setCurrentStep(s => s - 1 as 1) : navigate(-1)}
          className="flex flex-col items-center justify-center min-h-11 min-w-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
          <span className="text-xs text-[#6B7280]">뒤로</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold text-[#1F2937] whitespace-nowrap">
          {bookTitle}
        </h1>
      </header>

      {currentStep < LAST_STEP && (
        <StepIndicator
          currentStep={currentStep}
          steps={STEPS}
          accent={ACCENT}
          onStepClick={n => setCurrentStep(n as 1 | 2 | 3 | 4)}
        />
      )}

      {/* ── Step 1: 챕터 확인 (F-12) ── */}
      {currentStep === 1 && (
        <>
          <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-[1.5rem] font-bold text-[#1F2937]">
                {isShortBook ? '단편 이야기예요' : '이번 달 이야기들이에요'}
              </p>
              <p className="text-[1.125rem] text-[#6B7280]">
                {isShortBook ? '내용과 제목을 확인해 보세요' : '마음에 들지 않는 이야기는 빼도 돼요'}
              </p>
            </div>

            {/* 활성 챕터 */}
            <div className="flex flex-col gap-3">
              {activeChapters.map((chapter, idx) => (
                <div key={chapter.id} className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[1.25rem] font-bold shrink-0"
                      style={{ color: ACCENT }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      {/* 제목 (편집 모드 토글) */}
                      {editingChapterId === chapter.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value.slice(0, 100))}
                            className="flex-1 border-b-2 bg-transparent text-[1.125rem] text-[#1F2937] outline-none py-0.5"
                            style={{ borderColor: ACCENT }}
                            onKeyDown={e => { if (e.key === 'Enter') confirmEditTitle() }}
                          />
                          <button type="button" onClick={confirmEditTitle}
                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: ACCENT }}>
                            <Check size={14} className="text-white" strokeWidth={3} />
                          </button>
                          <button type="button" onClick={() => setEditingChapterId(null)}
                            className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                            <X size={14} className="text-[#6B7280]" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => startEditTitle(chapter)}
                          className="flex items-center gap-2 text-left group">
                          <p className="text-[1.125rem] font-bold text-[#1F2937] transition-colors group-hover:opacity-70">
                            {chapter.title}
                          </p>
                          <Pencil size={14} className="text-[#D1D5DB] shrink-0 transition-colors group-hover:opacity-70" />
                        </button>
                      )}
                      {/* 단편은 챕터 1개이므로 미리보기를 더 넓게 (5줄) */}
                      <p className={cn('text-[1.0625rem] text-[#6B7280]', isShortBook ? 'line-clamp-5' : 'line-clamp-2')}>{chapter.content}</p>
                    </div>
                  </div>

                  {/* 사진 미리보기 */}
                  {chapter.photo_url && (
                    <div className="relative rounded-xl overflow-hidden">
                      <img src={chapter.photo_url} alt="챕터 사진" className="w-full max-h-48 object-cover" />
                      <button
                        type="button"
                        onClick={() => handlePhotoDelete(chapter)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
                      >
                        <Trash2 size={14} className="text-white" />
                      </button>
                    </div>
                  )}

                  {/* 버튼 행: 내용 보기 / 내용 수정 / 사진 / 이야기 빼기 */}
                  <div className="flex justify-end gap-2 flex-wrap">
                    <button type="button" onClick={() => setViewingChapter(chapter)}
                      className="bg-[#F3F4F6] rounded-xl px-4 py-2 min-h-11 flex items-center gap-1.5">
                      <BookOpen size={15} className="text-[#6B7280]" />
                      <span className="text-base text-[#6B7280]">내용 보기</span>
                    </button>
                    <button type="button" onClick={() => openEditContent(chapter)}
                      disabled={editingChapterId === chapter.id}
                      className="bg-[#EFF6FF] rounded-xl px-4 py-2 min-h-11 flex items-center gap-1.5 disabled:opacity-40">
                      <Pencil size={15} className="text-[#3B82F6]" />
                      <span className="text-base text-[#3B82F6]">내용 수정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openPhotoUpload(chapter.id)}
                      disabled={uploadingPhotoId === chapter.id}
                      className="bg-[#F0FDF4] rounded-xl px-4 py-2 min-h-11 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {uploadingPhotoId === chapter.id
                        ? <span className="text-base text-[#16A34A]">올리는 중…</span>
                        : <>
                            <Camera size={15} className="text-[#16A34A]" />
                            <span className="text-base text-[#16A34A]">사진</span>
                          </>
                      }
                    </button>
                    {/* 단편은 챕터 삭제 불가 — 단편 생성 시 이미 주제를 선택했으므로 */}
                    {!isShortBook && (
                      <button type="button" onClick={() => setConfirmRemoveId(chapter.id)}
                        disabled={editingChapterId === chapter.id}
                        className="bg-[#FEF2F2] rounded-xl px-4 py-2 min-h-11 disabled:opacity-40">
                        <span className="text-base text-[#DC2626]">이 이야기 빼기</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {!isShortBook && activeChapters.length === 0 && (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-8 text-center">
                  <p className="text-base text-[#9CA3AF]">모든 이야기가 빠졌어요. 아래에서 다시 넣을 수 있어요.</p>
                </div>
              )}
            </div>

            {/* 삭제된 챕터 (되돌리기) — 단편은 삭제 버튼 자체가 없으므로 표시 안 함 */}
            {!isShortBook && deletedChapters.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-base text-[#9CA3AF] px-1">뺀 이야기 — 되돌릴 수 있어요</p>
                {deletedChapters.map(chapter => (
                  <div key={chapter.id}
                    className="bg-[#F3F4F6] border border-dashed border-[#D1D5DB] rounded-2xl px-5 py-3 flex items-center gap-3 opacity-60">
                    <p className="flex-1 text-[1.0625rem] text-[#6B7280] line-through truncate">{chapter.title}</p>
                    <button type="button" onClick={() => handleRestoreChapter(chapter.id)}
                      className="flex items-center gap-1.5 bg-white border border-[#D1D5DB] rounded-xl px-3 py-2 min-h-11 shrink-0">
                      <RotateCcw size={14} className="text-[#6B7280]" />
                      <span className="text-sm text-[#6B7280]">되돌리기</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </main>

          <div className="shrink-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4">
            <button type="button" onClick={() => setCurrentStep(2)}
              disabled={activeChapters.length === 0}
              className="w-full max-w-2xl mx-auto block disabled:opacity-40 rounded-2xl py-4 text-center"
              style={{ background: ACCENT }}>
              <span className="text-[1.25rem]" style={{ color: ACCENT_TEXT }}>다음으로</span>
            </button>
          </div>

          {/* 숨겨진 사진 업로드 input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoFileChange}
          />

          {/* 챕터 내용 보기 모달 */}
          {viewingChapter && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
              <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => setViewingChapter(null)} />
              <div className="relative bg-white rounded-2xl w-full max-w-sm flex flex-col gap-4 z-10 max-h-[75vh]">
                <div className="flex items-center justify-between px-5 pt-5">
                  <p className="text-[1.125rem] font-bold flex-1 pr-2" style={{ color: ACCENT }}>{viewingChapter.title}</p>
                  <button type="button" onClick={() => setViewingChapter(null)}
                    className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                    <X size={16} className="text-[#6B7280]" />
                  </button>
                </div>
                <div className="overflow-y-auto px-5 pb-5">
                  <p className="text-[1.0625rem] text-[#1F2937] leading-relaxed whitespace-pre-wrap">
                    {viewingChapter.content}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 챕터 내용 수정 모달 */}
          {editingContentChapter && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
              <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => !savingContent && setEditingContentChapter(null)} />
              <div className="relative bg-white rounded-2xl w-full max-w-sm flex flex-col z-10 max-h-[85vh]">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                  <p className="text-[1.125rem] font-bold text-[#1F2937] flex-1 pr-2">내용 수정</p>
                  <button type="button" onClick={() => !savingContent && setEditingContentChapter(null)}
                    className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                    <X size={16} className="text-[#6B7280]" />
                  </button>
                </div>
                <p className="px-5 pb-3 text-sm text-[#E8820C] shrink-0">{editingContentChapter.title}</p>
                {/* 텍스트 편집 영역 */}
                <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0">
                  <textarea
                    autoFocus
                    value={editingContent}
                    onChange={e => setEditingContent(e.target.value.slice(0, CONTENT_MAX))}
                    rows={10}
                    className="w-full bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 py-3 text-[1.0625rem] text-[#1F2937] resize-none outline-none focus:border-[#E8820C] leading-relaxed"
                  />
                  <p className="text-right text-sm text-[#9CA3AF] mt-1">{editingContent.length} / {CONTENT_MAX}</p>
                </div>
                {/* 하단 버튼 */}
                <div className="px-5 pb-5 flex gap-3 shrink-0">
                  <button type="button" onClick={() => !savingContent && setEditingContentChapter(null)}
                    className="flex-1 bg-[#F3F4F6] rounded-xl py-3 text-center min-h-11">
                    <span className="text-[1.0625rem] text-[#6B7280]">취소</span>
                  </button>
                  <button type="button" onClick={confirmEditContent} disabled={savingContent || !editingContent.trim()}
                    className="flex-[2] bg-[#E8820C] rounded-xl py-3 text-center min-h-11 disabled:opacity-50">
                    <span className="text-[1.0625rem] text-white">{savingContent ? '저장 중…' : '저장하기'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 챕터 빼기 확인 모달 */}
          {confirmRemoveId !== null && confirmChapter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => setConfirmRemoveId(null)} />
              <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 z-10">
                <p className="text-[1.375rem] font-bold text-[#1F2937] text-center">이 이야기를 뺄까요?</p>
                <div className="bg-[#FFF8F0] rounded-xl px-4 py-3 text-center">
                  <p className="text-[1.125rem] text-[#E8820C]">{confirmChapter.title}</p>
                </div>
                <p className="text-[1.125rem] text-[#6B7280] text-center">나중에 다시 넣을 수 있어요</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setConfirmRemoveId(null)}
                    className="flex-1 bg-[#FFF0DC] rounded-xl py-3 text-center min-h-11">
                    <span className="text-[1.125rem] text-[#E8820C]">취소</span>
                  </button>
                  <button type="button" onClick={() => handleRemoveChapter(confirmRemoveId)}
                    className="flex-1 bg-[#FEF2F2] rounded-xl py-3 text-center min-h-11">
                    <span className="text-[1.125rem] text-[#DC2626]">빼기</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Step 2: 표지 선택 (F-13) ── */}
      {currentStep === 2 && (
        <>
          <main className="flex-1 min-h-0 overflow-hidden w-full max-w-2xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3">
            {/* 제목 + 재생성 버튼 행 — shrink-0 으로 높이 고정 */}
            <div className="flex items-start justify-between gap-2 shrink-0">
              <div className="flex flex-col gap-1">
                <p className="text-[1.25rem] font-bold text-[#1F2937] whitespace-nowrap">
                  {isShortBook ? '단편 이야기 표지를 골라주세요' : '이번 달 책 표지를 골라주세요'}
                </p>
                <p className="text-[1.0625rem] text-[#6B7280]">
                  {isShortBook ? 'AI가 단편 이야기를 바탕으로 만들었어요' : 'AI가 이번 달 이야기를 바탕으로 만들었어요'}
                </p>
              </div>
              {/* 표지 추가 생성 버튼 — 최대 3장 추가 가능 */}
              {coverImages.length > 0 && (
                <button type="button"
                  disabled={regenerating || extraCoverCount >= extraCoverLimit}
                  className="shrink-0 flex flex-col items-center gap-1 mt-1 disabled:opacity-40"
                  onClick={async () => {
                    const chapterId = coverImages.find(c => c.id === selectedCoverId)?.chapter_id
                    if (!chapterId) return
                    try {
                      await regenerateCover(chapterId)
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : '표지 생성에 실패했어요')
                    }
                  }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center"
                    style={{ background: ACCENT_LIGHT, border: `1px solid ${ACCENT}` }}>
                    <RefreshCw size={20} className={cn(regenerating && 'animate-spin')} style={{ color: ACCENT }} />
                  </div>
                  <span className="text-xs" style={{ color: ACCENT }}>
                    {regenerating ? '생성 중…' : `다시 만들기 (${extraCoverCount}/${extraCoverLimit})`}
                  </span>
                </button>
              )}
            </div>

            {/* 표지 슬라이더 — flex-1 min-h-0 으로 남은 공간 모두 채워 하단 잘림 방지 */}
            <div className="flex-1 min-h-0">
              {/* regenerating(API 호출 중) 또는 coverLoading(폴링 중)이면 로딩 화면 유지 */}
              {(regenerating || coverLoading) ? (
                <div className="w-full h-full rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-[#FFF8F0] flex flex-col items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                    style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
                  <p className="text-[1.0625rem] text-[#6B7280]">AI가 표지를 만들고 있어요</p>
                  <p className="text-sm text-[#9CA3AF]">잠시만 기다려 주세요 (약 1분)</p>
                </div>
              ) : coverImages.length > 0 ? (
                <CoverSlider
                  covers={coverImages}
                  selectedId={selectedCoverId}
                  accent={ACCENT}
                  onSelect={setSelectedCoverId}
                />
              ) : (
                <div className="w-full h-full rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-[#FFF8F0] flex flex-col items-center justify-center gap-3">
                  {coverError ? (
                    <>
                      <p className="text-[1.0625rem] text-[#6B7280]">표지를 불러오지 못했어요</p>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="text-sm underline underline-offset-2"
                        style={{ color: ACCENT }}>
                        다시 시도
                      </button>
                    </>
                  ) : coverLoading ? (
                    <>
                      <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                        style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
                      <p className="text-[1.0625rem] text-[#6B7280]">AI가 표지를 만들고 있어요</p>
                      <p className="text-sm text-[#9CA3AF]">잠시만 기다려 주세요 (약 1분)</p>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </main>

          <div className="shrink-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4">
            {/* 단편: 표지 선택 후 바로 출간 확인 (작가의 말 단계 없음) */}
            <button type="button"
              onClick={() => isShortBook ? setPublishConfirmOpen(true) : setCurrentStep(3)}
              disabled={coverImages.length === 0}
              className="w-full max-w-2xl mx-auto block disabled:opacity-40 rounded-2xl py-4 text-center"
              style={{ background: ACCENT }}>
              <span className="text-[1.25rem]" style={{ color: ACCENT_TEXT }}>
                {isShortBook ? '이 표지로 출간하기' : '이 표지로 할게요'}
              </span>
            </button>
          </div>
        </>
      )}

      {/* ── 단편 Step 3: 출간 완료 (작가의 말 없음) ── */}
      {isShortBook && currentStep === 3 && published && (
        <Step4Published
          bookTitle={book?.title ?? '단편 이야기'}
          accent={ACCENT}
          chapterCount={activeChapters.length}
          onHome={() => navigate('/s')}
          onRead={() => bookId ? navigate(`/s/books/${bookId}`) : navigate('/s/books')}
        />
      )}

      {/* ── 월간 Step 3: 작가의 말 입력 ── */}
      {!isShortBook && currentStep === 3 && (
        <Step3AuthorNote
          authorNote={authorNote}
          onChangeAuthorNote={setAuthorNote}
          onNext={() => setPublishConfirmOpen(true)}
          onSkip={() => setPublishConfirmOpen(true)}
        />
      )}

      {/* ── 월간 Step 4: 출간 완료 (F-13) ── */}
      {!isShortBook && currentStep === 4 && published && (
        <Step4Published
          bookTitle={book?.title ?? '봄날의 기록'}
          accent={ACCENT}
          chapterCount={activeChapters.length}
          onHome={() => navigate('/s')}
          onRead={() => bookId ? navigate(`/s/books/${bookId}`) : navigate('/s/books')}
        />
      )}

      {/* ── 출간 확인 모달 ── */}
      {publishConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => setPublishConfirmOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 z-10">
            <p className="text-[1.375rem] font-bold text-[#1F2937] text-center">출간할까요?</p>
            <p className="text-[1.125rem] text-[#6B7280] text-center">출간 후에는 취소할 수 없어요.</p>
            <p className="text-[1.0625rem] text-[#6B7280] text-center">가족에게 알림이 전송돼요.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPublishConfirmOpen(false)}
                className="flex-1 bg-[#F3F4F6] rounded-xl py-3 text-center min-h-11">
                <span className="text-[1.125rem] text-[#6B7280]">취소</span>
              </button>
              <button type="button" onClick={handlePublish} disabled={publishing}
                className="flex-1 rounded-xl py-3 text-center min-h-11 disabled:opacity-50"
                style={{ background: ACCENT }}>
                <span className="text-[1.125rem]" style={{ color: ACCENT_TEXT }}>{publishing ? '출간 중…' : '출간하기'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1F2937] rounded-xl px-5 py-3 shadow-lg">
          <p className="text-base text-white whitespace-nowrap">{toastMsg}</p>
        </div>
      )}
    </div>
  )
}

// ─── 실제 표지 슬라이더 ──────────────────────────────────────────

function CoverSlider({ covers, selectedId, accent, onSelect }: {
  covers: CoverImage[]
  selectedId: string
  accent: string
  onSelect: (id: string) => void
}) {
  const currentIdx = covers.findIndex(c => c.id === selectedId)
  const idx = currentIdx < 0 ? 0 : currentIdx

  function prev() { onSelect(covers[(idx - 1 + covers.length) % covers.length].id) }
  function next() { onSelect(covers[(idx + 1) % covers.length].id) }

  return (
    <div className="relative w-full h-full">
      {/* 부모(flex-1 min-h-0)가 남은 공간을 모두 차지 → h-full로 이어받아 하단 잘림 없음 */}
      <div className="rounded-2xl overflow-hidden border-[3px] w-full h-full" style={{ borderColor: accent }}>
        <img src={covers[idx].image_url} alt="선택된 표지" className="w-full h-full object-contain" />
      </div>

      {/* 점 인디케이터 — 이미지 상단에 오버레이 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {covers.map((c, i) => (
          <div key={c.id} onClick={() => onSelect(c.id)}
            className="w-3 h-3 rounded-full cursor-pointer transition-all"
            style={{ background: i === idx ? accent : 'rgba(255,255,255,0.7)' }} />
        ))}
      </div>

      {/* 이전 버튼 */}
      <button type="button" onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-md">
        <ChevronLeft size={22} className="text-[#1F2937]" />
      </button>
      {/* 다음 버튼 */}
      <button type="button" onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-md">
        <ChevronLeft size={22} className="text-[#1F2937] rotate-180" />
      </button>
    </div>
  )
}

// ─── Step 3: 작가의 말 입력 ──────────────────────────────────────

function Step3AuthorNote({
  authorNote, onChangeAuthorNote, onNext, onSkip,
}: {
  authorNote: string
  onChangeAuthorNote: (v: string) => void
  onNext: () => void
  onSkip: () => void
}) {
  const MAX = 500
  const [sttOn, setSttOn] = useState(false)
  const [sttDuration, setSttDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startSTT = useCallback(async () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition })
        .webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('이 브라우저는 음성 입력을 지원하지 않아요. 직접 입력해주세요.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ko-KR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join('')
      onChangeAuthorNote(transcript.slice(0, MAX))
    }
    recognition.onerror = () => stopSTT()
    recognition.start()
    recognitionRef.current = recognition
    setSttDuration(0)
    timerRef.current = setInterval(() => setSttDuration((d) => d + 1), 1000)
    setSttOn(true)
  }, [onChangeAuthorNote])

  const stopSTT = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setSttOn(false)
  }, [])

  useEffect(() => () => stopSTT(), [stopSTT])

  const mm = String(Math.floor(sttDuration / 60)).padStart(2, '0')
  const ss = String(sttDuration % 60).padStart(2, '0')

  return (
    <>
      <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[1.5rem] text-[#1F2937]">작가의 말</p>
          <p className="text-[1.125rem] text-[#6B7280]">책의 맨 앞에 실려요. 독자(가족)에게 전하는 한마디예요</p>
        </div>

        <div className="bg-[#FFF0DC] rounded-2xl px-4 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
            <span className="text-sm text-white font-medium">AI</span>
          </div>
          <div className="flex-1 bg-white rounded-xl px-4 py-3">
            <p className="text-base text-[#1F2937]">"이 책을 쓰면서 어떤 마음이셨나요? 이 책을 읽을 가족에게 전하고 싶은 말을 써주세요."</p>
          </div>
        </div>

        <div className="relative bg-white border-2 border-[#E8820C] rounded-2xl px-5 py-5 flex flex-col items-center gap-3">
          <div className="absolute -top-3 left-4 bg-[#E8820C] rounded-lg px-2.5 py-0.5">
            <span className="text-sm text-white">추천</span>
          </div>

          {sttOn ? (
            <>
              <button type="button" onClick={stopSTT}
                className="w-14 h-14 rounded-full bg-[#DC2626] flex items-center justify-center shadow-lg">
                <span className="w-5 h-5 rounded bg-white" />
              </button>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[1.125rem] text-[#DC2626] font-medium tabular-nums">{mm}:{ss}</span>
                <span className="text-base text-[#6B7280]">말씀이 텍스트로 변환되고 있어요</span>
              </div>
              <p className="text-sm text-[#9CA3AF]">버튼을 누르면 녹음이 멈춰요</p>
            </>
          ) : (
            <>
              <button type="button" onClick={startSTT}
                className="w-14 h-14 rounded-full bg-[#E8820C] flex items-center justify-center">
                <Mic size={26} className="text-white" />
              </button>
              <p className="text-[1.125rem] text-[#E8820C]">마이크를 누르고 말씀해 주세요</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-base text-[#6B7280]">또는</span>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
          <p className="text-[1.125rem] text-[#1F2937]">직접 입력하기</p>
          <textarea
            value={authorNote}
            onChange={e => onChangeAuthorNote(e.target.value.slice(0, MAX))}
            rows={5}
            placeholder="가족에게 전하고 싶은 말을 입력해주세요"
            className="w-full bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 py-3 text-[1.0625rem] text-[#1F2937] resize-none outline-none focus:border-[#E8820C]"
          />
          <p className="text-right text-sm text-[#9CA3AF]">{authorNote.length} / {MAX}</p>
        </div>
      </main>

      <div className="shrink-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4 flex flex-col gap-3">
        <div className="flex gap-3 w-full max-w-2xl mx-auto">
          <button type="button" onClick={onSkip} className="flex-[2] bg-[#FFF0DC] rounded-2xl py-4 text-center">
            <span className="text-[1.125rem] text-[#E8820C]">건너뛰기</span>
          </button>
          <button type="button" onClick={onNext} className="flex-[5] bg-[#E8820C] rounded-2xl py-4 text-center">
            <span className="text-[1.25rem] text-white">출간하기</span>
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Step 4: 출간 완료 ───────────────────────────────────────────

const CONFETTI = [
  { emoji: '🎉', left: '8%',  delay: '0s',    dur: '2.8s' },
  { emoji: '✨', left: '20%', delay: '0.4s',  dur: '3.2s' },
  { emoji: '🎊', left: '35%', delay: '0.15s', dur: '2.6s' },
  { emoji: '📖', left: '50%', delay: '0.6s',  dur: '3.0s' },
  { emoji: '❤️', left: '65%', delay: '0.25s', dur: '2.9s' },
  { emoji: '🌟', left: '78%', delay: '0.5s',  dur: '3.1s' },
  { emoji: '🎈', left: '90%', delay: '0.1s',  dur: '2.7s' },
]

function Step4Published({
  bookTitle,
  accent,
  chapterCount,
  onHome,
  onRead,
}: {
  bookTitle: string
  accent: string
  chapterCount: number
  onHome: () => void
  onRead: () => void
}) {
  const [visible, setVisible] = useState(false)
  const accentText = accent === '#FACC15' ? '#1F2937' : 'white'
  const accentLight = accent === '#FACC15' ? '#FEF9C3' : '#FFF0DC'

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-40px) rotate(0deg) scale(1);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg) scale(0.6); opacity: 0; }
        }
        @keyframes publish-fade-up {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes publish-scale-in {
          from { opacity: 0; transform: scale(0.72); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes publish-glow {
          0%, 100% { box-shadow: 0 0 18px 4px rgba(232,130,12,0.25); }
          50%       { box-shadow: 0 0 36px 10px rgba(232,130,12,0.55); }
        }
        @keyframes publish-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* 컨페티 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-20">
        {CONFETTI.map((p, i) => (
          <span key={i} style={{
            position: 'absolute', left: p.left, top: '-40px',
            fontSize: '1.625rem',
            animation: `confetti-fall ${p.dur} ${p.delay} ease-in 1 forwards`,
          }}>{p.emoji}</span>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* 책 일러스트 */}
        <div className="flex justify-center pt-2">
          <div className="relative" style={{
            animation: visible ? 'publish-scale-in 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
            opacity: visible ? undefined : 0,
          }}>
            {/* 펄스 링 */}
            <div className="absolute inset-0 rounded-2xl" style={{
              background: accentLight,
              animation: 'publish-ring 1.6s ease-out 0.4s infinite',
            }} />
            {/* 책 그림자 레이어 */}
            <div className="absolute top-0 left-[-10px] w-[148px] h-[182px] rounded-2xl opacity-30" style={{ background: accentLight }} />
            <div className="absolute top-[14px] left-[-5px] w-[148px] h-[182px] rounded-2xl opacity-50" style={{ background: accentLight }} />
            {/* 메인 책 */}
            <div className="relative w-[148px] h-[182px] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 px-4 overflow-hidden"
              style={{
                background: accentLight,
                borderColor: accent,
                animation: 'publish-glow 2.4s ease-in-out 0.6s infinite',
              }}>
              <div className="absolute top-0 bottom-0 left-0 w-2 rounded-l-2xl opacity-40" style={{ background: accent }} />
              <span className="text-3xl">📖</span>
              <p className="text-[1.0625rem] text-center font-bold leading-snug" style={{ color: accent }}>{bookTitle}</p>
            </div>
          </div>
        </div>

        {/* 헤드라인 */}
        <div className="flex flex-col items-center gap-2 text-center"
          style={{ animation: visible ? 'publish-fade-up 0.5s 0.3s ease both' : 'none', opacity: visible ? undefined : 0 }}>
          <p className="text-[2rem] font-bold text-[#1F2937] leading-snug">
            🎉 책이 완성됐어요!
          </p>
          <p className="text-[1.25rem] text-[#374151]">
            소중한 이야기 <span className="font-bold" style={{ color: accent }}>{chapterCount}편</span>이
          </p>
          <p className="text-[1.25rem] text-[#374151]">가족의 책장에 올라갔어요</p>
          <p className="text-[1.0625rem] text-[#9CA3AF] mt-1">
            이 이야기는 가족과 함께 영원히 남을 거예요 ✨
          </p>
        </div>

        {/* 알림 카드 */}
        <div className="bg-[#DCFCE7] rounded-2xl px-5 py-4 flex items-center gap-3"
          style={{ animation: visible ? 'publish-fade-up 0.5s 0.5s ease both' : 'none', opacity: visible ? undefined : 0 }}>
          <div className="w-10 h-10 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
            <Check size={20} className="text-white" strokeWidth={3} />
          </div>
          <div>
            <p className="text-[1.125rem] font-medium text-[#1F2937]">가족에게 알림을 보냈어요</p>
            <p className="text-[0.9375rem] text-[#6B7280]">연결된 가족 모두가 곧 읽을 거예요</p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex flex-col gap-3"
          style={{ animation: visible ? 'publish-fade-up 0.5s 0.65s ease both' : 'none', opacity: visible ? undefined : 0 }}>
          <button type="button" onClick={onRead}
            className="w-full rounded-2xl py-4 text-center shadow-lg active:scale-95 transition-transform"
            style={{ background: accent }}>
            <span className="text-[1.25rem] font-bold" style={{ color: accentText }}>지금 바로 읽어보기</span>
          </button>
          <button type="button" onClick={onHome} className="py-3 text-center">
            <span className="text-[1.125rem] text-[#9CA3AF]">홈으로 돌아가기</span>
          </button>
        </div>

      </main>
    </>
  )
}
