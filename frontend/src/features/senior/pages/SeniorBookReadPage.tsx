import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronLeft, Mic, Square, Play, Pause } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { josa, toHttps } from '@/lib/utils'
import { sendPushToUser } from '@/lib/pushNotification'
import { useVoiceReply, formatDuration } from '@/features/senior/hooks/useVoiceReply'
import { useContentFontSizeStore, type ContentFontSize } from '@/shared/stores/contentFontSizeStore'
import type { Book, Chapter, Comment, Reply, Profile } from '@/types/domain'

const CONTENT_SIZE_OPTIONS: { value: ContentFontSize; label: string }[] = [
  { value: 'small', label: '작게' },
  { value: 'medium', label: '보통' },
  { value: 'large', label: '크게' },
]

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😢', '🙏'] as const

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface ReplyWithAuthor extends Reply {
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> & { full_name?: string | null } | null
  relationship: string | null
}

interface CommentWithData extends Comment {
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> & { full_name?: string | null } | null
  relationship: string | null
  replies: ReplyWithAuthor[]
}

// ─── 훅: 책 읽기 데이터 조회 ─────────────────────────────────────────────────

function useBookRead(bookId: string | undefined) {
  const [book, setBook] = useState<Book | null>(null)
  const [seniorName, setSeniorName] = useState<string>('')
  const [chapters, setChapters] = useState<Chapter[]>([])
  // 댓글은 챕터 단위가 아닌 책 단위로 관리
  const [bookComments, setBookComments] = useState<CommentWithData[]>([])
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!bookId) { setLoading(false); return }

    // 책 정보 조회
    const { data: bookData } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single()

    if (!bookData) return
    setBook(bookData)

    // 표지 이미지: books.cover_image_url 우선 사용 (독자 RLS 호환)
    // cover_image_url이 없을 경우에만 cover_images 테이블 조회 (저자 편집 중 fallback)
    if (bookData.cover_image_url) {
      setCoverImageUrl(bookData.cover_image_url)
    } else {
      const { data: selectedCover } = await supabase
        .from('cover_images')
        .select('image_url')
        .eq('book_id', bookId)
        .eq('status', 'selected')
        .single()

      if (selectedCover) {
        setCoverImageUrl(selectedCover.image_url)
      } else {
        const { data: candidateCover } = await supabase
          .from('cover_images')
          .select('image_url')
          .eq('book_id', bookId)
          .eq('status', 'candidate')
          .limit(1)
          .single()
        setCoverImageUrl(candidateCover?.image_url ?? null)
      }
    }

    // 시니어 프로필(이름) 조회
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, full_name')
      .eq('id', bookData.senior_id)
      .single()
    setSeniorName(profileData?.full_name ?? profileData?.display_name ?? '')

    // 챕터 조회 (삭제되지 않은 것만, sort_order 순)
    const { data: chaptersData } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .eq('is_deleted', false)
      .order('sort_order')

    setChapters(chaptersData ?? [])

    // 책 단위 댓글 + 답글 + 작성자 프로필 조회
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, replies(*)')
      .eq('book_id', bookId)
      .order('created_at')

    const commentAuthorIds = (commentsData ?? []).map((c) => c.author_id)
    const replyAuthorIds = (commentsData ?? []).flatMap((c) => {
      if (!c.replies) return []
      const arr: Reply[] = Array.isArray(c.replies)
        ? (c.replies as unknown as Reply[])
        : [c.replies as unknown as Reply]
      return arr.map((r) => r.senior_id)
    })
    const allAuthorIds = [...new Set([...commentAuthorIds, ...replyAuthorIds])]

    const [{ data: authorsData }, { data: familyLinksData }] = await Promise.all([
      allAuthorIds.length > 0
        ? supabase.from('profiles').select('id, display_name, full_name, avatar_url').in('id', allAuthorIds)
        : Promise.resolve({ data: [] }),
      allAuthorIds.length > 0
        ? supabase.from('family_links')
            .select('family_id, reader_nickname, relationship')
            .eq('senior_id', bookData.senior_id)
            .in('family_id', allAuthorIds)
            .eq('invite_status', 'accepted')
        : Promise.resolve({ data: [] }),
    ])

    const authorMap = new Map((authorsData ?? []).map((p) => [p.id, p]))
    const relationshipMap = new Map((familyLinksData ?? []).map((fl) => [fl.family_id, (fl.reader_nickname ?? fl.relationship) as string | null]))

    setBookComments(
      (commentsData ?? []).map((comment) => {
        const rawReplies: Reply[] = comment.replies == null
          ? []
          : Array.isArray(comment.replies)
            ? (comment.replies as unknown as Reply[])
            : [comment.replies as unknown as Reply]
        return {
          ...comment,
          author: authorMap.get(comment.author_id) ?? null,
          relationship: relationshipMap.get(comment.author_id) ?? null,
          replies: rawReplies.map((reply) => ({
            ...reply,
            author: authorMap.get(reply.senior_id) ?? null,
            relationship: relationshipMap.get(reply.senior_id) ?? null,
          })),
        }
      })
    )
  }, [bookId])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  return { book, seniorName, chapters, bookComments, coverImageUrl, loading, reload: load }
}

// ─── 표지 플레이스홀더 팔레트 ────────────────────────────────────────────────

const COVER_PALETTE = [
  { from: '#C4614A', to: '#7B1F35' },
  { from: '#7B5080', to: '#3D1F5A' },
  { from: '#B85470', to: '#6B1F3A' },
  { from: '#4A7A68', to: '#1A4A38' },
  { from: '#5A7A9A', to: '#1A3A5A' },
  { from: '#9A7060', to: '#5A3828' },
]
function coverPaletteFor(month: number) {
  return COVER_PALETTE[(month - 1) % COVER_PALETTE.length]
}

// ─── 아바타 ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#E8820C', '#16A34A', '#0369A1', '#7C3AED', '#BE185D', '#CA8A04']
const AVATAR_BGS   = ['#FFF0DC', '#DCFCE7', '#E0F2FE', '#F3E8FF', '#FCE7F3', '#FEF9C3']

function avatarStyle(id: string) {
  // id 문자 합산으로 색상 결정 — 같은 사람은 항상 같은 색
  const n = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return { bg: AVATAR_BGS[n % AVATAR_BGS.length], color: AVATAR_COLORS[n % AVATAR_COLORS.length] }
}

function initial(name: string | null | undefined) {
  return name ? name[0] : '?'
}

interface AvatarProps {
  name: string | null | undefined
  avatarUrl?: string | null
  size?: string        // Tailwind class e.g. 'w-9 h-9'
  round?: 'full' | 'xl'
  bg?: string
  color?: string
}
function Avatar({ name, avatarUrl, size = 'w-9 h-9', round = 'xl', bg = '#F3F4F6', color = '#6B7280' }: AvatarProps) {
  const src = toHttps(avatarUrl)
  return (
    <div
      className={`${size} rounded-${round} flex items-center justify-center shrink-0 mt-0.5 overflow-hidden`}
      style={{ backgroundColor: bg }}
    >
      {src
        ? <img src={src} alt={name ?? ''} className="w-full h-full object-cover" />
        : <span className="text-sm font-bold" style={{ color }}>{initial(name)}</span>
      }
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export default function SeniorBookReadPage() {
  const navigate = useNavigate()
  const { bookId } = useParams<{ bookId: string }>()
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const { book, seniorName, chapters, bookComments, coverImageUrl, loading, reload } = useBookRead(bookId)

  const isAuthor = book ? user?.id === book.senior_id : false
  const kakaoName: string = isAuthor
    ? (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? seniorName)
    : seniorName

  // 독자 뷰어가 저자를 부르는 호칭 (family_links.senior_title)
  const [seniorTitleForReader, setSeniorTitleForReader] = useState<string>('')
  useEffect(() => {
    if (isAuthor || !user?.id || !book?.senior_id) return
    void supabase
      .from('family_links')
      .select('senior_title')
      .eq('family_id', user.id)
      .eq('senior_id', book.senior_id)
      .eq('invite_status', 'accepted')
      .maybeSingle()
      .then(({ data }) => { if (data?.senior_title) setSeniorTitleForReader(data.senior_title) })
  }, [isAuthor, user?.id, book?.senior_id])

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [readingOpen, setReadingOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyingToAuthorId, setReplyingToAuthorId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editingReplyText, setEditingReplyText] = useState('')
  // 음성 댓글 (독자용)
  const [commentVoiceBlob, setCommentVoiceBlob] = useState<Blob | null>(null)
  const [commentPreviewUrl, setCommentPreviewUrl] = useState<string | null>(null)
  const [playingCommentId, setPlayingCommentId] = useState<string | null>(null)
  // F-16 음성 답장
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [playingReplyId, setPlayingReplyId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  type ReactionMap = Record<string, { emoji: string; count: number; reacted: boolean }[]>
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [replyReactions, setReplyReactions] = useState<ReactionMap>({})
  const [openEmojiPickerId, setOpenEmojiPickerId] = useState<string | null>(null)

  const { contentFontSize, setContentFontSize } = useContentFontSizeStore()

  const voiceReply = useVoiceReply({
    seniorId: profile?.id ?? '',
    onTranscript: (text) => setReplyText(text),
  })
  const voiceComment = useVoiceReply({
    seniorId: profile?.id ?? '',
    onTranscript: (text) => setCommentText(text),
  })

  // 챕터 로드 완료 시 첫 번째 챕터 선택
  // dedication이 있으면 0장(작가의 말)이 기본이므로 자동 설정 생략
  useEffect(() => {
    if (chapters.length > 0 && !activeChapterId && !(book?.dedication && book.dedication.trim())) {
      setActiveChapterId(chapters[0].id)
    }
  }, [chapters, activeChapterId, book?.dedication])

  // Realtime 댓글 구독 — book_id 기반 (F-15)
  useEffect(() => {
    if (!bookId) return

    function startPolling() {
      if (pollingRef.current) return
      pollingRef.current = setInterval(async () => { await reload() }, 10_000)
    }
    function stopPolling() {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    }

    const channel = supabase
      .channel(`comments:book:${bookId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'comments',
        filter: `book_id=eq.${bookId}`,
      }, async () => { await reload() })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { stopPolling(); await reload() }
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') { startPolling() }
      })

    return () => { stopPolling(); supabase.removeChannel(channel) }
  }, [bookId, reload])

  // Realtime 답장 구독 — senior_id 기반 (F-16)
  // 저자가 새 답장을 등록하면 독자도 즉시 반영
  useEffect(() => {
    if (!book?.senior_id) return
    const channel = supabase
      .channel(`replies:senior:${book.senior_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'replies',
        filter: `senior_id=eq.${book.senior_id}`,
      }, async () => { await reload() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [book?.senior_id, reload])

  useEffect(() => { return () => { if (pollingRef.current) clearInterval(pollingRef.current) } }, [])

  useEffect(() => {
    const commentIds = bookComments.map((c) => c.id)
    const replyIds = bookComments.flatMap((c) => c.replies.map((r) => r.id))
    void loadReactions(commentIds)
    void loadReplyReactions(replyIds)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookComments])

  // 토스트 자동 숨김 타이머 ref — 직전 타이머를 정리해 연속 토스트 충돌·언마운트 후 setState 방지
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [])

  function showToast(msg: string) {
    setToastMsg(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2500)
  }

  // ─── 이모지 반응 ───────────────────────────────────────────────────────────

  async function loadReactions(commentIds: string[]) {
    if (commentIds.length === 0 || !user) return
    const { data } = await supabase
      .from('comment_reactions')
      .select('comment_id, emoji, user_id')
      .in('comment_id', commentIds)
    if (!data) return

    const map: Record<string, { emoji: string; count: number; reacted: boolean }[]> = {}
    for (const commentId of commentIds) {
      map[commentId] = REACTION_EMOJIS.map((emoji) => {
        const rows = data.filter((r) => r.comment_id === commentId && r.emoji === emoji)
        return { emoji, count: rows.length, reacted: rows.some((r) => r.user_id === user.id) }
      })
    }
    setReactions(map)
  }

  async function loadReplyReactions(replyIds: string[]) {
    if (replyIds.length === 0 || !user) return
    const { data } = await supabase
      .from('reply_reactions')
      .select('reply_id, emoji, user_id')
      .in('reply_id', replyIds)
    if (!data) return
    const map: ReactionMap = {}
    for (const replyId of replyIds) {
      map[replyId] = REACTION_EMOJIS.map((emoji) => {
        const rows = data.filter((r) => r.reply_id === replyId && r.emoji === emoji)
        return { emoji, count: rows.length, reacted: rows.some((r) => r.user_id === user.id) }
      })
    }
    setReplyReactions(map)
  }

  function toggleEmojiPicker(id: string) {
    setOpenEmojiPickerId((prev) => (prev === id ? null : id))
  }

  async function handleToggleReaction(commentId: string, emoji: string) {
    if (!user) return
    const current = reactions[commentId]?.find((r) => r.emoji === emoji)
    // DB 반영 결과를 확인 — 실패 시 로컬 상태를 바꾸지 않아 UI/DB 불일치를 방지
    const { error } = current?.reacted
      ? await supabase.from('comment_reactions').delete()
          .eq('comment_id', commentId).eq('user_id', user.id).eq('emoji', emoji)
      : await supabase.from('comment_reactions').insert({ comment_id: commentId, user_id: user.id, emoji })
    if (error) {
      showToast('반응을 반영하지 못했어요')
      return
    }
    setReactions((prev) => ({
      ...prev,
      [commentId]: REACTION_EMOJIS.map((e) => {
        const r = prev[commentId]?.find((x) => x.emoji === e) ?? { emoji: e, count: 0, reacted: false }
        if (e !== emoji) return r
        return current?.reacted
          ? { ...r, count: Math.max(0, r.count - 1), reacted: false }
          : { ...r, count: r.count + 1, reacted: true }
      }),
    }))
  }

  async function handleToggleReplyReaction(replyId: string, emoji: string) {
    if (!user) return
    const current = replyReactions[replyId]?.find((r) => r.emoji === emoji)
    // DB 반영 결과를 확인 — 실패 시 로컬 상태를 바꾸지 않아 UI/DB 불일치를 방지
    const { error } = current?.reacted
      ? await supabase.from('reply_reactions').delete()
          .eq('reply_id', replyId).eq('user_id', user.id).eq('emoji', emoji)
      : await supabase.from('reply_reactions').insert({ reply_id: replyId, user_id: user.id, emoji })
    if (error) {
      showToast('반응을 반영하지 못했어요')
      return
    }
    setReplyReactions((prev) => ({
      ...prev,
      [replyId]: REACTION_EMOJIS.map((e) => {
        const r = prev[replyId]?.find((x) => x.emoji === e) ?? { emoji: e, count: 0, reacted: false }
        if (e !== emoji) return r
        return current?.reacted
          ? { ...r, count: Math.max(0, r.count - 1), reacted: false }
          : { ...r, count: r.count + 1, reacted: true }
      }),
    }))
  }

  async function handleStartCommentRecording() {
    const ok = await voiceComment.startRecording()
    if (!ok) showToast('마이크 권한이 필요해요')
  }

  async function handleStopCommentRecording() {
    const blob = await voiceComment.stopRecording()
    if (!blob) return
    setCommentVoiceBlob(blob)
    setCommentPreviewUrl(URL.createObjectURL(blob))
  }

  function handleDiscardCommentVoice() {
    if (commentPreviewUrl) URL.revokeObjectURL(commentPreviewUrl)
    setCommentVoiceBlob(null)
    setCommentPreviewUrl(null)
    setCommentText('')
  }

  async function handlePlayComment(comment: CommentWithData) {
    if (playingCommentId === comment.id) {
      audioRef.current?.pause()
      setPlayingCommentId(null)
      return
    }
    if (!comment.audio_url) return
    const url = await voiceReply.getSignedUrl(comment.audio_url)
    if (!url) { showToast('재생 링크를 가져오지 못했어요'); return }
    if (audioRef.current) { audioRef.current.pause() }
    setPlayingReplyId(null)
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlayingCommentId(null)
    audio.play()
    setPlayingCommentId(comment.id)
  }

  // 댓글 전송 — 댓글은 책 단위로 저장, 어르신에게 알림 발송 (F-15)
  async function handleSubmitComment() {
    if ((!commentText.trim() && !commentVoiceBlob) || !bookId || !profile || !book) return
    const commentContent = commentText.trim() || '(음성 댓글)'
    setSubmitting(true)
    try {
      const { data: commentData, error } = await supabase.from('comments').insert({
        book_id: bookId,
        author_id: profile.id,
        content: commentContent,
      }).select('id').single()
      if (error || !commentData) throw error ?? new Error('INSERT 실패')

      if (commentVoiceBlob) {
        const extension = commentVoiceBlob.type.includes('mp4') ? 'mp4' : 'webm'
        const contentType = commentVoiceBlob.type || 'audio/webm'
        const path = `comments/${profile.id}/${commentData.id}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('reply-audio')
          .upload(path, commentVoiceBlob, { contentType, upsert: false })
        if (uploadError) {
          await supabase.from('comments').delete().eq('id', commentData.id)
          throw uploadError
        }

        const { error: audioUrlError } = await supabase
          .from('comments')
          .update({ audio_url: path })
          .eq('id', commentData.id)
        if (audioUrlError) {
          await supabase.storage.from('reply-audio').remove([path])
          await supabase.from('comments').delete().eq('id', commentData.id)
          throw audioUrlError
        }
      }

      const commenterName = profile.full_name ?? profile.display_name ?? '독자'
      const bookTitle = book.title
      const notifPayload = {
        type: 'new_comment' as const,
        title: `${commenterName}${josa(commenterName, '이', '가')} [${bookTitle}]에 댓글을 남겼어요`,
        body: commentContent,
        reference_id: bookId,
        reference_type: 'book',
      }

      if (profile.id !== book.senior_id) {
        // 가족 → 저자에게 알림
        const { error: ne } = await supabase.from('notifications').insert({ recipient_id: book.senior_id, ...notifPayload })
        if (ne) console.error('[알림 INSERT 실패]', ne)
        void sendPushToUser(book.senior_id, notifPayload.title, commentContent, `/s/books/${bookId}`)
      } else {
        // 저자 → 연결된 가족 전체에게 알림 (family_id 중복 제거)
        const { data: links } = await supabase
          .from('family_links')
          .select('family_id')
          .eq('senior_id', book.senior_id)
          .eq('invite_status', 'accepted')
        const uniqueIds = [...new Set((links ?? []).map((l) => l.family_id).filter(Boolean))] as string[]
        if (uniqueIds.length > 0) {
          const { error: ne2 } = await supabase.from('notifications').insert(
            uniqueIds.map((id) => ({ recipient_id: id, ...notifPayload }))
          )
          if (ne2) console.error('[알림 INSERT 실패]', ne2)
          uniqueIds.forEach(id => void sendPushToUser(id, notifPayload.title, commentContent, `/r/books/${bookId}`))
        }
      }

      setCommentText('')
      handleDiscardCommentVoice()
      showToast('댓글을 전달했어요')
      await reload()
    } catch {
      showToast('댓글 전달에 실패했어요')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) { showToast('삭제에 실패했어요'); return }
    showToast('댓글을 삭제했어요')
    await reload()
  }

  async function handleSaveEditComment(commentId: string) {
    if (!editingCommentText.trim()) return
    const { error } = await supabase.from('comments')
      .update({ content: editingCommentText.trim() }).eq('id', commentId)
    if (error) { showToast('수정에 실패했어요'); return }
    setEditingCommentId(null)
    showToast('댓글을 수정했어요')
    await reload()
  }

  async function handleStartVoiceRecording() {
    const ok = await voiceReply.startRecording()
    if (!ok) showToast('마이크 권한이 필요해요')
  }

  async function handleStopVoiceRecording() {
    const blob = await voiceReply.stopRecording()
    if (!blob) return
    setVoiceBlob(blob)
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
  }

  function handleDiscardVoice() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setVoiceBlob(null)
    setPreviewUrl(null)
    setReplyText('')
  }

  async function handleSubmitVoiceReply(commentId: string) {
    if (!voiceBlob || !profile || !book) return
    const textContent = replyText.trim() || '(음성 답장)'
    const { error } = await voiceReply.uploadReply(commentId, voiceBlob, textContent)
    if (error) { showToast('답장 전달에 실패했어요'); return }

    // 음성 답장 알림
    if (replyingToAuthorId && replyingToAuthorId !== profile.id) {
      const replierName = profile.full_name ?? profile.display_name ?? (isAuthor ? '저자' : '독자')
      const notifTitle = `${replierName}${josa(replierName, '이', '가')} [${book.title}]에 음성 답장을 남겼어요`
      await supabase.from('notifications').insert({
        recipient_id: replyingToAuthorId,
        type: 'new_reply',
        title: notifTitle,
        body: textContent,
        reference_id: book.id,
        reference_type: 'book',
      })
      void sendPushToUser(replyingToAuthorId, notifTitle, textContent)
    }

    handleDiscardVoice()
    setReplyingToId(null)
    setReplyingToAuthorId(null)
    showToast('음성 답장을 전달했어요')
    await reload()
  }

  async function handlePlayReply(reply: Reply) {
    if (playingReplyId === reply.id) {
      audioRef.current?.pause()
      setPlayingReplyId(null)
      return
    }
    if (!reply.audio_url) return
    const url = await voiceReply.getSignedUrl(reply.audio_url)
    if (!url) { showToast('재생 링크를 가져오지 못했어요'); return }
    if (audioRef.current) { audioRef.current.pause() }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlayingReplyId(null)
    audio.play()
    setPlayingReplyId(reply.id)
  }

  async function handleSubmitReply(commentId: string) {
    if (!replyText.trim() || !profile || !book) return
    const { error } = await supabase.from('replies').insert({
      comment_id: commentId,
      senior_id: profile.id,
      content: replyText.trim(),
    })
    if (error) { showToast('답장 전달에 실패했어요'); return }

    // 답장 알림: 답장하기를 누른 메시지 작성자에게 발송
    if (replyingToAuthorId && replyingToAuthorId !== profile.id) {
      const replierName = profile.full_name ?? profile.display_name ?? (isAuthor ? '저자' : '독자')
      const notifTitle = `${replierName}${josa(replierName, '이', '가')} [${book.title}]에 답장을 남겼어요`
      const { error: ne } = await supabase.from('notifications').insert({
        recipient_id: replyingToAuthorId,
        type: 'new_reply',
        title: notifTitle,
        body: replyText.trim(),
        reference_id: book.id,
        reference_type: 'book',
      })
      if (ne) console.error('[대댓글 알림 INSERT 실패]', ne)
      void sendPushToUser(replyingToAuthorId, notifTitle, replyText.trim())
    }

    setReplyingToId(null)
    setReplyingToAuthorId(null)
    setReplyText('')
    showToast('답장을 전달했어요')
    await reload()
  }

  async function handleDeleteReply(replyId: string) {
    const { error } = await supabase.from('replies').delete().eq('id', replyId)
    if (error) { showToast('삭제에 실패했어요'); return }
    showToast('답장을 삭제했어요')
    await reload()
  }

  async function handleSaveEditReply(replyId: string) {
    if (!editingReplyText.trim()) return
    const { error } = await supabase.from('replies')
      .update({ content: editingReplyText.trim() }).eq('id', replyId)
    if (error) { showToast('수정에 실패했어요'); return }
    setEditingReplyId(null)
    showToast('답장을 수정했어요')
    await reload()
  }

  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? null
  const totalComments = bookComments.length

  // ─── 로딩 ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8F0]">
        <p className="text-[1.125rem] text-[#6B7280]">불러오는 중…</p>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8F0]">
        <p className="text-[1.125rem] text-[#6B7280]">책을 찾을 수 없어요</p>
      </div>
    )
  }

  // 단편: 책 제목 그대로, 월간: "년 월 이야기"
  const headerTitle = book.book_type === 'short'
    ? book.title
    : `${book.year}년 ${book.month}월 이야기`

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0] relative">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button" onClick={() => navigate(-1)}
          className="flex flex-col items-center justify-center min-h-11 min-w-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
          <span className="text-xs text-[#6B7280]">뒤로</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold text-[#1F2937] whitespace-nowrap">
          {headerTitle}
        </h1>
        <div className="ml-auto w-11" />
      </header>

      <main className="flex-1 overflow-y-auto w-full max-w-2xl md:max-w-none mx-auto">


        {chapters.length === 0 ? (
          <div className="mx-3 mt-3 bg-white rounded-2xl px-6 py-10 text-center">
            <p className="text-[1.125rem] text-[#9CA3AF]">챕터가 없어요</p>
          </div>
        ) : (
          <>
            {/* 표지 카드 */}
            {chapters.length > 0 && (() => {
              const cp = coverPaletteFor(book.month)
              return (
                <button
                  type="button"
                  className="mx-3 mt-3 rounded-2xl overflow-hidden w-[calc(100%-1.5rem)] aspect-[3/4] relative flex flex-col items-center justify-between p-8"
                  style={{ background: coverImageUrl ? undefined : `linear-gradient(155deg, ${cp.from} 0%, ${cp.to} 100%)` }}
                  // 작가의 말이 있으면 0장(null)부터, 없으면 1장부터 열기
                  onClick={() => {
                    if (book.dedication && book.dedication.trim()) {
                      setActiveChapterId(null)
                    } else if (!activeChapterId && chapters.length > 0) {
                      // dedication 없고 아직 챕터 선택 안 된 경우 1장으로 초기화
                      setActiveChapterId(chapters[0].id)
                    }
                    setReadingOpen(true)
                  }}
                >
                  {coverImageUrl && (
                    <img src={coverImageUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/20 rounded-2xl" />
                  {/* 제목·저자 — 상단 고정 (표지 이미지 상단이 비어있는 구도에 맞춤) */}
                  <div className="relative w-full flex flex-col items-center gap-2 pt-2">
                    <div className="h-[1.5px] w-full rounded-full bg-white/50" />
                    <div className="h-[1px] w-full rounded-full bg-white/25" />
                    <p className="text-[1.75rem] font-bold text-white text-center leading-snug drop-shadow mt-2">
                      {book.title}
                    </p>
                    <p className="text-base text-white/70">
                      {kakaoName} 지음 · {book.year}년 {book.month}월
                    </p>
                  </div>
                  <div className="relative flex flex-col items-center gap-2">
                    <div className="h-[1px] w-12 rounded-full bg-white/40" />
                    <p className="text-sm text-white/60 tracking-wide">눌러서 읽기</p>
                  </div>
                </button>
              )
            })()}

            {/* 댓글 섹션 — 책 단위 댓글 전체 표시 */}
            <div className="bg-white mx-3 mt-3 rounded-2xl px-5 py-5 flex flex-col gap-4">
              <p className="text-[1.125rem] font-bold text-[#1F2937]">
                독자 댓글 {totalComments}개
              </p>

              <div className="h-px bg-[#E5E7EB]" />

              {bookComments.length === 0 ? (
                <p className="text-base text-[#9CA3AF] text-center py-2">
                  아직 댓글이 없어요
                </p>
              ) : (
                bookComments.map((comment) => {
                  const isCommentByAuthor = book ? comment.author_id === book.senior_id : false
                  const style = avatarStyle(comment.author_id)
                  const isOwnComment = profile?.id === comment.author_id
                  return (
                    <div key={comment.id} className="flex flex-col gap-2">
                      {/* 댓글 */}
                      <div className="flex items-start gap-3">
                        {isCommentByAuthor ? (
                          <Avatar
                            name={kakaoName}
                            avatarUrl={comment.author?.avatar_url}
                            round="full"
                            bg="#E8820C"
                            color="#ffffff"
                          />
                        ) : (
                          <Avatar
                            name={comment.author?.full_name ?? comment.author?.display_name}
                            avatarUrl={comment.author?.avatar_url}
                            bg={style.bg}
                            color={style.color}
                          />
                        )}
                        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-base font-bold ${isCommentByAuthor ? 'text-[#E8820C]' : 'text-[#1F2937]'}`}>
                                {(comment.author?.full_name ?? comment.author?.display_name) ?? '독자'}
                              </p>
                              {isCommentByAuthor ? (
                                <span className="text-xs text-[#E8820C] bg-[#FFF0DC] rounded-full px-2 py-0.5 leading-none">
                                  {isAuthor ? '저자' : (seniorTitleForReader || '저자')}
                                </span>
                              ) : comment.author_id === user?.id ? (
                                <span className="text-xs text-[#6B7280] bg-[#F3F4F6] rounded-full px-2 py-0.5 leading-none">나</span>
                              ) : comment.relationship ? (
                                <span className="text-xs text-[#6B7280] bg-[#F3F4F6] rounded-full px-2 py-0.5 leading-none">
                                  {comment.relationship}
                                </span>
                              ) : null}
                            </div>
                            {isOwnComment && editingCommentId !== comment.id && (
                              <div className="flex gap-3 shrink-0">
                                <button type="button"
                                  onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content) }}
                                  className="text-sm text-[#6B7280]">수정</button>
                                <button type="button"
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-sm text-[#DC2626]">삭제</button>
                              </div>
                            )}
                          </div>
                          {editingCommentId === comment.id ? (
                            <>
                              <textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                rows={2}
                                className="w-full bg-[#FFF8F0] border border-[#E8820C] rounded-xl px-3 py-2 text-[1.0625rem] text-[#1F2937] outline-none resize-none"
                              />
                              <div className="flex gap-2 justify-end mt-1">
                                <button type="button" onClick={() => setEditingCommentId(null)}
                                  className="text-sm text-[#6B7280] px-3 py-1.5 rounded-lg bg-[#F3F4F6] min-h-9">취소</button>
                                <button type="button" onClick={() => handleSaveEditComment(comment.id)}
                                  className="text-sm text-white px-3 py-1.5 rounded-lg bg-[#E8820C] min-h-9">저장</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-[1.125rem] text-[#1F2937]">{comment.content}</p>
                              {comment.audio_url && (
                                <button type="button"
                                  onClick={() => handlePlayComment(comment)}
                                  className="self-start flex items-center gap-1.5 bg-[#FFF0DC] border border-[#E8820C] rounded-lg px-3 py-1.5 mt-1 min-h-9">
                                  {playingCommentId === comment.id
                                    ? <Pause size={14} className="text-[#E8820C]" />
                                    : <Play size={14} className="text-[#E8820C] fill-[#E8820C]" />}
                                  <span className="text-sm text-[#E8820C]">
                                    {playingCommentId === comment.id ? '일시 정지' : '음성 듣기'}
                                  </span>
                                </button>
                              )}
                            </>
                          )}
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <p className="text-sm text-[#6B7280]">
                              {new Date(comment.created_at).toLocaleDateString('ko-KR', {
                                month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                            {replyingToId !== comment.id && (
                              <button type="button"
                                onClick={() => { setReplyingToId(comment.id); setReplyingToAuthorId(comment.author_id); setReplyText('') }}
                                className="text-sm text-[#E8820C]">답장하기</button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleEmojiPicker(`c_${comment.id}`)}
                              className={`text-sm px-2 py-0.5 rounded-full border transition-colors ${
                                openEmojiPickerId === `c_${comment.id}`
                                  ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                                  : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#9CA3AF]'
                              }`}
                            >
                              😊+
</button>
                          </div>

                          {/* 이모지 피커 */}
                          {openEmojiPickerId === `c_${comment.id}` && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {REACTION_EMOJIS.map((emoji) => {
                                const r = reactions[comment.id]?.find((x) => x.emoji === emoji)
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(comment.id, emoji)}
                                    className={`text-xl w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                                      r?.reacted ? 'border-[#E8820C] bg-[#FFF0DC]' : 'border-[#E5E7EB] bg-[#F9FAFB]'
                                    }`}
                                  >
                                    {emoji}
                                  </button>
                                )
                              })}
                            </div>
                          )}

                          {/* 선택된 반응 요약 */}
                          {(reactions[comment.id] ?? []).some((r) => r.count > 0) && (
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              {(reactions[comment.id] ?? []).filter((r) => r.count > 0).map(({ emoji, count, reacted }) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleToggleReaction(comment.id, emoji)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors ${
                                    reacted ? 'bg-[#FFF0DC] border-[#E8820C]' : 'bg-[#F9FAFB] border-[#E5E7EB]'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-xs font-medium text-[#6B7280]">{count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 답장 입력 폼 */}
                      {replyingToId === comment.id && (
                        <div className="ml-12 flex flex-col gap-2">
                          {/* 녹음 중 */}
                          {voiceReply.state === 'recording' ? (
                            <div className="bg-[#FFF8F0] border border-[#E8820C] rounded-xl px-4 py-3 flex items-center gap-3">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] animate-pulse" />
                              <span className="text-[1.0625rem] text-[#1F2937] font-medium tabular-nums">
                                {formatDuration(voiceReply.duration)}
                              </span>
                              <span className="flex-1 text-base text-[#6B7280]">녹음 중…</span>
                              <button type="button" onClick={handleStopVoiceRecording}
                                className="w-9 h-9 rounded-full bg-[#DC2626] flex items-center justify-center shrink-0">
                                <Square size={14} className="text-white fill-white" />
                              </button>
                            </div>
                          ) : voiceBlob && previewUrl ? (
                            /* 녹음 완료 — 미리듣기 + 텍스트 확인 */
                            <>
                              <audio src={previewUrl} controls className="w-full h-10 rounded-xl" />
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={2}
                                placeholder="내용을 확인하거나 직접 입력하세요"
                                className="w-full bg-[#FFF8F0] border border-[#E8820C] rounded-xl px-3 py-2 text-[1.0625rem] text-[#1F2937] placeholder-[#D1D5DB] outline-none resize-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <button type="button" onClick={handleDiscardVoice}
                                  className="text-sm text-[#6B7280] px-3 py-1.5 rounded-lg bg-[#F3F4F6] min-h-9">다시 녹음</button>
                                <button type="button"
                                  onClick={() => handleSubmitVoiceReply(comment.id)}
                                  disabled={voiceReply.state === 'uploading'}
                                  className="text-sm text-white px-3 py-1.5 rounded-lg bg-[#E8820C] min-h-9 disabled:opacity-50">
                                  {voiceReply.state === 'uploading' ? '전달 중…' : '전달'}
                                </button>
                              </div>
                            </>
                          ) : (
                            /* 기본 입력 — 마이크 또는 텍스트 */
                            <>
                              <button type="button" onClick={handleStartVoiceRecording}
                                className="w-full bg-[#FFF0DC] border border-[#E8820C] rounded-xl py-3 flex items-center justify-center gap-2 min-h-11">
                                <Mic size={18} className="text-[#E8820C]" />
                                <span className="text-[1.0625rem] text-[#E8820C]">음성으로 답장하기</span>
                              </button>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-[#E5E7EB]" />
                                <span className="text-sm text-[#9CA3AF]">또는</span>
                                <div className="flex-1 h-px bg-[#E5E7EB]" />
                              </div>
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={2}
                                placeholder="텍스트로 답장하기"
                                autoFocus
                                className="w-full bg-[#FFF8F0] border border-[#E8820C] rounded-xl px-3 py-2 text-[1.0625rem] text-[#1F2937] placeholder-[#D1D5DB] outline-none resize-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <button type="button"
                                  onClick={() => { setReplyingToId(null); setReplyingToAuthorId(null); handleDiscardVoice() }}
                                  className="text-sm text-[#6B7280] px-3 py-1.5 rounded-lg bg-[#F3F4F6] min-h-9">취소</button>
                                <button type="button" onClick={() => handleSubmitReply(comment.id)}
                                  disabled={!replyText.trim()}
                                  className="text-sm text-white px-3 py-1.5 rounded-lg bg-[#E8820C] min-h-9 disabled:opacity-50">전달</button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* 답장(대댓글) */}
                      {comment.replies.map((reply) => {
                        const isReplyByAuthor = book ? reply.senior_id === book.senior_id : false
                        const replyStyle = avatarStyle(reply.senior_id)
                        const replyAuthorName = (reply.author?.full_name ?? reply.author?.display_name) ?? (isReplyByAuthor ? seniorName : '독자')
                        const isOwnReply = profile?.id === reply.senior_id
                        return (
                        <div key={reply.id} className="ml-12 flex items-start gap-3">
                          {isReplyByAuthor ? (
                            <Avatar
                              name={kakaoName}
                              avatarUrl={reply.author?.avatar_url}
                              round="full"
                              bg="#E8820C"
                              color="#ffffff"
                            />
                          ) : (
                            <Avatar
                              name={replyAuthorName}
                              avatarUrl={reply.author?.avatar_url}
                              bg={replyStyle.bg}
                              color={replyStyle.color}
                            />
                          )}
                          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-[0.9375rem] font-bold ${isReplyByAuthor ? 'text-[#E8820C]' : 'text-[#1F2937]'}`}>
                                  {replyAuthorName}
                                </p>
                                {isReplyByAuthor ? (
                                  <span className="text-xs text-[#E8820C] bg-[#FFF0DC] rounded-full px-2 py-0.5 leading-none">
                                    {isAuthor ? '저자' : (seniorTitleForReader || '저자')}
                                  </span>
                                ) : reply.senior_id === user?.id ? (
                                  <span className="text-xs text-[#6B7280] bg-[#F3F4F6] rounded-full px-2 py-0.5 leading-none">나</span>
                                ) : reply.relationship ? (
                                  <span className="text-xs text-[#6B7280] bg-[#F3F4F6] rounded-full px-2 py-0.5 leading-none">
                                    {reply.relationship}
                                  </span>
                                ) : null}
                              </div>
                              {isOwnReply && editingReplyId !== reply.id && (
                                <div className="flex gap-3 shrink-0">
                                  <button type="button"
                                    onClick={() => { setEditingReplyId(reply.id); setEditingReplyText(reply.content) }}
                                    className="text-sm text-[#6B7280]">수정</button>
                                  <button type="button"
                                    onClick={() => handleDeleteReply(reply.id)}
                                    className="text-sm text-[#DC2626]">삭제</button>
                                </div>
                              )}
                            </div>
                            {editingReplyId === reply.id ? (
                              <>
                                <textarea
                                  value={editingReplyText}
                                  onChange={(e) => setEditingReplyText(e.target.value)}
                                  rows={2}
                                  className="w-full bg-[#FFF8F0] border border-[#E8820C] rounded-xl px-3 py-2 text-[1.0625rem] text-[#1F2937] outline-none resize-none"
                                />
                                <div className="flex gap-2 justify-end mt-1">
                                  <button type="button" onClick={() => setEditingReplyId(null)}
                                    className="text-sm text-[#6B7280] px-3 py-1.5 rounded-lg bg-[#F3F4F6] min-h-9">취소</button>
                                  <button type="button" onClick={() => handleSaveEditReply(reply.id)}
                                    className="text-sm text-white px-3 py-1.5 rounded-lg bg-[#E8820C] min-h-9">저장</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-[1.125rem] text-[#1F2937]">{reply.content}</p>
                                {reply.audio_url && (
                                  <button type="button"
                                    onClick={() => handlePlayReply(reply)}
                                    className="self-start flex items-center gap-1.5 bg-[#FFF0DC] border border-[#E8820C] rounded-lg px-3 py-1.5 mt-1 min-h-9">
                                    {playingReplyId === reply.id
                                      ? <Pause size={14} className="text-[#E8820C]" />
                                      : <Play size={14} className="text-[#E8820C] fill-[#E8820C]" />}
                                    <span className="text-sm text-[#E8820C]">
                                      {playingReplyId === reply.id ? '일시 정지' : '음성 듣기'}
                                    </span>
                                  </button>
                                )}
                              </>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              <p className="text-sm text-[#6B7280]">
                                {new Date(reply.created_at).toLocaleDateString('ko-KR', {
                                  month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                              </p>
                              {/* 본인 답장이 아닐 때만 답장하기 버튼 표시 */}
                              {reply.senior_id !== user?.id && replyingToId !== comment.id && (
                                <button type="button"
                                  onClick={() => {
                                    setReplyingToId(comment.id)
                                    setReplyingToAuthorId(reply.senior_id)
                                    setReplyText('')
                                  }}
                                  className="text-sm text-[#E8820C]">답장하기</button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleEmojiPicker(`r_${reply.id}`)}
                                className={`text-sm px-2 py-0.5 rounded-full border transition-colors ${
                                  openEmojiPickerId === `r_${reply.id}`
                                    ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                                    : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#9CA3AF]'
                                }`}
                              >
                                😊+
                              </button>
                            </div>

                            {/* 대댓글 이모지 피커 */}
                            {openEmojiPickerId === `r_${reply.id}` && (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {REACTION_EMOJIS.map((emoji) => {
                                  const r = replyReactions[reply.id]?.find((x) => x.emoji === emoji)
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleToggleReplyReaction(reply.id, emoji)}
                                      className={`text-xl w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                                        r?.reacted ? 'border-[#E8820C] bg-[#FFF0DC]' : 'border-[#E5E7EB] bg-[#F9FAFB]'
                                      }`}
                                    >
                                      {emoji}
                                    </button>
                                  )
                                })}
                              </div>
                            )}

                            {/* 대댓글 선택된 반응 요약 */}
                            {(replyReactions[reply.id] ?? []).some((r) => r.count > 0) && (
                              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                {(replyReactions[reply.id] ?? []).filter((r) => r.count > 0).map(({ emoji, count, reacted }) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReplyReaction(reply.id, emoji)}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors ${
                                      reacted ? 'bg-[#FFF0DC] border-[#E8820C]' : 'bg-[#F9FAFB] border-[#E5E7EB]'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-xs font-medium text-[#6B7280]">{count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )
                })
              )}

              <div className="h-px bg-[#E5E7EB]" />

              {/* 댓글 입력 */}
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment() }}
                  placeholder="댓글 남기기"
                  className="w-full bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 py-3 text-[1.125rem] text-[#1F2937] placeholder-[#D1D5DB] outline-none focus:border-[#E8820C]"
                />
                <button type="button"
                  onClick={handleSubmitComment}
                  disabled={submitting || (!commentText.trim() && !commentVoiceBlob)}
                  className="w-full bg-[#E8820C] rounded-xl py-3 min-h-11 disabled:opacity-50">
                  <span className="text-[1.125rem] text-white">
                    {submitting ? '전달 중…' : '전달하기'}
                  </span>
                </button>
              </div>

              {/* 음성 댓글 */}
              <div className="flex flex-col gap-2">
                <p className="text-base text-[#6B7280]">음성 댓글</p>
                {voiceComment.state === 'recording' ? (
                  <div className="bg-[#FFF8F0] border border-[#E8820C] rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] animate-pulse" />
                    <span className="text-[1.0625rem] text-[#1F2937] font-medium tabular-nums">
                      {formatDuration(voiceComment.duration)}
                    </span>
                    <span className="flex-1 text-base text-[#6B7280]">녹음 중…</span>
                    <button type="button" onClick={handleStopCommentRecording}
                      className="w-9 h-9 rounded-full bg-[#DC2626] flex items-center justify-center shrink-0">
                      <Square size={14} className="text-white fill-white" />
                    </button>
                  </div>
                ) : commentVoiceBlob && commentPreviewUrl ? (
                  <>
                    <audio src={commentPreviewUrl} controls className="w-full h-10 rounded-xl" />
                    <div className="flex justify-end">
                      <button type="button" onClick={handleDiscardCommentVoice}
                        className="text-sm text-[#6B7280] px-3 py-1.5 rounded-lg bg-[#F3F4F6] min-h-9">다시 녹음</button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={handleStartCommentRecording}
                    className="w-full bg-[#FFF0DC] border border-[#E8820C] rounded-xl py-3 flex items-center justify-center gap-2 min-h-11">
                    <Mic size={18} className="text-[#E8820C]" />
                    <span className="text-[1.0625rem] text-[#E8820C]">음성으로 댓글 남기기</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}

      </main>

      {/* 풀스크린 읽기 오버레이 */}
      {readingOpen && activeChapter && (() => {
        const chapterIdx = chapters.findIndex(c => c.id === activeChapterId)
        // 0장 = 작가의 말(dedication), 1장~ = 일반 챕터
        // readingPage: -1 = 작가의 말, 0~ = 챕터 인덱스
        const hasAuthorNote = !!(book.dedication && book.dedication.trim())
        // 전체 페이지 수: 작가의 말(있으면) + 챕터 수
        const totalPages = (hasAuthorNote ? 1 : 0) + chapters.length
        // 현재 페이지 인덱스 (작가의 말 = 0, 1장 = 1, ...)
        const currentPageIdx = hasAuthorNote ? chapterIdx + 1 : chapterIdx

        // hasAuthorNote면 1장(chapterIdx=0)에서도 이전(작가의 말)으로 이동 가능
        const hasPrev = hasAuthorNote ? chapterIdx >= 0 : chapterIdx > 0
        const hasNext = chapterIdx < chapters.length - 1

        return (
          <div className="absolute inset-0 z-50 flex flex-col bg-[#FFFBF5]">

            {/* 상단 바 */}
            <div className="flex items-center justify-between px-4 h-[56px] shrink-0 border-b border-[#EDE0CC]">
              <button
                type="button"
                onClick={() => setReadingOpen(false)}
                className="flex items-center gap-1 min-h-11 min-w-11"
              >
                <ChevronLeft size={20} className="text-[#9CA3AF]" />
                <span className="text-[0.9375rem] text-[#9CA3AF]">표지</span>
              </button>
              <p className="text-sm text-[#9CA3AF]">{book.title}</p>
              <span className="text-sm text-[#9CA3AF] min-w-11 text-right">
                {currentPageIdx + 1} / {totalPages}
              </span>
            </div>

            {/* 본문 글씨 크기 조절 바 */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#EDE0CC] bg-[#FFFBF5] shrink-0">
              <span className="text-sm text-[#9CA3AF] mr-1">글씨</span>
              {CONTENT_SIZE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setContentFontSize(value)}
                  className={`flex-1 py-1.5 rounded-lg text-sm transition-colors ${
                    contentFontSize === value
                      ? 'bg-[#E8820C] text-white'
                      : 'bg-[#F3F4F6] text-[#6B7280]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 본문 영역 */}
            <div className="flex-1 overflow-y-auto">
              <div className="w-full max-w-xl mx-auto px-6 pt-10 pb-12">

                {/* 챕터 번호 */}
                <p className="text-[0.8125rem] font-semibold tracking-[0.15em] text-[#E8820C] mb-3">
                  {chapterIdx + 1}장
                </p>

                {/* 챕터 제목 */}
                <h2 className="text-[1.5rem] font-bold text-[#1F2937] leading-snug mb-6">
                  {activeChapter.title}
                </h2>

                {/* 구분선 */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-px flex-1 bg-[#EDE0CC]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E8820C] opacity-50" />
                  <div className="h-px flex-1 bg-[#EDE0CC]" />
                </div>

                {/* 본문 */}
                <p className="text-content text-[#2D2D2D] leading-[2.1] whitespace-pre-wrap tracking-wide">
                  {activeChapter.content}
                </p>

              </div>
            </div>

            {/* 하단 챕터 이동 */}
            <div className="shrink-0 border-t border-[#EDE0CC] flex items-center bg-[#FFFBF5]">
              <button
                type="button"
                onClick={() => {
                  if (!hasPrev) return
                  // 1장(chapterIdx=0)에서 이전 = 작가의 말(null)
                  if (chapterIdx === 0 && hasAuthorNote) setActiveChapterId(null)
                  else setActiveChapterId(chapters[chapterIdx - 1].id)
                }}
                disabled={!hasPrev}
                className="flex-1 flex items-center justify-center gap-1.5 py-4 disabled:opacity-30"
              >
                <ChevronLeft size={18} className="text-[#6B7280]" />
                <span className="text-base text-[#6B7280]">이전 장</span>
              </button>

              <div className="flex gap-1.5 px-4">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: i === currentPageIdx ? '20px' : '6px',
                      height: '6px',
                      backgroundColor: i === currentPageIdx ? '#E8820C' : '#D1D5DB',
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => hasNext && setActiveChapterId(chapters[chapterIdx + 1].id)}
                disabled={!hasNext}
                className="flex-1 flex items-center justify-center gap-1.5 py-4 disabled:opacity-30"
              >
                <span className="text-base text-[#6B7280]">다음 장</span>
                <ChevronLeft size={18} className="text-[#6B7280] rotate-180" />
              </button>
            </div>
          </div>
        )
      })()}

      {/* 풀스크린 작가의 말 오버레이 — 표지 카드 탭 시 0장으로 진입 */}
      {readingOpen && !activeChapter && book.dedication && book.dedication.trim() && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#FFFBF5]">
          <div className="flex items-center justify-between px-4 h-[56px] shrink-0 border-b border-[#EDE0CC]">
            <button type="button" onClick={() => setReadingOpen(false)}
              className="flex items-center gap-1 min-h-11 min-w-11">
              <ChevronLeft size={20} className="text-[#9CA3AF]" />
              <span className="text-[0.9375rem] text-[#9CA3AF]">표지</span>
            </button>
            <p className="text-sm text-[#9CA3AF]">{book.title}</p>
            <span className="text-sm text-[#9CA3AF] min-w-11 text-right">0 / {chapters.length}</span>
          </div>

          {/* 본문 글씨 크기 조절 바 */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#EDE0CC] bg-[#FFFBF5] shrink-0">
            <span className="text-sm text-[#9CA3AF] mr-1">글씨</span>
            {CONTENT_SIZE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setContentFontSize(value)}
                className={`flex-1 py-1.5 rounded-lg text-sm transition-colors ${
                  contentFontSize === value
                    ? 'bg-[#E8820C] text-white'
                    : 'bg-[#F3F4F6] text-[#6B7280]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-xl mx-auto px-6 pt-10 pb-12">
              <p className="text-[0.8125rem] font-semibold tracking-[0.15em] text-[#E8820C] mb-3">작가의 말</p>
              <div className="flex items-center gap-3 mb-8">
                <div className="h-px flex-1 bg-[#EDE0CC]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#E8820C] opacity-50" />
                <div className="h-px flex-1 bg-[#EDE0CC]" />
              </div>
              <p className="text-content text-[#2D2D2D] leading-[2.1] whitespace-pre-wrap tracking-wide">
                {book.dedication}
              </p>

              {/* 챕터 사진 갤러리 */}
              {chapters.some((c) => c.photo_url) && (
                <div className="mt-12 flex flex-col gap-6">
                  {chapters.filter((c) => c.photo_url).map((c) => (
                    <img
                      key={c.id}
                      src={c.photo_url!}
                      alt={c.title}
                      className="w-full rounded-2xl object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 border-t border-[#EDE0CC] flex items-center bg-[#FFFBF5]">
            <button type="button" disabled className="flex-1 flex items-center justify-center gap-1.5 py-4 opacity-30">
              <ChevronLeft size={18} className="text-[#6B7280]" />
              <span className="text-base text-[#6B7280]">이전 장</span>
            </button>
            <div className="flex gap-1.5 px-4">
              {/* 작가의 말 페이지 인디케이터 */}
              <div className="rounded-full" style={{ width: '20px', height: '6px', backgroundColor: '#E8820C' }} />
              {chapters.map((_, i) => (
                <div key={i} className="rounded-full" style={{ width: '6px', height: '6px', backgroundColor: '#D1D5DB' }} />
              ))}
            </div>
            <button type="button"
              onClick={() => { if (chapters.length > 0) setActiveChapterId(chapters[0].id) }}
              disabled={chapters.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-4 disabled:opacity-30">
              <span className="text-base text-[#6B7280]">다음 장</span>
              <ChevronLeft size={18} className="text-[#6B7280] rotate-180" />
            </button>
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
