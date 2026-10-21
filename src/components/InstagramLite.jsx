import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const MCP_ORIGIN = (import.meta.env.VITE_SHIWA_MCP_URL || 'https://deep-shiwa-ai-mcp.onrender.com').replace(/\/+$/, '');

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Your SHIWA session has expired. Sign in again.');
  return token;
}

async function requestAccounts(path = '/connect/instagram/accounts', options = {}) {
  const token = await getAccessToken();
  const response = await fetch(MCP_ORIGIN + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || 'Instagram connection request failed (' + response.status + ').');
  }
  return data;
}

export default function InstagramLite() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setErr('');
    try {
      const data = await requestAccounts();
      setAccounts(data.accounts || []);
    } catch (e) {
      setErr(e.message || 'Could not load connected Instagram accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('instagram_connected') === '1') {
      setNotice('Instagram connected successfully.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (params.get('instagram_error')) {
      setErr('Instagram authorization did not complete. Please try connecting again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    refresh();
  }, []);

  const connect = async () => {
    setBusy(true);
    setErr('');
    setNotice('');
    try {
      const data = await requestAccounts('/connect/instagram/start');
      if (!data.authorization_url) throw new Error('The server did not return an Instagram authorization URL.');
      window.location.assign(data.authorization_url);
    } catch (e) {
      setErr(e.message || 'Could not start Instagram authorization.');
      setBusy(false);
    }
  };

  const disconnect = async (account) => {
    if (!window.confirm('Disconnect @' + (account.external_username || 'Instagram account') + ' from SHIWA?')) return;
    setBusy(true);
    setErr('');
    try {
      await requestAccounts('/connect/instagram/accounts/' + encodeURIComponent(account.id), { method: 'DELETE' });
      setNotice('Instagram account disconnected.');
      await refresh();
    } catch (e) {
      setErr(e.message || 'Could not disconnect this account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="module">
      <div className="card glass">
        <h2>Instagram Connections</h2>
        <p className="muted">
          Connect your own Instagram professional account through official Instagram Login. Each connection is stored
          separately under your SHIWA user, and you can disconnect accounts independently.
        </p>

        {loading ? <p className="muted">Loading your connected accounts…</p> : accounts.length === 0
          ? <p className="muted">No Instagram accounts connected yet.</p>
          : <div className="instagram-account-list">
              {accounts.map((account) => (
                <div className="row" key={account.id}>
                  <div>
                    <strong>@{account.external_username || 'Instagram account'}</strong>
                    <p className="muted">{account.status === 'active' ? 'Connected' : 'Disconnected'}</p>
                  </div>
                  {account.status === 'active' &&
                    <button className="danger" disabled={busy} onClick={() => disconnect(account)}>Disconnect</button>}
                </div>
              ))}
            </div>}

        <div className="row">
          <button className="primary" disabled={busy} onClick={connect}>
            {busy ? 'Please wait…' : '＋ Connect Instagram account'}
          </button>
          <button className="ghost" disabled={busy} onClick={refresh}>Refresh</button>
          <button className="ghost" onClick={() => window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')}>Open Instagram</button>
        </div>
        {notice && <p className="result-text">{notice}</p>}
        {err && <p className="err">{err}</p>}
      </div>
    </section>
  );
}
