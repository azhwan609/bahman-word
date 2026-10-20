import { useState } from 'react';
import { callFn } from '../lib/api';
import { connectInstagram } from '../lib/instagram';

const INTRO = 'سلام دوست خوب من! 👋 من دستیار هوشمند شما برای مدیریت امکانات اکانت اینستاگرام، تولید محتوای حرفه‌ای، ایده‌پردازی درآمدزایی و جست‌وجوی نام‌های کاربری هستم. خواسته‌ات را بگو تا با هم انجامش بدهیم 🎯';
const isInstagramConnectRequest = (value) => /(instagram|اینستاگرام|اینستا)/i.test(value) && /(connect|link|login|authorize|permission|access|popup|pop-up|oauth|اتصال|وصل|ورود|مجوز|دسترسی|اجازه|لینک|پاپ\s?اپ|پنجره)/i.test(value);
const isTelegramConnectRequest = (value) => /(telegram|تلگرام)/i.test(value) && /(connect|link|login|authorize|permission|access|اتصال|وصل|ورود|مجوز|دسترسی|اجازه|لینک)/i.test(value);
const isBothConnectorsRequest = (value) => /(connector|integration|connectors|integrations|سرویس(?:ها)?|اتصال همه|هر دو|both|all integrations|connection links|لینک اتصال)/i.test(value);

function ConnectorShowcase({ onInstagram, onTelegram, busy, links }) {
  const card = { display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, background: 'rgba(255,255,255,.045)', marginTop: 12, textAlign: 'left' };
  const button = { display: 'block', width: '100%', marginTop: 10, border: 0, borderRadius: 12, padding: '11px 14px', color: 'white', fontWeight: 700, cursor: 'pointer' };
  return <div dir="auto" style={{ maxWidth: 560, marginTop: 14, padding: 16, borderRadius: 22, border: '1px solid rgba(190,140,255,.35)', background: 'linear-gradient(145deg,#11101c,#080d17)', color: '#f7f4ff', boxShadow: '0 16px 50px rgba(0,0,0,.28)' }}>
    <div style={{ fontSize: 18, fontWeight: 800 }}>✦ Connect Your Universe</div>
    <div style={{ color: '#b9b4c9', fontSize: 13, marginTop: 5 }}>پلتفرم موردنظرت را انتخاب کن؛ ورود و تأیید دسترسی در سرویس رسمی انجام می‌شود.</div>
    <div style={card}>
      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 15, display: 'grid', placeItems: 'center', fontSize: 30, background: 'linear-gradient(135deg,#ffb347,#f02d91 52%,#7447ff)' }}>◎</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800 }}>Instagram</div>
        <div style={{ fontSize: 12, color: '#c8c1d5', marginTop: 3 }}>اتصال امن از طریق صفحه رسمی Instagram / Meta</div>
        <button type="button" onClick={onInstagram} disabled={busy} style={{ ...button, background: 'linear-gradient(100deg,#f97316,#db2777,#7c3aed)' }}>{busy ? 'در حال آماده‌سازی…' : 'اتصال به Instagram ↗'}</button>
        {links.instagram && <a href={links.instagram} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, color: '#f0b5ff', fontSize: 12 }}>اگر پنجره باز نشد، اینجا بزن ↗</a>}
      </div>
    </div>
    <div style={card}>
      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 15, display: 'grid', placeItems: 'center', fontSize: 28, background: 'linear-gradient(135deg,#53c8ff,#1674d1)' }}>➤</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800 }}>Telegram</div>
        <div style={{ fontSize: 12, color: '#c8c1d5', marginTop: 3 }}>اتصال به ربات SHIWA در تلگرام</div>
        <button type="button" onClick={onTelegram} disabled={busy} style={{ ...button, background: 'linear-gradient(100deg,#38bdf8,#1674d1)' }}>{busy ? 'در حال آماده‌سازی…' : 'اتصال به Telegram ↗'}</button>
        {links.telegram && <a href={links.telegram} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, color: '#9bdcff', fontSize: 12 }}>اگر پنجره باز نشد، اینجا بزن ↗</a>}
      </div>
    </div>
    <div style={{ color: '#aaa5b7', fontSize: 11, marginTop: 12 }}>🛡️ SHIWA رمز عبور حساب‌های شما را درخواست نمی‌کند.</div>
  </div>;
}

export default function AgentChat() {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: INTRO }]);
  const [convId, setConvId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [connectorBusy, setConnectorBusy] = useState(false);
  const [connectorLinks, setConnectorLinks] = useState({ instagram: '', telegram: '' });

  const connectInstagramFromCard = async () => {
    setConnectorBusy(true);
    setConnectorLinks((v) => ({ ...v, instagram: '' }));
    const popup = window.open('about:blank', 'shiwa-instagram', 'popup=yes,width=520,height=720');
    if (popup) { try { popup.document.write('<!doctype html><meta charset="utf-8"><title>SHIWA</title><body style="background:#080d17;color:#f7f4ff;font:16px sans-serif;padding:32px"><h2>SHIWA · Instagram</h2><p>در حال آماده‌سازی اتصال امن…</p><p>این پنجره را نبند.</p></body>'); popup.document.close(); } catch {} }
    try {
      if (!popup) {
        const result = await callFn('instagram-oauth', { action: 'start' });
        if (!result?.url) throw new Error('لینک اتصال اینستاگرام از سرور دریافت نشد.');
        setConnectorLinks((v) => ({ ...v, instagram: result.url }));
        setMsgs((m) => [...m, { role: 'assistant', text: 'مرورگر پنجره را مسدود کرد؛ از لینک جایگزین داخل ویترین اتصال استفاده کن.' }]);
        return;
      }
      const username = await connectInstagram(popup);
      setMsgs((m) => [...m, { role: 'assistant', text: `اتصال اینستاگرام با موفقیت انجام شد: @${username}` }]);
    } catch (error) {
      if (popup && !popup.closed) { try { popup.document.body.innerHTML = '<h2>SHIWA · Instagram</h2><p>اتصال انجام نشد. این پنجره را ببند و از لینک جایگزین استفاده کن.</p>'; } catch { popup.close(); } }
      setMsgs((m) => [...m, { role: 'error', text: error?.message || 'اتصال Instagram انجام نشد.' }]);
    } finally { setConnectorBusy(false); }
  };

  const connectTelegramFromCard = async () => {
    setConnectorBusy(true);
    setConnectorLinks((v) => ({ ...v, telegram: '' }));
    const popup = window.open('about:blank', 'shiwa-telegram', 'popup=yes,width=520,height=720');
    if (popup) { try { popup.document.write('<!doctype html><meta charset="utf-8"><title>SHIWA</title><body style="background:#080d17;color:#f7f4ff;font:16px sans-serif;padding:32px"><h2>SHIWA · Telegram</h2><p>در حال آماده‌سازی لینک اتصال امن…</p></body>'); popup.document.close(); } catch {} }
    try {
      const result = await callFn('telegram-link', { action: 'start' });
      if (!result?.url) throw new Error('لینک اتصال تلگرام از سرور دریافت نشد.');
      setConnectorLinks((v) => ({ ...v, telegram: result.url }));
      if (popup) popup.location.href = result.url;
      else setMsgs((m) => [...m, { role: 'assistant', text: 'مرورگر پنجره را مسدود کرد؛ از لینک جایگزین داخل ویترین اتصال استفاده کن.' }]);
    } catch (error) {
      if (popup && !popup.closed) { try { popup.document.body.innerHTML = '<h2>SHIWA · Telegram</h2><p>ساخت لینک اتصال ناموفق بود. پیام خطا را در SHIWA بررسی کن.</p>'; } catch { popup.close(); } }
      setMsgs((m) => [...m, { role: 'error', text: error?.message || 'اتصال Telegram انجام نشد.' }]);
    } finally { setConnectorBusy(false); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    const wantsBoth = isBothConnectorsRequest(text);
    const wantsInstagram = isInstagramConnectRequest(text);
    const wantsTelegram = isTelegramConnectRequest(text);
    if (wantsBoth || (wantsInstagram && wantsTelegram)) {
      setMsgs((m) => [...m, { role: 'assistant', text: 'هر دو گزینه را اینجا می‌بینی. روی سرویس دلخواهت بزن تا اتصال شروع شود.', showConnectors: true }]);
      return;
    }
    if (wantsInstagram || wantsTelegram) {
      setMsgs((m) => [...m, { role: 'assistant', text: 'از ویترین زیر سرویس دلخواهت را انتخاب کن. هیچ صفحه‌ای تا زمانی که روی دکمه اتصال نزنی باز نمی‌شود.', showConnectors: true }]);
      return;
    }
    setBusy(true);
    try {
      const res = await callFn('agent', { message: text, conversation_id: convId });
      setConvId(res.conversation_id);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply, data: res.data, tool: res.tool }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: 'error', text: e.message || 'درخواست انجام نشد.' }]);
    } finally { setBusy(false); }
  };

  return <section className="chat">
    <div className="thread">
      {msgs.map((m, i) => <div key={i} className={`bubble ${m.role}`} dir="auto">
        {m.tool && <span className="tag">{m.tool}</span>}
        <p>{m.text}</p>
        {m.showConnectors && <ConnectorShowcase onInstagram={connectInstagramFromCard} onTelegram={connectTelegramFromCard} busy={connectorBusy} links={connectorLinks} />}
        {m.data?.connectUrl && <a href={m.data.connectUrl} target="_blank" rel="noreferrer" className="primary connect-link">اتصال امن به Instagram ↗</a>}
        {m.data?.telegramConnectUrl && <a href={m.data.telegramConnectUrl} target="_blank" rel="noreferrer" className="primary connect-link">اتصال امن به Telegram ↗</a>}
        {m.data?.url && <a className="image-preview-link" href={m.data.url} target="_blank" rel="noreferrer"><img src={m.data.url} alt="Generated image — tap to open full size" /><span>Open full image ↗</span></a>}
      </div>)}
      {busy && <div className="bubble assistant"><p>در حال انجام…</p></div>}
    </div>
    <form className="composer glass" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="از Agent درخواست کن…" dir="auto" />
      <button className="primary" disabled={busy}>{busy ? 'در حال انجام…' : 'ارسال'}</button>
    </form>
  </section>;
}
