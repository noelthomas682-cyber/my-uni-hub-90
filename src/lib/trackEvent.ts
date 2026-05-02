import { supabase } from '@/integrations/supabase/client';

export async function trackEvent(
  userId: string,
  event: string,
  metadata?: Record<string, unknown>
) {
  try {
    await supabase.from('behavioural_signals').insert({
      user_id: userId,
      signal_type: event,
      metadata: metadata ?? {},
      recorded_at: new Date().toISOString(),
    });
  } catch {
    // non-blocking — tracking failures should never break the app
  }
}