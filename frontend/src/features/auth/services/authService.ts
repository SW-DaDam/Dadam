import { supabase } from '@/lib/supabase'

export async function setupSeniorProfile(
  userId: string,
  displayName: string,
  gender: 'male' | 'female' | null,
  birthDate: string | null,
  avatarUrl?: string | null,
  fullName?: string,
): Promise<{ error: unknown }> {
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      role: 'senior',
      display_name: displayName,
      full_name: fullName ?? displayName,
      avatar_url: avatarUrl ?? null,
    })

  if (profileError) {
    console.error('[Auth] 저자 프로필 설정 실패', profileError)
    return { error: profileError }
  }

  const { error: seniorError } = await supabase
    .from('senior_profiles')
    .upsert({
      id: userId,
      onboarding_completed: false,
      gender,
      birth_date: birthDate,
    })

  if (seniorError) {
    console.error('[Auth] senior_profiles 생성 실패', seniorError)
    return { error: seniorError }
  }

  return { error: null }
}

export async function setupFamilyProfile(
  userId: string,
  displayName: string,
  avatarUrl?: string | null,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      role: 'family',
      display_name: displayName,
      full_name: displayName,
      avatar_url: avatarUrl ?? null,
    })

  if (error) {
    console.error('[Auth] 독자 프로필 설정 실패', error)
    return { error }
  }

  return { error: null }
}

export async function acceptInviteCode(
  code: string,
  userId: string,
  seniorTitle: string,
  readerNickname: string,
): Promise<{ ok: boolean; message: string }> {
  const { data: link, error: findErr } = await supabase
    .from('family_links')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .eq('invite_status', 'pending')
    .single()

  if (findErr || !link) return { ok: false, message: '유효하지 않은 초대 코드예요' }
  if (new Date(link.expires_at) < new Date()) return { ok: false, message: '초대 코드가 만료됐어요' }
  if (link.senior_id === userId) return { ok: false, message: '본인 초대 코드는 사용할 수 없어요' }

  const { error: updateErr } = await supabase
    .from('family_links')
    .update({
      family_id: userId,
      invite_status: 'accepted',
      accepted_at: new Date().toISOString(),
      relationship: readerNickname,
      senior_title: seniorTitle,
      reader_nickname: readerNickname,
    })
    .eq('id', link.id)

  if (updateErr) return { ok: false, message: updateErr.message }
  return { ok: true, message: '독자로 연결됐어요' }
}

export async function completeSeniorOnboarding(userId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('senior_profiles')
    .update({ onboarding_completed: true })
    .eq('id', userId)

  if (error) console.error('[Auth] 온보딩 완료 처리 실패', error)
  return { error: error ?? null }
}
