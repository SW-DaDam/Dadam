import { useNavigate } from 'react-router'
import { UserPlus } from 'lucide-react'

const BOOKS_ROW1 = [
  { month: '4월', year: '2025', days: 18, bg: '#FFF0DC', accent: '#E8820C', color: '#E8820C', comments: 3 },
  { month: '3월', year: '2025', days: 22, bg: '#DCFCE7', accent: '#16A34A', color: '#16A34A', comments: 7 },
  { month: '2월', year: '2025', days: 20, bg: '#FEF9C3', accent: '#CA8A04', color: '#CA8A04', comments: 0 },
]

const BOOKS_ROW2 = [
  { month: '1월',  year: '2025', days: 19, bg: '#E0F2FE', accent: '#0369A1', color: '#0369A1', comments: 0 },
  { month: '12월', year: '2024', days: 25, bg: '#F3E8FF', accent: '#7C3AED', color: '#7C3AED', comments: 0 },
  { month: '11월', year: '2024', days: 17, bg: '#FCE7F3', accent: '#BE185D', color: '#BE185D', comments: 0 },
]

const ACTIVITIES = [
  { initial: '준', avatarBg: '#FFF0DC', avatarColor: '#E8820C', name: '김민준', action: '4월 챕터 1에 댓글을 달았어요', time: '1시간 전', badgeBg: '#FFF0DC', badgeColor: '#E8820C', badgeLabel: '💬 댓글' },
  { initial: '빈', avatarBg: '#DCFCE7', avatarColor: '#16A34A', name: '이수빈', action: '3월 책에 사진을 추가했어요', time: '어제', badgeBg: '#DCFCE7', badgeColor: '#16A34A', badgeLabel: '📷 사진' },
  { initial: '영', avatarBg: '#FEF9C3', avatarColor: '#CA8A04', name: '박지영', action: '4월 책에 하이라이트를 표시했어요', time: '2일 전', badgeBg: '#FEF9C3', badgeColor: '#CA8A04', badgeLabel: '✏ 하이라이트' },
]

function BookSpine({ month, year, days, bg, accent, color, comments }: typeof BOOKS_ROW1[0]) {
  return (
    <div className="relative flex-1 flex flex-col rounded-lg overflow-hidden" style={{ backgroundColor: bg }}>
      {/* 왼쪽 세로 accent */}
      <div className="absolute top-0 bottom-0 left-0 w-2 opacity-30" style={{ backgroundColor: accent }} />
      {/* 댓글 뱃지 */}
      {comments > 0 && (
        <div className="absolute top-1.5 right-1.5 rounded px-1.5 py-0.5 flex flex-col items-center" style={{ backgroundColor: accent }}>
          <span className="text-[9px] font-bold text-white leading-tight">댓글</span>
          <span className="text-[9px] font-bold text-white leading-tight">{comments}</span>
        </div>
      )}
      <div className="flex flex-col items-center py-4 gap-1 pl-2">
        {/* 세로선 장식 */}
        <div className="w-4 h-4 border rounded opacity-20" style={{ borderColor: accent }} />
        <p className="text-[1.375rem] font-bold text-center" style={{ color }}>{month}</p>
        <p className="text-xs text-center" style={{ color }}>{year}</p>
        <div className="w-[80%] h-px opacity-20" style={{ backgroundColor: accent }} />
        <p className="text-[11px] text-center" style={{ color }}>{days}일의 이야기</p>
      </div>
    </div>
  )
}

function ShelfRow({ books }: { books: typeof BOOKS_ROW1 }) {
  return (
    <div className="flex flex-col">
      <div className="flex gap-3 px-3 pt-3 pb-2">
        {books.map((book) => (
          <BookSpine key={book.month} {...book} />
        ))}
      </div>
      {/* 선반 판 */}
      <div className="h-3 mx-0 rounded-b" style={{ backgroundColor: '#C4A882' }} />
    </div>
  )
}

export default function FamilyBookshelfPage() {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 shrink-0">
        <h1 className="text-[1.5rem] font-bold text-[#1F2937]">엄마의 책장</h1>
        <button
          type="button"
          onClick={() => navigate('/s/family/invite')}
          className="bg-[#FFF0DC] rounded-xl px-4 py-2.5 flex items-center gap-1.5 min-h-11"
        >
          <UserPlus size={15} className="text-[#E8820C]" />
          <span className="text-sm text-[#E8820C]">초대</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 pb-4 w-full max-w-2xl mx-auto">

        {/* 책장 영역 */}
        <div className="flex flex-col" style={{ backgroundColor: '#F5E6D0' }}>
          {/* 상단 선반 테두리 */}
          <div className="h-2" style={{ backgroundColor: '#C4A882' }} />
          <ShelfRow books={BOOKS_ROW1} />
          <ShelfRow books={BOOKS_ROW2} />
        </div>

        {/* 이번 달 진행 카드 */}
        <div className="mx-4 sm:mx-6 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
          <p className="text-[1.25rem] font-bold text-[#1F2937]">이번 달 내 책</p>
          {/* 프로그레스 바 */}
          <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div className="h-full bg-[#E8820C] rounded-full" style={{ width: '60%' }} />
          </div>
          <p className="text-base text-[#6B7280]">18일 대화 완료 · 월말까지 12일 남았어요</p>
          <button
            type="button"
            onClick={() => navigate('/s/books/april')}
            className="w-full bg-[#FFF0DC] rounded-xl py-3 text-center"
          >
            <span className="text-[1.125rem] text-[#E8820C]">책 미리보기</span>
          </button>
        </div>

        {/* 가족 최근 활동 */}
        <div className="mx-4 sm:mx-6 bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <p className="text-[1.25rem] font-bold text-[#1F2937] px-5 pt-4 pb-3">가족 최근 활동</p>
          <div className="divide-y divide-[#E5E7EB]">
            {ACTIVITIES.map((a) => (
              <div key={a.name} className="flex items-center gap-3 px-5 py-4">
                {/* 아바타 */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: a.avatarBg }}>
                  <span className="text-sm font-bold" style={{ color: a.avatarColor }}>{a.initial}</span>
                </div>
                {/* 내용 */}
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-base font-bold text-[#1F2937]">{a.name}</p>
                  <p className="text-base text-[#6B7280]">{a.action}</p>
                  <p className="text-sm text-[#6B7280]">{a.time}</p>
                </div>
                {/* 뱃지 */}
                <div className="rounded-lg px-2.5 py-1.5 shrink-0" style={{ backgroundColor: a.badgeBg }}>
                  <span className="text-sm" style={{ color: a.badgeColor }}>{a.badgeLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
