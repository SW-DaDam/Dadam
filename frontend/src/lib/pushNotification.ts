import { supabase } from '@/lib/supabase'

export async function sendPushToUser(recipientId: string, title: string, body: string, url?: string) {
  await supabase.functions.invoke('send-push', {
    body: { recipient_id: recipientId, title, body, url },
  })
}
