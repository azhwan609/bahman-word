import { useState } from 'react';
import { callFn } from '../lib/api';
import { connectInstagram } from '../lib/instagram';

const INTRO = 'سلام دوست خوب من! 👋 من دستیار هوشمند شما برای مدیریت و کنترل امکانات اکانت اینستاگرام، تولید محتوای حرفه‌ای، ایده‌پردازی درآمدزایی و جست‌وجوی عمیق نام‌های کاربری هستم. خواسته‌ات را بگو تا با هم انجامش بدهیم 🎯';

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
    try {
      const res = await callFn('agent', { message: text, conversation_id: convId });
      setConvId(res.conversation_id);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply, data: res.data, tool: res.tool }]);
      if (res.action?.type === 'instagram_connect') {
        const username = await connectInstagram();
        setMsgs((m) => [...m, { role: 'assistant', text: `Instagram connected as @${username}. Instagram tools are enabled.` }]);
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: 'error', text: e.message }]);
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
            {m.data?.url && <a className="image-preview-link" href={m.data.url} target="_blank" rel="noreferrer"><img src={m.data.url} alt="Generated image — tap to open full size" /><span>Open full image ↗</span></a>}
          </div>
        ))}
        {busy && <div className="bubble assistant"><p>Working…</p></div>}
      </div>
      <form className="composer glass" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Command your agent…" dir="auto" />
        <button className="primary" disabled={busy}>Send</button>
      </form>
    </section>
  );
}

