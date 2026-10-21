import { useState } from 'react';
import { callFn } from '../lib/api';
import { connectInstagram } from '../lib/instagram';

const INTRO = 'سلام دوست خوب من! 👋 من دستیار هوشمند شما برای مدیریت امکانات اکانت اینستاگرام، تولید محتوای حرفه‌ای، ایده‌پردازی درآمدزایی و جست‌وجوی نام‌های کاربری هستم. خواسته‌ات را بگو تا با هم انجامش بدهیم 🎯';
const isInstagramConnectRequest = (value) => /(instagram|اینستاگرام|اینستا)/i.test(value) && /(connect|link|login|authorize|permission|access|popup|pop-up|oauth|اتصال|وصل|ورود|مجوز|دسترسی|اجازه|لینک|پاپ\s?اپ|پنجره)/i.test(value);
const isTelegramConnectRequest = (value) => /(telegram|تلگرام)/i.test(value) && /(connect|link|login|authorize|permission|access|اتصال|وصل|ورود|مجوز|دسترسی|اجازه|لینک)/i.test(value);
const isBothConnectorsRequest = (value) => /(connector|integration|connectors|integrations|سرویس(?:ها)?|اتصال همه|هر دو|both|all integrations|connection links|لینک اتصال)/i.test(value);

function ConnectorShowcase({ onInstagram, onTelegram, busy, links }) {
  return (
    <section className="connector-showcase" dir="rtl" aria-label="اتصال سرویس‌های اجتماعی">
      <header className="connector-showcase__header">
        <div className="connector-showcase__spark" aria-hidden="true">✦</div>
        <div>
          <span className="connector-showcase__eyebrow">SHIWA · SECURE INTEGRATIONS</span>
          <h3>اتصال حساب‌های اجتماعی</h3>
          <p>سرویس را انتخاب کن؛ تأیید دسترسی در صفحه رسمی همان سرویس انجام می‌شود.</p>
        </div>
      </header>
      <div className="connector-showcase__grid">
        <article className="social-connect-card social-connect-card--instagram">
          <div className="social-connect-card__top">
            <div className="social-connect-card__logo" aria-hidden="true">◎</div>
            <div className="social-connect-card__title"><span className="social-connect-card__eyebrow">CREATOR ACCOUNT</span><h4>Instagram</h4></div>
            <span className="social-connect-card__secure" aria-label="اتصال امن">✓</span>
          </div>
          <p className="social-connect-card__description">اتصال حساب Creator یا Business از مسیر رسمی Instagram / Meta.</p>
          <div className="social-connect-card__trust"><span>✓</span> رمز عبور در SHIWA ذخیره نمی‌شود</div>
          <button type="button" className="social-connect-card__action" onClick={onInstagram} disabled={busy}><span>{busy ? 'در حال آماده‌سازی اتصال…' : 'اتصال امن به Instagram'}</span><span aria-hidden="true">{busy ? '◌' : '↗'}</span></button>
          {links.instagram && <div className="social-connect-card__fallback"><p>پنجره جدید مسدود شد. از این مسیر امن ادامه بده.</p><a href={links.instagram} target="_self">ادامه اتصال در همین صفحه ↗</a></div>}
          <footer className="social-connect-card__footer"><span /> صفحه مجوز رسمی Instagram</footer>
        </article>
        <article className="social-connect-card social-connect-card--telegram">
          <div className="social-connect-card__top">
            <div className="social-connect-card__logo" aria-hidden="true">➤</div>
            <div className="social-connect-card__title"><span className="social-connect-card__eyebrow">BOT INTEGRATION</span><h4>Telegram</h4></div>
            <span className="social-connect-card__secure" aria-label="اتصال امن">✓</span>
          </div>
          <p className="social-connect-card__description">اتصال ربات تلگرام SHIWA از طریق لینک رسمی t.me؛ این مسیر ورود به حساب شخصی نیست.</p>
          <div className="social-connect-card__trust"><span>✓</span> توکن ربات را فقط در محل امن وارد کن</div>
          <button type="button" className="social-connect-card__action" onClick={onTelegram} disabled={busy}><span>{busy ? 'در حال آماده‌سازی اتصال…' : 'اتصال امن به Telegram'}</span><span aria-hidden="true">{busy ? '◌' : '↗'}</span></button>
          {links.telegram && <div className="social-connect-card__fallback"><p>اگر پنجره جدید باز نشد، لینک رسمی تلگرام آماده است.</p><a href={links.telegram} target="_self">ادامه در Telegram ↗</a></div>}
          <footer className="social-connect-card__footer"><span /> انتقال به Telegram رسمی</footer>
        </article>
      </div>
      <div className="connector-showcase__privacy"><span>♧</span> تو کنترل می‌کنی چه دسترسی‌هایی را تأیید کنی.</div>
    </section>
  );
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
      if (popup && !popup.closed) { try { popup.document.body.innerHTML = `<meta charset="utf-8"><body style="background:#080d17;color:#f7f4ff;font:16px sans-serif;padding:24px"><h2>SHIWA · Instagram</h2><p>${String(error?.message || 'اتصال انجام نشد.').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]))}</p><p>به SHIWA برگرد و لینک جایگزین را انتخاب کن.</p></body>`; } catch { popup.close(); } }
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
      if (popup && !popup.closed) { try { popup.document.body.innerHTML = `<meta charset="utf-8"><body style="background:#080d17;color:#f7f4ff;font:16px sans-serif;padding:24px"><h2>SHIWA · Telegram</h2><p>${String(error?.message || 'ساخت لینک اتصال ناموفق بود.').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]))}</p><p>به SHIWA برگرد و لینک جایگزین را انتخاب کن.</p></body>`; } catch { popup.close(); } }
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
