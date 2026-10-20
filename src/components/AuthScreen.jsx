import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('in');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setNotice('If this email is registered, a password reset link has been sent.');
        return;
      }
      const { error } = mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (mode === 'up') setNotice('Check your email to confirm your account if email confirmation is enabled.');
    } catch (error) {
      setErr(error?.message || 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setErr('');
    setNotice('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error) {
      setErr(error?.message || 'Google sign-in failed. Check that the Google provider is enabled in Supabase Auth.');
    }
  };

  const title = mode === 'in' ? 'Welcome back' : mode === 'up' ? 'Create your workspace' : 'Reset password';

  return (
    <div className="auth-wrap">
      <div className="auth glass">
        <div className="brand">SHIWA<small>Instagram AI Control Center</small></div>
        <h2>{title}</h2>
        <form onSubmit={submit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          {mode !== 'reset' && <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />}
          <button className="primary wide" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}</button>
        </form>
        {mode === 'in' && <button className="ghost wide" type="button" onClick={signInWithGoogle}>Continue with Google</button>}
        <div className="auth-links">
          <button className="link" type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setNotice(''); }}>
            {mode === 'in' ? 'New here? Create an account' : 'Back to sign in'}
          </button>
          {mode === 'in' && <button className="link" type="button" onClick={() => { setMode('reset'); setErr(''); setNotice(''); }}>Forgot password?</button>}
          {mode === 'reset' && <button className="link" type="button" onClick={() => { setMode('in'); setErr(''); setNotice(''); }}>Back to sign in</button>}
        </div>
        {notice && <p className="muted" role="status">{notice}</p>}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </div>
  );
}
