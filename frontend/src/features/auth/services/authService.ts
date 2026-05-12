import { supabase } from '@/lib/supabase'

// 어르신 프로필 설정: profiles UPDATE + senior_profiles UPSERT
// .select()로 실제 업데이트된 row를 받아 0건이면 트리거 미완료로 판단해 에러 반환
export async function setupSeniorProfile(
  userId: string,
  displayName: string,
  gender: 'male' | 'female' | null,
  birthDate: string | null  // 'YYYY-MM-DD' 형식
): Promise<{ error: unknown }> {
  const { data: updatedRows, error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'senior', display_name: displayName })
    .eq('id', userId)
    .select('id')

  if (profileError) {
    console.error('[Auth] 어르신 프로필 role 설정 실패', profileError)
    return { error: profileError }
  }

  if (!updatedRows || updatedRows.length === 0) {
    const err = new Error('profiles row not found — handle_new_user trigger may be delayed')
    console.error('[Auth]', err.message)
    return { error: err }
  }

  // 트리거가 role='family'로 생성했을 수 있으므로 UPSERT로 처리
  // gender, birth_date는 표지 생성 및 챗봇 프롬프트에서 추후 활용
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

// 가족 프로필 설정: profiles role + display_name UPDATE
// .select()로 실제 업데이트된 row를 받아 0건이면 트리거 미완료로 판단해 에러 반환
export async function setupFamilyProfile(
  userId: string,
  displayName: string
): Promise<{ error: unknown }> {
  const { data: updatedRows, error } = await supabase
    .from('profiles')
    .update({ role: 'family', display_name: displayName })
    .eq('id', userId)
    .select('id')

  if (error) {
    console.error('[Auth] 가족 프로필 설정 실패', error)
    return { error }
  }

  if (!updatedRows || updatedRows.length === 0) {
    const err = new Error('profiles row not found — handle_new_user trigger may be delayed')
    console.error('[Auth]', err.message)
    return { error: err }
  }

  return { error: null }
}

// 어르신 온보딩 완료 표시: senior_profiles.onboarding_completed = true
export async function completeSeniorOnboarding(userId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('senior_profiles')
    .update({ onboarding_completed: true })
    .eq('id', userId)

  if (error) {
    console.error('[Auth] 온보딩 완료 처리 실패', error)
  }
  return { error: error ?? null }
}
