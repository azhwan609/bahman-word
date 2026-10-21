import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const MCP_ORIGIN = (import.meta.env.VITE_SHIWA_MCP_URL || 'https://deep-shiwa-ai-mcp.onrender.com').replace(/\/+$/, '');
const PROVIDERS = [
  { id: 'instagram', title: 'Instagram', description: 'Connect an Instagram Business or Creator account through Composio.' },
  { id: 'telegram', title: 'Telegram', description: 'Connect a Telegram bot by securely entering its BotFather token on Composio’s hosted connection page.' },
];

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Your SHIWA session has expired. Sign in again.');
  return token;
}

async function requestConnection(provider, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(MCP_ORIGIN + '/connect/' + provider + '/accounts', {
    ...options,
    headers: {
      Authorization: 'Bearer ' + token,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || provider + ' connection request failed (' + response.status + ').');
  }
  return data;
}

export default function InstagramLite() {
  const [accounts, setAccounts] = useState({ instagram: [], telegram: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setErr('');
    try {
      const results = await Promise.all(PROVIDERS.map(async (provider) => {
        const data = await requestConnection(provider.id);
        return [provider.id, data.accounts || []];
      }));
      setAccounts(Object.fromEntries(results));
    } catch (e) {
      setErr(e.message || 'Could not load your connected accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== MCP_ORIGIN || event.data?.type !== 'shiwa:composio') return;
      const provider = PROVIDERS.find((item) => item.id === event.data.provider);
      if (!provider) return;
      setNotice(event.data.ok ? provider.title + ' connected successfully.' : provider.title + ' connection was not completed.');
      setErr('');
      refresh();
    };
    window.addEventListener('message', onMessage);
    refresh();
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const connect = async (provider) => {
    setBusy(provider);
    setErr('');
    setNotice('');
    // Open synchronously inside the click handler to avoid mobile popup blockers.
    const popup = window.open('about:blank', 'shiwa-' + provider + '-connect', 'popup,width=520,height=720');
    try {
      const token = await getAccessToken();
      const response = await fetch(MCP_ORIGIN + '/connect/' + provider + '/start', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not start ' + provider + ' connection (' + response.status + ').');
      if (!data.authorization_url || !data.authorization_url.startsWith('https://')) {
        throw new Error('The server did not return a valid secure connection link.');
      }
      if (popup && !popup.closed) popup.location.href = data.authorization_url;
      else window.location.assign(data.authorization_url);
    } catch (e) {
      if (popup && !popup.closed) popup.close();
      setErr(e.message || 'Could not start the connection.');
      setBusy('');
    }
  };

  const disconnect = async (provider, account) => {
    const label = account.display_name || (provider === 'instagram' ? 'Instagram account' : 'Telegram bot');
    if (!window.confirm('Disconnect ' + label + ' from SHIWA?')) return;
    setBusy(provider);
    setErr('');
    try {
      await requestConnection(provider, {
        method: 'DELETE',
        headers: {},
      });
      // The account-specific route is used so a user cannot revoke another user's connection.
      const token = await getAccessToken();
      const response = await fetch(MCP_ORIGIN + '/connect/' + provider + '/accounts/' + encodeURIComponent(account.id), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not disconnect the account.');
      setNotice(provider === 'instagram' ? 'Instagram disconnected.' : 'Telegram disconnected.');
      await refresh();
    } catch (e) {
      setErr(e.message || 'Could not disconnect the account.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="module">
      <div className="card glass">
        <h2>Social Connections · Composio</h2>
        <p className="muted">
          Each connection is scoped to your SHIWA user. Composio hosts the authorization flow and stores the provider credentials;
          SHIWA does not receive your Instagram password or Telegram bot token.
        </p>
        {loading && <p className="muted">Checking your connections…</p>}
        <div className="instagram-account-list">
          {PROVIDERS.map((provider) => {
            const providerAccounts = accounts[provider.id] || [];
            return (
              <div className="card glass" key={provider.id}>
                <h3>{provider.title}</h3>
                <p className="muted">{provider.description}</p>
                {providerAccounts.length === 0
                  ? <p className="muted">Not connected</p>
                  : providerAccounts.map((account) => (
                    <div className="row" key={account.id}>
                      <div>
                        <strong>{account.display_name || provider.title + ' account'}</strong>
                        <p className="muted">Connected through Composio</p>
                      </div>
                      <button className="danger" disabled={!!busy} onClick={() => disconnect(provider.id, account)}>Disconnect</button>
                    </div>
                  ))}
                <div className="row">
                  <button className="primary" disabled={!!busy} onClick={() => connect(provider.id)}>
                    {busy === provider.id ? 'Please wait…' : '＋ Connect ' + provider.title}
                  </button>
                  <button className="ghost" disabled={!!busy} onClick={refresh}>Refresh</button>
                </div>
              </div>
            );
          })}
        </div>
        {notice && <p className="result-text">{notice}</p>}
        {err && <p className="err">{err}</p>}
      </div>
    </section>
  );
}
