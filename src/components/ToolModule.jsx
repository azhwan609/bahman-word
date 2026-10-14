import { useEffect, useState } from 'react';
import { callFn } from '../lib/api';
import { supabase } from '../lib/supabase';

const STYLES = ['cinematic', 'minimal', 'luxury', 'neon', 'watercolor', 'product studio'];

export default function ToolModule({ tool, title, placeholder, showStyle }) {
  const [input, setInput] = useState('');
  const [style, setStyle] = useState('cinematic');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadHistory = async () => {
    if (!showStyle) return;
    const { data } = await supabase.from('generated_assets').select('prompt,output_url,created_at')
      .eq('module', 'image_generator').order('created_at', { ascending: false }).limit(12);
    const signed = await Promise.all((data ?? []).map(async (row) => {
      const { data: s } = await supabase.storage.from('creator-assets').createSignedUrl(row.output_url, 3600);
      return { ...row, url: s?.signedUrl };
    }));
    setHistory(signed);
  };
  useEffect(() => { loadHistory(); }, []);

  const run = async () => {
    if (!input.trim() || busy) return;
    setBusy(true); setErr('');
    try {
      const res = await callFn('agent', { tool, message: input.trim(), style });
      setResult(res);
      loadHistory();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <section className="module">
      <div className="card glass">
        <h2>{title}</h2>
        <textarea rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder} dir="auto" />
        {showStyle && (
          <div className="chips">
            {STYLES.map((s) => (
              <button key={s} className={`chip ${style === s ? 'on' : ''}`} onClick={() => setStyle(s)}>{s}</button>
            ))}
          </div>
        )}
        <button className="primary" onClick={run} disabled={busy}>{busy ? 'Working…' : 'Run'}</button>
        {err && <p className="err">{err}</p>}
      </div>

      {result && (
        <div className="card glass result">
          {result.data?.url && <img src={result.data.url} alt="Result" />}
          <pre dir="auto">{result.reply}</pre>
        </div>
      )}

      {showStyle && history.length > 0 && (
        <div className="card glass">
          <h3>History</h3>
          <div className="gallery">
            {history.map((h, i) => h.url && <figure key={i}><img src={h.url} alt={h.prompt} /><figcaption>{h.prompt}</figcaption></figure>)}
          </div>
        </div>
      )}
    </section>
  );
}

