import AiBadge from './AiBadge'

// AI가 응답을 생성 중임을 나타내는 바운싱 점 인디케이터
export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <AiBadge />
      <div className="bg-[#FFF0DC] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        {([1, 0.6, 0.3] as const).map((opacity, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-[#E8820C] animate-bounce"
            style={{ opacity, animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
