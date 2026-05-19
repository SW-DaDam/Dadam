import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 마지막 글자 받침 여부에 따라 올바른 조사 반환
// 예: josa('엄마', '이', '가') → '가', josa('아들', '이', '가') → '이'
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  if (!word) return withBatchim
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xAC00 || code > 0xD7A3) return withBatchim
  return (code - 0xAC00) % 28 !== 0 ? withBatchim : withoutBatchim
}

// 상대적 시간 표시 — 예: '방금 전', '5분 전', '2시간 전', '3일 전'
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  return `${d}일 전`
}
