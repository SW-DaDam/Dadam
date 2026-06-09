import { supabase } from '@/lib/supabase'

export async function sendPushToUser(recipientId: string, title: string, body: string, url?: string) {
  const { data, error } = await supabase.functions.invoke<{ sent: number }>('send-push', {
    body: { recipient_id: recipientId, title, body, url },
  })
  if (error) {
    console.error('[푸시 발송 실패]', error)
    return 0
  }
  return data?.sent ?? 0
}
