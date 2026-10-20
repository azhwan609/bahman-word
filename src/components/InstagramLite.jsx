import { useEffect, useState } from 'react';
import { callFn } from '../lib/api';
import { connectInstagram } from '../lib/instagram';
import TelegramConnect from './TelegramConnect';

export default function InstagramLite() {
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState('');
  const [err, setErr] = useState('');

  const refresh = () => callFn('instagram-oauth', { action: 'status' }).then(setStatus).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); }, []);

  const connect = async () => {
    setErr('');
    try { await connectInstagram(); refresh(); } catch (e) { setErr(e.message); }
  };
  const loadProfile = () => callFn('agent', { tool: 'instagram_profile', message: 'my instagram profile' })
    .then((r) => setProfile(r.reply)).catch((e) => setErr(e.message));
  const disconnect = async () => {
    await callFn('instagram-oauth', { action: 'disconnect' });
    setProfile(''); refresh();
  };

  return (
    <section className="module">
      <div className="card glass">
        <h2>Instagram Lite</h2>
        <p className="muted">
          Instagram's login page cannot be embedded in an iframe for security reasons. Sign-in always happens on
          instagram.com through official OAuth, and this panel uses the connected account through the Graph API.
        </p>
        {status?.connected
          ? <p><span className="dot" /> Connected as <strong>@{status.username}</strong></p>
          : <p className="muted">Not connected.</p>}
        <div className="row">
          {!status?.connected && <button className="primary" onClick={connect}>Connect Instagram</button>}
          {status?.connected && <button className="ghost" onClick={loadProfile}>Load profile</button>}
          <button className="ghost" onClick={() => window.open('https://www.instagram.com/accounts/login/', '_blank', 'noopener,noreferrer')}>Open instagram.com</button>
          {status?.connected && <button className="danger" onClick={disconnect}>Disconnect</button>}
        </div>
        {profile && <p className="result-text">{profile}</p>}
        {err && <p className="err">{err}</p>}
      </div>
      <TelegramConnect />
    </section>
  );
}

