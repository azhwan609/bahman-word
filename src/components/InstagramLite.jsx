import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { connectProvider, connectionApiBaseUrl, getConnections } from '../lib/connections';

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Your SHIWA session has expired. Sign in again.');
  return data.session.access_token;
}

export default function InstagramLite() {
  const [accounts, setAccounts] = useState([]);
  const [err, setErr] = useState('');
  const apiBaseUrl = connectionApiBaseUrl();

  const refresh = async () => {
    try { setAccounts(await getConnections('instagram', await getAccessToken(), apiBaseUrl)); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { refresh(); }, [apiBaseUrl]);

  const connect = async () => {
    setErr('');
    try {
      await connectProvider('instagram', { getAccessToken, apiBaseUrl });
      await refresh();
    } catch (e) { setErr(e.message); }
  };
  const disconnect = async () => {
    try {
      const account = accounts[0];
      const response = await fetch(`${apiBaseUrl}/connect/instagram/accounts/${encodeURIComponent(account.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await getAccessToken()}` },
      });
      if (!response.ok) throw new Error('Could not disconnect this Instagram account.');
      await refresh();
    } catch (e) { setErr(e.message); }
  };

  return (
    <section className="module">
      <div className="card glass">
        <h2>Instagram Lite</h2>
        <p className="muted">
          Connect through Composio's secure hosted flow. SHIWA verifies the account with the backend before showing it as connected.
        </p>
        {accounts.length
          ? <p><span className="dot" /> Connected <strong>{accounts[0].display_name || accounts[0].id}</strong></p>
          : <p className="muted">Not connected.</p>}
        <div className="row">
          {!accounts.length && <button className="primary" onClick={connect}>Connect Instagram</button>}
          {accounts.length > 0 && <button className="danger" onClick={disconnect}>Disconnect</button>}
        </div>
        {err && <p className="err">{err}</p>}
      </div>
    </section>
  );
}

