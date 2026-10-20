import { useEffect, useState } from 'react';
import { callFn } from '../lib/api';

export default function TelegramConnect() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [connectUrl, setConnectUrl] = useState('');

  const refresh = async () => {
    try {
      const result = await callFn('telegram-link', { action: 'status' });
      setStatus(result);
    } catch (error) {
      setErr(error?.message || 'Could not check Telegram connection.');
    }
  };

  useEffect(() => { refresh(); }, []);

  const connect = async () => {
    setErr('');
    setBusy(true);
    // Open synchronously inside the click gesture so mobile browsers allow the hand-off.
    const popup = window.open('about:blank', 'shiwa-telegram', 'popup=yes,width=520,height=720');
    try {
      const result = await callFn('telegram-link', { action: 'start' });
      if (!result?.url) throw new Error('Telegram connection URL was not returned.');
      setConnectUrl(result.url);
      if (popup && !popup.closed) popup.location.href = result.url;
      else setErr('The popup was blocked. Use the Telegram link shown below.');
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      setErr(error?.message || 'Could not start Telegram linking.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setErr('');
    setBusy(true);
    try {
      await callFn('telegram-link', { action: 'disconnect' });
      setConnectUrl('');
      await refresh();
    } catch (error) {
      setErr(error?.message || 'Could not disconnect Telegram.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card glass">
      <h2>ιηѕтαgαям · Telegram Connector</h2>
      <p className="muted">Link a Telegram chat through your SHIWA bot. The bot token stays on the server; this does not sign in to or control your personal Telegram account.</p>
      {status?.connected
        ? <p><span className="dot" /> Connected {status.username ? <>as <strong>@{status.username}</strong></> : 'to Telegram chat'}.</p>
        : <p className="muted">Telegram is not connected.</p>}
      <div className="row">
        {!status?.connected && <button className="primary" type="button" onClick={connect} disabled={busy}>{busy ? 'Opening…' : 'Connect Telegram'}</button>}
        {status?.connected && <button className="danger" type="button" onClick={disconnect} disabled={busy}>Disconnect Telegram</button>}
        <button className="ghost" type="button" onClick={refresh} disabled={busy}>Refresh status</button>
      </div>
      {connectUrl && <a className="connect-link" href={connectUrl} target="_blank" rel="noreferrer">Open Telegram connection link ↗</a>}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
