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

/** 댓글 + 답글 묶음 */
export type CommentWithReplies = Comment & {
  replies: Reply[]
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
}

/** 책 읽기 화면용 챕터 */
export type ChapterWithComments = Chapter & {
  comments: CommentWithReplies[]
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
