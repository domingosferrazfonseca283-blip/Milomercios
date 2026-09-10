import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const SUPABASE_URL = 'https://bnrypbkenfvzvugilrfi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_or5jef6ejjtVBfwDvHZ3lw_FY4uq1_i';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
export const SUPABASE_BUCKET = 'milomercios';
export const SUPABASE_IMAGES_BUCKET = 'milomercios-imagens';
