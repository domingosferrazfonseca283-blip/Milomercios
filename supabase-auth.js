import { supabase } from './supabase-config.js';

export { supabase };

export async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export function onAuthStateChanged(callback) {
  let active = true;
  supabase.auth.getUser().then(({ data }) => { if (active) callback(data.user || null); });
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null));
  return () => { active = false; listener.subscription.unsubscribe(); };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
  if (error) throw error;
  return data.user;
}

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfile(profile) {
  const { data, error } = await supabase.from('profiles').upsert(profile).select().single();
  if (error) throw error;
  return data;
}
