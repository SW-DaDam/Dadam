import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { Tables } from '@/types/database'

type FamilyLink = Tables<'family_links'>
type FamilyMemberWithProfile = FamilyLink & {
  profile: Tables<'profiles'> | null
}

interface UseInviteReturn {
  inviteCode: string | null
  inviteLink: string | null
  familyMembers: FamilyMemberWithProfile[]
  loading: boolean
  error: string | null
  generateInviteCode: () => Promise<void>
  acceptInvite: (code: string, seniorTitle: string, readerNickname: string) => Promise<{ ok: boolean; message: string }>
  removeFamilyLink: (linkId: string) => Promise<void>
  refetch: () => Promise<void>
}

const APP_ORIGIN = import.meta.env.VITE_APP_URL ?? window.location.origin

function makeInviteLink(code: string): string {
  return `${APP_ORIGIN}/join?code=${code}`
}

function newExpiresAt(): string {
  const d = new Date()
  d.setHours(d.getHours() + 24)
  return d.toISOString()
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function useInvite(): UseInviteReturn {
  const { user } = useAuthStore()
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    // 유효한 초대 코드 조회 (pending + 만료 전)
    const { data: linkData, error: linkErr } = await supabase
      .from('family_links')
      .select('*, profile:profiles!family_links_family_id_fkey(*)')
      .eq('senior_id', user.id)
      .order('invited_at', { ascending: false })

    if (linkErr) {
      setError(linkErr.message)
      setLoading(false)
      return
    }

    const rows = (linkData ?? []) as FamilyMemberWithProfile[]

    // 유효한 pending 코드 (만료 전)
    const pendingCode = rows.find(
      (r) =>
        r.invite_status === 'pending' &&
        new Date(r.expires_at) > new Date()
    )
    setInviteCode(pendingCode?.invite_code ?? null)

    // 수락된 가족만 표시
    setFamilyMembers(rows.filter((r) => r.invite_status === 'accepted'))
    setLoading(false)
  }, [user])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // 초대 코드 생성 (기존 pending 코드 만료 처리 후 새로 생성)
  async function generateInviteCode(): Promise<void> {
    if (!user) return
    const code = randomCode()

    const { error: err } = await supabase.from('family_links').insert({
      senior_id: user.id,
      invite_code: code,
      invite_status: 'pending',
      expires_at: newExpiresAt(),
    })

    if (err) {
      setError(err.message)
      return
    }
    setInviteCode(code)
  }

  // 가족이 초대 코드 입력 후 수락
  async function acceptInvite(
    code: string,
    seniorTitle: string,
    readerNickname: string,
  ): Promise<{ ok: boolean; message: string }> {
    if (!user) return { ok: false, message: '로그인이 필요해요' }

    // family_links FK(→ profiles) 위반 방지: 기존 profiles 행 유지, 없으면 생성
    await supabase
      .from('profiles')
      .upsert({ id: user.id, role: 'family', display_name: '사용자' }, { ignoreDuplicates: true })

    const { data: link, error: findErr } = await supabase
      .from('family_links')
      .select('*')
      .eq('invite_code', code.toUpperCase())
      .eq('invite_status', 'pending')
      .single()

    if (findErr || !link) return { ok: false, message: '유효하지 않은 초대 코드예요' }
    if (new Date(link.expires_at) < new Date()) return { ok: false, message: '초대 코드가 만료됐어요' }
    if (link.senior_id === user.id) return { ok: false, message: '본인 초대 코드는 사용할 수 없어요' }

    const { error: updateErr } = await supabase
      .from('family_links')
      .update({
        family_id: user.id,
        invite_status: 'accepted',
        accepted_at: new Date().toISOString(),
        relationship: readerNickname,
        senior_title: seniorTitle,
        reader_nickname: readerNickname,
      })
      .eq('id', link.id)

    if (updateErr) return { ok: false, message: updateErr.message }
    return { ok: true, message: '가족으로 연결됐어요!' }
  }

  // 가족 연결 해제
  async function removeFamilyLink(linkId: string): Promise<void> {
    const { error: err } = await supabase
      .from('family_links')
      .update({ invite_status: 'revoked' })
      .eq('id', linkId)

    if (err) { setError(err.message); return }
    setFamilyMembers((prev) => prev.filter((m) => m.id !== linkId))
  }

  return {
    inviteCode,
    inviteLink: inviteCode ? makeInviteLink(inviteCode) : null,
    familyMembers,
    loading,
    error,
    generateInviteCode,
    acceptInvite,
    removeFamilyLink,
    refetch: fetchData,
  }
}
