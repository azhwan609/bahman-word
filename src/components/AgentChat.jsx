import { useEffect, useRef, useState } from 'react';
import { callFn } from '../lib/api';
import { supabase } from '../lib/supabase';
import { connectProvider, connectionApiBaseUrl, getConnections } from '../lib/connections';

const INTRO = 'سلام دوست خوب من! 👋 من دستیار هوشمند شما برای مدیریت امکانات اکانت اینستاگرام، تولید محتوای حرفه‌ای، ایده‌پردازی درآمدزایی و جست‌وجوی نام‌های کاربری هستم. خواسته‌ات را بگو تا با هم انجامش بدهیم 🎯';
const isInstagramConnectRequest = (value) =>
  /(instagram|اینستاگرام|اینستا)/i.test(value) &&
  /(connect|link|login|authorize|permission|access|popup|pop-up|oauth|اتصال|وصل|ورود|مجوز|دسترسی|اجازه|لینک|پاپ\s?اپ|پنجره)/i.test(value);
const isTelegramConnectRequest = (value) =>
  /(telegram|تلگرام)/i.test(value) &&
  /(connect|link|login|authorize|permission|access|اتصال|وصل|ورود|مجوز|دسترسی|اجازه|لینک)/i.test(value);

const PROVIDER_NAMES = { instagram: 'Instagram', telegram: 'Telegram' };

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Your SHIWA session has expired. Sign in again and retry the connection.');
  }
  return data.session.access_token;
}

export default function AgentChat() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: INTRO }]);
  const [convId, setConvId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [connections, setConnections] = useState({ instagram: [], telegram: [] });
  const inFlight = useRef(false);
  const apiBaseUrl = connectionApiBaseUrl();

  useEffect(() => {
    let active = true;
    Promise.all(['instagram', 'telegram'].map(async (provider) => {
      try {
        return [provider, await getConnections(provider, await getAccessToken(), apiBaseUrl)];
      } catch {
        return [provider, []];
      }
    })).then((results) => {
      if (active) setConnections(Object.fromEntries(results));
    });

    const params = new URLSearchParams(window.location.search);
    const callbackProvider = params.get('connection');
    const callbackResult = params.get('result');
    if (['instagram', 'telegram'].includes(callbackProvider) && callbackResult) {
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
      if (callbackResult !== 'success') {
        setMsgs((messages) => [...messages, { role: 'error', text: `${PROVIDER_NAMES[callbackProvider]} connection was cancelled or failed.` }]);
      } else {
        getAccessToken()
          .then((token) => getConnections(callbackProvider, token, apiBaseUrl))
          .then((accounts) => {
            if (!active) return;
            setConnections((current) => ({ ...current, [callbackProvider]: accounts }));
            setMsgs((messages) => [...messages, {
              role: accounts.length ? 'assistant' : 'error',
              text: accounts.length
                ? `${PROVIDER_NAMES[callbackProvider]} connection verified.`
                : `${PROVIDER_NAMES[callbackProvider]} returned, but SHIWA could not verify an active account.`,
            }]);
          })
          .catch(() => {
            if (active) setMsgs((messages) => [...messages, { role: 'error', text: 'Could not verify the connection. Please refresh and try again.' }]);
          });
      }
    }
    return () => { active = false; };
  }, [apiBaseUrl]);

  const connect = async (provider) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMsgs((messages) => [...messages, { role: 'assistant', text: `Starting secure ${PROVIDER_NAMES[provider]} connection…` }]);
    try {
      const account = await connectProvider(provider, {
        getAccessToken,
        apiBaseUrl,
        onStatus: (text) => setMsgs((messages) => [...messages, { role: 'assistant', text }]),
      });
      if (account?.redirecting) return;
      setConnections((current) => ({ ...current, [provider]: [account] }));
      const detail = provider === 'telegram'
        ? ' Telegram uses Composio’s hosted bot-token setup; you may need to create a bot with BotFather and provide its token only in Composio’s authorization screen.'
        : '';
      setMsgs((messages) => [...messages, { role: 'assistant', text: `${PROVIDER_NAMES[provider]} connection verified.${detail}` }]);
    } catch (error) {
      setMsgs((messages) => [...messages, { role: 'error', text: error.message || `${PROVIDER_NAMES[provider]} connection failed.` }]);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || inFlight.current) return;
    const provider = isInstagramConnectRequest(text) ? 'instagram' : isTelegramConnectRequest(text) ? 'telegram' : null;
    if (provider) {
      setInput('');
      setMsgs((messages) => [...messages, { role: 'user', text }]);
      await connect(provider);
      return;
    }
    inFlight.current = true;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    setBusy(true);

    try {
      const res = await callFn('agent', { message: text, conversation_id: convId });
      setConvId(res.conversation_id);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply, data: res.data, tool: res.tool }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'error', text: e.message || 'درخواست انجام نشد.' }]);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="chat">
      <div className="connection-actions" aria-label="Account connections">
        {['instagram', 'telegram'].map((provider) => (
          <button key={provider} type="button" className="connection-button" disabled={busy} onClick={() => connect(provider)}>
            <span>{PROVIDER_NAMES[provider]}</span>
            <small>{connections[provider].length ? 'Connected' : 'Connect'}</small>
          </button>
        ))}
      </div>
      <div className="thread">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`} dir="auto">
            {m.tool && <span className="tag">{m.tool}</span>}
            <p>{m.text}</p>
            {m.data?.url && <a className="image-preview-link" href={m.data.url} target="_blank" rel="noreferrer"><img src={m.data.url} alt="Generated image — tap to open full size" /><span>Open full image ↗</span></a>}
          </div>
        ))}
        {busy && <div className="bubble assistant"><p>در حال انجام…</p></div>}
      </div>
      <form className="composer glass" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="از Agent درخواست کن…" dir="auto" />
        <button className="primary" disabled={busy}>{busy ? 'در حال انجام…' : 'ارسال'}</button>
      </form>
    </section>
  );
}
