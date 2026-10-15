import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('in');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (error) setErr(error.message);
  };

  return (
    <div className="auth-wrap">
      <div className="auth glass">
        <div className="brand">SHIWA<small>Instagram AI Control Center</small></div>
        <h2>{mode === 'in' ? 'Welcome back' : 'Create your workspace'}</h2>
        <form onSubmit={submit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <button className="primary wide" type="submit">{mode === 'in' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
