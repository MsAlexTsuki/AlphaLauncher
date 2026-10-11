
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lescvpixttmmbnaluidd.supabase.co';
const supabasePublishableKey =
  'sb_publishable_DEeIl6IL4mPXiEx6SaJ3EQ_OvNhEPP8';

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
