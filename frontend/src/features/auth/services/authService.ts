import { supabase } from '@/lib/supabase'

// 어르신 프로필 설정: profiles UPSERT + senior_profiles UPSERT
// 트리거 미완료로 profiles row가 없을 경우에도 안전하게 생성
export async function setupSeniorProfile(
  userId: string,
  displayName: string
): Promise<{ error: unknown }> {
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, role: 'senior', display_name: displayName })

  if (profileError) {
    console.error('[Auth] 어르신 프로필 설정 실패', profileError)
    return { error: profileError }
  }

  const { error: seniorError } = await supabase
    .from('senior_profiles')
    .upsert({ id: userId, onboarding_completed: false })

  if (seniorError) {
    console.error('[Auth] senior_profiles 생성 실패', seniorError)
    return { error: seniorError }
  }

  return { error: null }
}

// 가족 프로필 설정: profiles UPSERT
// 트리거 미완료로 profiles row가 없을 경우에도 안전하게 생성
export async function setupFamilyProfile(
  userId: string,
  displayName: string
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, role: 'family', display_name: displayName })

  if (error) {
    console.error('[Auth] 가족 프로필 설정 실패', error)
    return { error }
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
