import { supabase } from './supabase';

// Calls an edge function with the user's JWT. Surfaces server error messages.
export async function callFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error ?? message; } catch { /* non-JSON */ }
    throw new Error(message);
  }
  return data;
}

