import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

type Voice = 'female' | 'male'
type Speed = '천천히' | '보통' | '빠르게'
type Volume = '작게' | '보통' | '크게'

const SPEED_BARS_FEMALE = [0.5, 0.7, 1, 0.8, 0.6, 0.7, 0.4]
const SPEED_BARS_MALE = [1, 0.8, 0.9, 0.7, 0.85, 1, 0.9]

function Waveform({ active }: { active: boolean }) {
  const bars = active ? SPEED_BARS_FEMALE : SPEED_BARS_MALE
  const color = active ? '#E8820C' : '#D1D5DB'
  return (
    <div className="flex items-center gap-[3px] h-5">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full"
          style={{ height: `${h * 100}%`, backgroundColor: color, opacity: active ? (h < 0.6 ? 0.5 : h < 0.8 ? 0.7 : 1) : 1 }}
        />
      ))}
    </div>
  )
}

function VoiceCard({ type, active, onClick }: { type: Voice; active: boolean; onClick: () => void }) {
  const isFemale = type === 'female'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-2xl p-4 flex flex-col items-center gap-2 relative border transition-colors',
        active ? 'bg-[#FFF0DC] border-[#E8820C] border-[2.5px]' : 'bg-[#F9FAFB] border-[#E5E7EB]',
      )}
    >
      {active && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#E8820C] flex items-center justify-center">
          <span className="text-[11px] text-white font-bold">✓</span>
        </div>
      )}
      {/* 아이콘 */}
      <div className="relative w-10 h-10 flex items-center justify-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: active ? '#E8820C' : '#D1D5DB' }}
        >
          <div
            className="w-5 h-5 rounded-full opacity-90"
            style={{ backgroundColor: '#FFFFFF' }}
          />
        </div>
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-3 rounded-full opacity-90"
          style={{ backgroundColor: '#FFFFFF' }}
        />
      </div>
      <p className="text-[1.25rem] text-[#1F2937]">{isFemale ? '여자 목소리' : '남자 목소리'}</p>
      <p className="text-base text-[#6B7280]">{isFemale ? '부드럽고 따뜻해요' : '낮고 안정적이에요'}</p>
      <Waveform active={active} />
    </button>
  )
}

function OptionBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 py-3 rounded-xl relative border transition-colors text-[1.125rem]',
        active ? 'bg-[#FFF0DC] border-[#E8820C] border-[2.5px] text-[#E8820C]' : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#6B7280]',
      )}
    >
      {active && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#E8820C] flex items-center justify-center">
          <span className="text-[9px] text-white font-bold">✓</span>
        </div>
      )}
      {label}
    </button>
  )
}

export default function AiVoiceSettingsPage() {
  const navigate = useNavigate()
  const [voice, setVoice] = useState<Voice>('female')
  const [speed, setSpeed] = useState<Speed>('천천히')
  const [volume, setVolume] = useState<Volume>('보통')

  const speedLabel = speed === '천천히' ? '천천히' : speed === '보통' ? '보통' : '빠르게'
  const summary = `${voice === 'female' ? '여자' : '남자'} 목소리 · ${speedLabel} · ${volume} 음량`

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">AI 목소리 설정</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto pb-48">

        {/* 미리보기 배너 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
            <span className="text-sm text-white font-bold">AI</span>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-[1.125rem] text-[#1F2937]">&ldquo;안녕하세요, 김영숙 님!&rdquo;</p>
            <p className="text-base text-[#6B7280]">설정을 바꾸면 바로 미리 들을 수 있어요</p>
          </div>
          <button
            type="button"
            className="bg-[#E8820C] rounded-xl px-3 py-2 flex items-center gap-1.5 shrink-0 min-h-11"
          >
            <Play size={14} className="text-white fill-white" />
            <span className="text-base text-white">들어보기</span>
          </button>
        </div>

        {/* 목소리 섹션 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">목소리</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 flex gap-3">
            <VoiceCard type="female" active={voice === 'female'} onClick={() => setVoice('female')} />
            <VoiceCard type="male" active={voice === 'male'} onClick={() => setVoice('male')} />
          </div>
        </div>

        {/* 말하는 속도 섹션 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">말하는 속도</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex gap-3">
              {(['천천히', '보통', '빠르게'] as Speed[]).map((s) => (
                <OptionBtn key={s} label={s} active={speed === s} onClick={() => setSpeed(s)} />
              ))}
            </div>
            <p className="text-sm text-[#6B7280] text-center">귀에 편한 속도로 설정해 두면 편해요</p>
          </div>
        </div>

        {/* 음량 섹션 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">음량</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
            <div className="flex gap-3">
              {(['작게', '보통', '크게'] as Volume[]).map((v) => (
                <OptionBtn key={v} label={v} active={volume === v} onClick={() => setVolume(v)} />
              ))}
            </div>
          </div>
        </div>

        {/* 미리 듣기 카드 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 flex flex-col items-center gap-3">
          <p className="text-[1.125rem] text-[#1F2937]">현재 설정으로 들어보기</p>
          <p className="text-base text-[#6B7280]">{summary}</p>
          <button
            type="button"
            className="bg-[#FFF0DC] border-[1.5px] border-[#E8820C] rounded-xl px-5 py-3 flex items-center gap-2 min-h-11"
          >
            <Play size={16} className="text-[#E8820C] fill-[#E8820C]" />
            <span className="text-[1.0625rem] text-[#E8820C]">&ldquo;안녕하세요, 김영숙 님!&rdquo; 듣기</span>
          </button>
        </div>

      </main>

      {/* 하단 저장 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 pt-3 pb-8">
        <p className="text-base text-[#6B7280] text-center mb-3">설정은 다음 대화부터 바로 적용돼요</p>
        <button
          type="button"
          className="w-full max-w-2xl mx-auto block bg-[#E8820C] rounded-2xl py-4 text-center"
        >
          <span className="text-[1.375rem] text-white">저장하기</span>
        </button>
      </div>

    </div>
  )
}
