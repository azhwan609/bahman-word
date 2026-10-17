import { supabase } from '../lib/supabase';

const NAV_ITEMS = [
  { id: 'chat', label: 'Home', icon: '▦' },
  { id: 'image', label: 'Agent', icon: '⌘' },
  { id: 'instagram', label: 'ιиsтαgєям', icon: '◎' },
  { id: 'content', label: 'Tools', icon: '▣' },
  { id: 'business', label: 'Stats', icon: '▥' },
  { id: 'username', label: 'Profile', icon: '♙' },
];

export default function Sidebar({ modules, active, open, email, onSelect }) {
  const visibleItems = NAV_ITEMS.filter((item) => modules.some((module) => module.id === item.id));
  const renderNav = (item, mobile = false) => (
    <button
      key={item.id}
      type="button"
      className={`nav ${item.id === active ? 'on' : ''} ${mobile ? 'nav-mobile-item' : ''}`}
      onClick={() => onSelect(item.id)}
      aria-current={item.id === active ? 'page' : undefined}
    >
      {mobile && <span className="nav-icon" aria-hidden="true">{item.icon}</span>}
      <span>{item.label}</span>
    </button>
  );

  return (
    <>
      <aside className={`sidebar glass ${open ? 'open' : 'closed'}`}>
        <div className="brand-lockup">
          <div className="ai-orb" aria-label="SHIWA AI pulse logo">
            <span className="orb-ring" />
            <svg viewBox="0 0 64 40" role="img" aria-label="AI pulse" className="pulse-wave">
              <path d="M2 22 H13 L20 22 L26 7 L34 34 L41 16 L46 22 H62" />
            </svg>
          </div>
          <div className="brand brand-script">ஜ۩ ʂԋιɯα ɳαȥ ۩ஜ<small>CREATOR HUB</small></div>
        </div>
        <nav className="desktop-nav">
          {modules.map((m) => (
            <button key={m.id} className={`nav ${m.id === active ? 'on' : ''}`} onClick={() => onSelect(m.id)}>{m.label}</button>
          ))}
        </nav>
        <footer>
          <span className="dot" /> <span className="email">{email}</span>
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </footer>
      </aside>
      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {visibleItems.map((item) => renderNav(item, true))}
      </nav>
    </>
  );
}
