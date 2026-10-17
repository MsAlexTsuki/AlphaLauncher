import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lescvpixttmmbnaluidd.supabase.co';
const supabasePublishableKey =
  'sb_publishable_DEeIl6IL4mPXiEx6SaJ3EQ_OvNhEPP8';

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      // Keep the Community session in the launcher's persistent WebView storage.
      storage: window.localStorage,
      storageKey: 'alphaclient.community.auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
