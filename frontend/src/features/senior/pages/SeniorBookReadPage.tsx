import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Mic, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const CHAPTERS = [
  {
    id: 1,
    label: '1. 봄 텃밭',
    body: [
      { text: '4월 초부터 시작한 텃밭 가꾸기가 드디어 결실을 맺었다.', highlight: false },
      { text: '빨간 토마토 다섯 개를 수확했는데, 향이 얼마나 좋던지.', highlight: true },
      { text: '손녀 수빈이한테도 갖다 줬더니 눈이 반짝반짝 빛났다.', highlight: false },
    ],
  },
  { id: 2, label: '2. 수빈이', body: [{ text: '드디어 수빈이가 중학생이 되었다. 교복을 입은 모습이 어찌나 예쁘고 대견하던지 눈물이 날 것 같았다.', highlight: false }] },
  { id: 3, label: '3. 봄비', body: [{ text: '오랜만에 봄비가 내렸다. 빗소리를 들으며 옛 생각이 났다. 젊은 시절 남편과 함께 걷던 골목이 떠올랐다.', highlight: false }] },
]

const COMMENTS = [
  {
    id: 1,
    initial: '준',
    avatarBg: '#FFF0DC',
    avatarColor: '#E8820C',
    name: '김민준',
    text: '엄마, 토마토 사진 보내주세요!',
    time: '1시간 전',
    reply: {
      text: '사진은 다음에 찍어서 보내줄게',
      time: '30분 전',
    },
  },
]

export default function SeniorBookReadPage() {
  const navigate = useNavigate()
  const [activeChapter, setActiveChapter] = useState(1)
  const [commentText, setCommentText] = useState('')

  const chapter = CHAPTERS.find((c) => c.id === activeChapter)!

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0]">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button" onClick={() => navigate(-1)} className="flex flex-col items-center justify-center min-h-11 min-w-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
          <span className="text-xs text-[#6B7280]">뒤로</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold text-[#1F2937] whitespace-nowrap">
          2025년 4월 이야기
        </h1>
        <button type="button" className="ml-auto bg-[#FFF0DC] rounded-xl px-3 py-2 flex flex-col items-center min-h-11 justify-center">
          <Share2 size={15} className="text-[#E8820C]" />
          <span className="text-xs text-[#E8820C]">공유</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto">

        {/* 책 표지 */}
        <div className="mx-3 mt-3 bg-[#FFF0DC] rounded-2xl px-6 py-5 flex flex-col items-center gap-2 relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-2 bg-[#E8820C] opacity-25" />
          <div className="absolute top-0 bottom-0 right-0 w-2 bg-[#E8820C] opacity-15" />
          {/* 상단 장식선 */}
          <div className="w-full h-[1.5px] border-t border-[#E8820C] opacity-20" />
          <p className="text-[1.5rem] font-bold text-[#E8820C]">봄날의 기록</p>
          <p className="text-base text-[#6B7280]">김영숙 지음 · 2025년 4월</p>
          {/* 하단 장식선 */}
          <div className="w-full h-[1.5px] border-t border-[#E8820C] opacity-20" />
        </div>

        {/* 챕터 탭 */}
        <div className="bg-white border-b border-[#E5E7EB] flex">
          {CHAPTERS.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChapter(c.id)}
              className={cn(
                'flex-1 py-3 text-[1.125rem] relative text-center',
                c.id === activeChapter ? 'text-[#E8820C] font-bold' : 'text-[#6B7280]',
                i > 0 ? 'border-l border-[#E5E7EB]' : ''
              )}
            >
              {c.label}
              {c.id === activeChapter && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#E8820C] rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div className="bg-white px-6 py-5 flex flex-col gap-2">
          {chapter.body.map((line, i) =>
            line.highlight ? (
              <div key={i} className="relative bg-[#FFF0DC] rounded-lg px-4 py-2 flex items-center gap-2">
                <p className="flex-1 text-[1.125rem] text-[#1F2937]">{line.text}</p>
                {/* 하이라이트 마커 */}
                <div className="shrink-0 flex flex-col gap-0.5">
                  <div className="w-1.5 h-3 bg-[#E8820C] rounded-full" />
                  <div className="w-1.5 h-3 bg-[#E8820C] rounded-full opacity-60" />
                </div>
              </div>
            ) : (
              <p key={i} className="text-[1.125rem] text-[#1F2937] leading-relaxed">{line.text}</p>
            )
          )}
        </div>

        <div className="h-px bg-[#E5E7EB]" />

        {/* 댓글 섹션 */}
        <div className="bg-white px-6 py-5 flex flex-col gap-4">
          <p className="text-[1.125rem] font-bold text-[#1F2937]">가족 댓글 {COMMENTS.length}개</p>

          <div className="h-px bg-[#E5E7EB]" />

          {COMMENTS.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-3">
              {/* 댓글 */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: comment.avatarBg }}>
                  <span className="text-sm font-bold" style={{ color: comment.avatarColor }}>{comment.initial}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-base font-bold text-[#1F2937]">{comment.name}</p>
                  <p className="text-[1.125rem] text-[#1F2937]">{comment.text}</p>
                  <p className="text-sm text-[#6B7280]">{comment.time}</p>
                </div>
              </div>

              {/* 저자 답장 */}
              {comment.reply && (
                <div className="ml-6 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">엄마</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[0.9375rem] font-bold text-[#E8820C]">엄마의 답장</p>
                    <p className="text-[1.125rem] text-[#1F2937]">{comment.reply.text}</p>
                    <p className="text-sm text-[#6B7280]">{comment.reply.time}</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="h-px bg-[#E5E7EB]" />

          {/* 댓글 입력 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글 남기기"
              className="flex-1 bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 py-3 text-[1.125rem] text-[#1F2937] placeholder-[#D1D5DB] outline-none focus:border-[#E8820C]"
            />
            <button type="button" className="bg-[#E8820C] rounded-xl px-4 py-3 min-h-11 shrink-0">
              <span className="text-[1.125rem] text-white">전달하기</span>
            </button>
          </div>

          {/* 음성 댓글 */}
          <div className="bg-[#FFF8F0] rounded-2xl px-4 py-4 flex flex-col items-center gap-3">
            <p className="text-base text-[#6B7280] text-center">음성으로 댓글을 남기려면 마이크 버튼을 눌러주세요</p>
            <button type="button" className="w-12 h-12 rounded-full bg-[#FFF0DC] flex items-center justify-center">
              <Mic size={22} className="text-[#E8820C]" />
            </button>
            <span className="text-base text-[#E8820C]">음성 댓글</span>
          </div>
        </div>

      </main>
    </div>
  )
}
