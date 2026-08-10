import { supabase } from './supabase';

export function getMediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
