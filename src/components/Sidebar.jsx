import { supabase } from '../lib/supabase';

export default function Sidebar({ modules, active, open, email, onSelect }) {
  return (
    <aside className={`sidebar glass ${open ? 'open' : 'closed'}`}>
      <div className="brand">SHIWA<small>Creator Hub</small></div>
      <nav>
        {modules.map((m) => (
          <button key={m.id} className={`nav ${m.id === active ? 'on' : ''}`} onClick={() => onSelect(m.id)}>{m.label}</button>
        ))}
      </nav>
      <footer>
        <span className="dot" /> <span className="email">{email}</span>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </footer>
    </aside>
  );
}

