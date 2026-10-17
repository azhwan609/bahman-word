import { useState } from 'react';
import { callFn } from '../lib/api';
import { connectInstagram } from '../lib/instagram';

const INTRO = 'سلام دوست خوب من! 👋 من دستیار هوشمند شما برای مدیریت امکانات اکانت اینستاگرام، تولید محتوای حرفه‌ای، ایده‌پردازی درآمدزایی و جست‌وجوی نام‌های کاربری هستم. خواسته‌ات را بگو تا با هم انجامش بدهیم 🎯';
const CONNECT_INTENT = /(instagram|اینستاگرام|اینستا)/i.test('');
const isInstagramConnectRequest = (value) =>
  /(instagram|اینستاگرام|اینستا)/i.test(value) &&
  /(connect|link|login|authorize|permission|access|popup|pop-up|oauth|اتصال|وصل|ورود|مجوز|دسترسی|اجازه|لینک|پاپ\s?اپ|پنجره)/i.test(value);

export default function AgentChat() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: INTRO }]);
  const [convId, setConvId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    setBusy(true);

    // Open synchronously during the user gesture, before awaiting the Edge Function,
    // so browser popup blockers do not block the real OAuth flow.
    let popup = null;
    const wantsInstagramConnect = isInstagramConnectRequest(text);
    if (wantsInstagramConnect) {
      popup = window.open('about:blank', 'shiwa-instagram', 'popup=yes,width=520,height=720');
      if (!popup) {
        setMsgs((m) => [...m, { role: 'assistant', text: 'برای اتصال اینستاگرام، پنجره‌های پاپ‌آپ را برای این سایت مجاز کن و دوباره درخواست بده. می‌توانم لینک اتصال امن را هم در همین چت باز کنم.' }]);
      }
    }

    try {
      const res = await callFn('agent', { message: text, conversation_id: convId });
      setConvId(res.conversation_id);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply, data: res.data, tool: res.tool }]);
      if (res.action?.type === 'instagram_connect') {
        if (!popup) {
          const direct = await callFn('instagram-oauth', { action: 'start' });
          setMsgs((m) => [...m, { role: 'assistant', text: 'لینک امن اتصال اینستاگرام آماده است. روی لینک بزن تا صفحه رسمی Instagram برای ورود و تأیید مجوزها باز شود.', data: { connectUrl: direct.url } }]);
        } else {
          const username = await connectInstagram(popup);
          setMsgs((m) => [...m, { role: 'assistant', text: `اتصال اینستاگرام با موفقیت انجام شد: @${username}` }]);
        }
      } else if (popup && !popup.closed) {
        popup.close();
      }
    } catch (e) {
      if (popup && !popup.closed) popup.close();
      setMsgs((m) => [...m, { role: 'error', text: e.message || 'درخواست انجام نشد.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="chat">
      <div className="thread">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`} dir="auto">
            {m.tool && <span className="tag">{m.tool}</span>}
            <p>{m.text}</p>
            {m.data?.connectUrl && <a href={m.data.connectUrl} target="_blank" rel="noreferrer" className="primary connect-link">اتصال امن به Instagram ↗</a>}
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
