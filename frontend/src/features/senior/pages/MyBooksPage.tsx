import { useNavigate } from 'react-router'
import { Plus, Edit3 } from 'lucide-react'

const BOOKS = [
  {
    id: 'april',
    month: '4월',
    title: '봄날의 기록',
    subtitle: '2025년 4월',
    chapters: 3,
    status: 'draft' as const,
    bg: '#FFF0DC',
    border: '#E8820C',
    accent: '#E8820C',
    textColor: '#E8820C',
  },
  {
    id: 'march',
    month: '3월',
    title: '봄비 내리는 날',
    subtitle: '2025년 3월',
    chapters: 5,
    status: 'published' as const,
    bg: '#DCFCE7',
    border: '#16A34A',
    accent: '#16A34A',
    textColor: '#16A34A',
  },
  {
    id: 'february',
    month: '2월',
    title: '겨울 끝자락',
    subtitle: '2025년 2월',
    chapters: 4,
    status: 'published' as const,
    bg: '#FEF9C3',
    border: '#CA8A04',
    accent: '#CA8A04',
    textColor: '#CA8A04',
  },
  {
    id: 'january',
    month: '1월',
    title: '새해의 다짐',
    subtitle: '2025년 1월',
    chapters: 3,
    status: 'published' as const,
    bg: '#F3F4F6',
    border: '#E5E7EB',
    accent: '#9CA3AF',
    textColor: '#6B7280',
  },
]

const STATUS_LABEL = {
  draft: { label: '작성 중', bg: '#FFF0DC', color: '#E8820C' },
  published: { label: '출간됨', bg: '#DCFCE7', color: '#16A34A' },
}

export default function MyBooksPage() {
  const navigate = useNavigate()

  const draftBook = BOOKS.find((b) => b.status === 'draft')
  const publishedBooks = BOOKS.filter((b) => b.status === 'published')

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 shrink-0">
        <h1 className="text-lg sm:text-xl text-[#1F2937] font-medium">내 책장</h1>
        <button
          type="button"
          onClick={() => navigate('/s/books/new/edit')}
        className="flex items-center gap-1.5 bg-[#E8820C] rounded-xl px-4 py-2.5 min-h-11"
        >
          <Plus size={16} className="text-white" />
          <span className="text-sm text-white">새 책 만들기</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {/* 작성 중인 책 */}
        {draftBook && (
          <div className="flex flex-col gap-2">
            <p className="text-base text-[#6B7280] px-1">작성 중인 책</p>
            <div className="bg-white border-2 border-[#E8820C] rounded-2xl overflow-hidden">
              <div className="flex items-stretch gap-4 px-5 py-4">
                {/* 책 표지 */}
                <div className="relative w-[64px] shrink-0">
                  <div
                    className="w-full rounded-lg py-4 flex flex-col items-center gap-0"
                    style={{ backgroundColor: draftBook.bg, border: `1.5px solid ${draftBook.border}` }}
                  >
                    <p className="text-xs" style={{ color: draftBook.textColor }}>
                      {draftBook.title.slice(0, 3)}
                    </p>
                    <p className="text-xs" style={{ color: draftBook.textColor }}>
                      {draftBook.title.slice(3)}
                    </p>
                    <p className="text-[10px] text-[#6B7280] mt-1">{draftBook.month}</p>
                  </div>
                  <div
                    className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-lg opacity-35"
                    style={{ backgroundColor: draftBook.accent }}
                  />
                </div>

                {/* 책 정보 */}
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[1.25rem] text-[#1F2937]">{draftBook.title}</p>
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{ backgroundColor: STATUS_LABEL.draft.bg }}
                      >
                        <span className="text-xs" style={{ color: STATUS_LABEL.draft.color }}>
                          {STATUS_LABEL.draft.label}
                        </span>
                      </span>
                    </div>
                    <p className="text-base text-[#6B7280]">{draftBook.subtitle}</p>
                    <p className="text-base text-[#6B7280]">챕터 {draftBook.chapters}개</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/s/books/${draftBook.id}/edit`)}
                className="w-full bg-[#E8820C] py-3 flex items-center justify-center gap-2"
              >
                <Edit3 size={16} className="text-white" />
                <span className="text-[1.0625rem] text-white">이어서 쓰기</span>
              </button>
            </div>
          </div>
        )}

        {/* 출간된 책 */}
        {publishedBooks.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-base text-[#6B7280] px-1">출간된 책 {publishedBooks.length}권</p>
            <div className="flex flex-col gap-3">
              {publishedBooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-white border border-[#E5E7EB] rounded-2xl flex items-stretch gap-4 px-5 py-4"
                >
                  {/* 책 표지 */}
                  <div className="relative w-[56px] shrink-0">
                    <div
                      className="w-full h-full rounded-lg py-3 flex flex-col items-center justify-center gap-0 min-h-[72px]"
                      style={{ backgroundColor: book.bg, border: `1.5px solid ${book.border}` }}
                    >
                      <p className="text-[10px]" style={{ color: book.textColor }}>
                        {book.month}
                      </p>
                    </div>
                    <div
                      className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-lg opacity-35"
                      style={{ backgroundColor: book.accent }}
                    />
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
                    <p className="text-[1.0625rem] text-[#1F2937]">{book.title}</p>
                    <p className="text-sm text-[#6B7280]">{book.subtitle}</p>
                    <p className="text-sm text-[#6B7280]">챕터 {book.chapters}개</p>
                  </div>

                  {/* 편집 버튼 */}
                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/s/books/${book.id}/edit`)}
                      className="bg-[#F3F4F6] rounded-xl px-3 py-2 min-h-11 flex items-center gap-1"
                    >
                      <Edit3 size={14} className="text-[#6B7280]" />
                      <span className="text-sm text-[#6B7280]">편집</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
