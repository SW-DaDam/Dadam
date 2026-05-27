import type { Tables, Enums } from '@/types/database'

// ─── Enum 타입 ────────────────────────────────────────────────

export type UserRole = Enums<'user_role'>           // 'senior' | 'family'
export type BookStatus = Enums<'book_status'>       // 'draft' | 'editing' | 'published'
export type BookType = Enums<'book_type'>           // 'monthly' | 'short'
export type CoverStatus = Enums<'cover_status'>     // 'candidate' | 'selected' | 'rejected'
export type InviteStatus = Enums<'invite_status'>   // 'pending' | 'accepted' | 'expired' | 'revoked'
export type NotificationType = Enums<'notification_type'>
export type SpeakerRole = Enums<'speaker_role'>     // 'senior' | 'ai'
export type UtteranceTag = Enums<'utterance_tag'>

// ─── DB Row 별칭 ──────────────────────────────────────────────

export type Profile = Tables<'profiles'>
export type SeniorProfile = Tables<'senior_profiles'>
export type FamilyLink = Tables<'family_links'>
export type Book = Tables<'books'>
export type Chapter = Tables<'chapters'>
export type Comment = Tables<'comments'>
export type Reply = Tables<'replies'>
export type Memory = Tables<'memories'>
export type Conversation = Tables<'conversations'>
export type Utterance = Tables<'utterances'>
export type CoverImage = Tables<'cover_images'>
export type Notification = Tables<'notifications'>

// ─── UI 조합 타입 ─────────────────────────────────────────────

/** 로그인된 사용자 (profile + 역할별 추가 정보) */
export type AuthUser = Profile & {
  seniorProfile?: SeniorProfile
}

/** 가족 구성원 (가족 링크 + 프로필) */
export type FamilyMember = FamilyLink & {
  profile: Profile
}

/** 챕터 포함 책 */
export type BookWithChapters = Book & {
  chapters: Chapter[]
}

/** 책장 표시용 — 댓글 수 집계 포함 */
export type BookWithStats = Book & {
  commentCount: number
}

/** 댓글 + 답글 묶음 */
export type CommentWithReplies = Comment & {
  replies: Reply[]
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
}

/** 책 읽기 화면용 챕터 */
export type ChapterWithComments = Chapter & {
  comments: CommentWithReplies[]
}

// ─── TTS 설정 (F-03) ─────────────────────────────────────────

/**
 * Naver Clova Voice Premium speaker ID (6종)
 * 여성: nyejin(예진/일반), noyj(봄달/일반), vara(아라/Pro)
 * 남성: nminsang(민상/일반), nsiyoon(시윤/일반), vian(이안/Pro)
 */
export type TtsVoice = 'nyejin' | 'noyj' | 'vara' | 'nminsang' | 'nsiyoon' | 'vian'

/** TTS 말하기 속도 — Edge Function에서 Clova speed(-5~10)로 매핑 */
export type TtsSpeed = 'slow' | 'normal' | 'fast'

/** AI 말동무 말투 스타일 (senior_profiles.speech_style)
 *  counselor: 공손한 상담사 (존댓말, 감정 검증 중심)
 *  friend:    친근한 친구  (반말, 오랜 친구처럼 편안한 어투)
 */
export type SpeechStyle = 'counselor' | 'friend'

/** 어르신 TTS + 말투 설정 (senior_profiles) */
export interface TtsSettings {
  voice: TtsVoice
  speed: TtsSpeed
  speech_style: SpeechStyle
}

// ─── 음성 대화 ────────────────────────────────────────────────

export type VoiceChatState = 'idle' | 'listening' | 'processing' | 'speaking'

export type ChatMessage = Pick<Utterance, 'id' | 'content' | 'created_at' | 'speaker' | 'tags'>

// ─── 책 편집 ─────────────────────────────────────────────────

export type BookEditStep = 1 | 2 | 3 | 4

export type CoverTheme = {
  id: string
  label: string
  bg: string
  accent: string
}

// ─── 초대 ─────────────────────────────────────────────────────

export type InviteCode = {
  code: string
  expiresAt: string
  status: InviteStatus
}

// ─── 알림 ─────────────────────────────────────────────────────

export type NotificationItem = Notification & {
  isRead: boolean
}

// ─── 네비게이션 ───────────────────────────────────────────────

export type SeniorNavTab = 'home' | 'chat' | 'books' | 'family' | 'settings'
export type ReaderNavTab = 'home' | 'notifications' | 'settings'

// ─── 책 생성 파이프라인 (F-06) ───────────────────────────────

/** 책 생성 job 단계 상태 (ERD job_status Enum과 동일) */
export type JobStatus =
  | 'pending'          // job 생성됨, 파이프라인 시작 전
  | 'aggregating'      // 발화 수집·선별 중
  | 'chaptering'       // LLM 챕터 구성·서사 생성 중
  | 'cover_requested'  // 표지 생성 요청 완료 (F-07 처리 중)
  | 'done'             // 전체 파이프라인 완료
  | 'failed'           // 임의 단계 실패

/** 책 생성 job (book_generation_jobs 테이블 기반) */
export interface BookGenerationJob {
  id: string
  senior_id: string
  book_id: string | null        // chaptering 완료 후 채워짐
  status: JobStatus
  retry_count: number
  error_log: string | null      // "[단계명] 에러 메시지" 형식
  stage_payload: {
    aggregated_ids?: string[]   // aggregating 단계 결과 보존
    book_id?: string            // chaptering 완료 후 보존
  }
  created_at: string
  updated_at: string
}

// ─── 메모리 (F-04) ────────────────────────────────────────────

/** memories.data JSONB — LLM이 자동 생성하는 플랫 items 배열 */
export interface MemoryData {
  items?: MemoryItem[]
}

/** LLM이 추출·분류하는 메모리 항목 (DB 저장 단위) */
export interface MemoryItem {
  text: string          // 기억 내용
  category: string      // LLM이 자유롭게 결정 (취미, 가족, 건강, 일상, 추억, 가치관 등)
  emoji: string         // 카테고리에 맞는 이모지
  expires_at?: string   // 일정 카테고리 전용 만료일 (YYYY-MM-DD), 지난 항목은 AI 컨텍스트에서 제외
}
