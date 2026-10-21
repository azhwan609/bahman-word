import { useEffect, useState } from 'react';
import { callFn } from '../lib/api';
import { supabase } from '../lib/supabase';

const MCP_ORIGIN = (import.meta.env.VITE_SHIWA_MCP_URL || 'https://deep-shiwa-ai-mcp.onrender.com').replace(/\/+$/, '');
const INTRO = 'سلام دوست خوب من! 👋 من دستیار هوشمند شما برای مدیریت امکانات اکانت اینستاگرام، تولید محتوای حرفه‌ای، ایده‌پردازی درآمدزایی و جست‌وجوی نام‌های کاربری هستم. خواسته‌ات را بگو تا با هم انجامش بدهیم 🎯';
const CONNECT_INTENT = /(connect|link|login|authorize|permission|access|popup|pop-up|oauth|اتصال|وصل|ورود|مجوز|دسترسی|اجازه|لینک|پاپ\s?اپ|پنجره)/i;
const PROVIDER_MATCH = {
  instagram: /(instagram|اینستاگرام|اینستا)/i,
  telegram: /(telegram|تلگرام)/i,
};

function requestedConnections(value) {
  if (!CONNECT_INTENT.test(value)) return [];
  const instagram = PROVIDER_MATCH.instagram.test(value);
  const telegram = PROVIDER_MATCH.telegram.test(value);
  if (instagram && telegram) return ['instagram', 'telegram'];
  if (/(both|all integrations|هر دو|همه اتصال|هر دو سرویس)/i.test(value)) return ['instagram', 'telegram'];
  if (instagram) return ['instagram'];
  if (telegram) return ['telegram'];
  return [];
}

async function startHostedConnection(provider, popup) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('نشست SHIWA منقضی شده است؛ دوباره وارد حساب شو.');

  const response = await fetch(MCP_ORIGIN + '/connect/' + provider + '/start', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || 'شروع اتصال انجام نشد.');
  const url = payload.authorization_url;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('سرور لینک امن اتصال را برنگرداند.');
  }
  if (popup && !popup.closed) popup.location.href = url;
  else window.location.assign(url);
}

const PROVIDER_INFO = {
  instagram: {
    title: 'Instagram',
    description: 'اتصال حساب Instagram Business یا Creator از طریق صفحه امن Composio.',
  },
  telegram: {
    title: 'Telegram',
    description: 'اتصال ربات تلگرام؛ توکن BotFather را فقط در صفحه امن Composio وارد کن. این مسیر ورود به حساب شخصی تلگرام نیست.',
  },
};

export default function AgentChat() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: INTRO }]);
  const [convId, setConvId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState('');
  const [connectError, setConnectError] = useState('');

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== MCP_ORIGIN || event.data?.type !== 'shiwa:composio') return;
      const provider = PROVIDER_INFO[event.data.provider];
      if (!provider) return;
      setConnecting('');
      setConnectError('');
      setMsgs((messages) => [...messages, {
        role: 'assistant',
        text: event.data.ok
          ? 'اتصال ' + provider.title + ' انجام شد. می‌توانی به SHIWA برگردی.'
          : 'اتصال ' + provider.title + ' کامل نشد؛ دوباره تلاش کن.',
      }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const connect = async (provider) => {
    setConnecting(provider);
    setConnectError('');
    // Open synchronously from the button click so mobile browsers allow the hosted authorization flow.
    const popup = window.open('about:blank', 'shiwa-' + provider + '-connect', 'popup=yes,width=520,height=720');
    try {
      await startHostedConnection(provider, popup);
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      setConnectError(error.message || 'اتصال شروع نشد.');
      setConnecting('');
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((messages) => [...messages, { role: 'user', text }]);
    setBusy(true);
    setConnectError('');

    try {
      const res = await callFn('agent', { message: text, conversation_id: convId });
      setConvId(res.conversation_id);
      const choices = requestedConnections(text);
      const finalChoices = choices.length ? choices : (res.action?.type === 'instagram_connect' ? ['instagram'] : []);
      setMsgs((messages) => [
        ...messages,
        { role: 'assistant', text: res.reply, data: res.data, tool: res.tool },
        ...(finalChoices.length ? [{
          role: 'assistant',
          text: 'برای ادامه، سرویس را انتخاب کن. صفحه مجوز رسمی در پنجره امن باز می‌شود و تأیید نهایی با خودت است.',
          connectors: finalChoices,
        }] : []),
      ]);
    } catch (error) {
      setMsgs((messages) => [...messages, { role: 'error', text: error.message || 'درخواست انجام نشد.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="chat">
      <div className="thread">
        {msgs.map((message, index) => (
          <div key={index} className={`bubble ${message.role}`} dir="auto">
            {message.tool && <span className="tag">{message.tool}</span>}
            <p>{message.text}</p>
            {message.connectors && (
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {message.connectors.map((provider) => (
                  <div key={provider} style={{ padding: 12, border: '1px solid rgba(190,140,255,.35)', borderRadius: 14 }}>
                    <strong>{PROVIDER_INFO[provider].title}</strong>
                    <p style={{ margin: '6px 0 10px' }}>{PROVIDER_INFO[provider].description}</p>
                    <button className="primary" type="button" disabled={Boolean(connecting)} onClick={() => connect(provider)}>
                      {connecting === provider ? 'در حال باز کردن صفحه اتصال…' : 'اتصال ' + PROVIDER_INFO[provider].title + ' ↗'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {message.data?.connectUrl && <a href={message.data.connectUrl} target="_blank" rel="noreferrer" className="primary connect-link">اتصال امن ↗</a>}
            {message.data?.url && <a className="image-preview-link" href={message.data.url} target="_blank" rel="noreferrer"><img src={message.data.url} alt="Generated image — tap to open full size" /><span>Open full image ↗</span></a>}
          </div>
        ))}
        {connectError && <div className="bubble error"><p>{connectError}</p></div>}
        {busy && <div className="bubble assistant"><p>در حال انجام…</p></div>}
      </div>
      <form className="composer glass" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="از Agent درخواست کن…" dir="auto" />
        <button className="primary" disabled={busy}>{busy ? 'در حال انجام…' : 'ارسال'}</button>
      </form>
    </section>
  );
}
