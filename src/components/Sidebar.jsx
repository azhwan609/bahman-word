import { supabase } from '../lib/supabase';

const NAV_ITEMS = [
  { id: 'chat', label: 'Home', icon: '⌂', color: '#1fd1f0', badge: 'HUB' },
  { id: 'image', label: 'Image AI', icon: '✧', color: '#a25bff', badge: 'AI' },
  { id: 'instagram', label: 'Instagram', icon: '◎', color: '#f06ab8', badge: 'LIVE' },
  { id: 'content', label: 'Tools', icon: '⌁', color: '#f5b342', badge: '12' },
  { id: 'business', label: 'Business Ideas', icon: '▥', color: '#2de2c4', badge: 'AI' },
  { id: 'username', label: 'Username Search', icon: '⌕', color: '#1fd1f0', badge: 'SEARCH' },
];

function PulseLogo({ small = false }) {
  return <div className={'logo-ring' + (small ? ' logo-ring-small' : '')} aria-label="SHIWA AI">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h4l2-6 3 12 3-9 2 3h6" /></svg>
  </div>;
}

export default function Sidebar({ modules, active, open, navVisible = true, email, onSelect }) {
  const visibleItems = NAV_ITEMS.filter((item) => modules.some((module) => module.id === item.id));
  const renderItem = (item, mobile = false) => (
    <button key={item.id} type="button"
      className={'nav-item' + (item.id === active ? ' active' : '') + (mobile ? ' nav-mobile-item' : '')}
      style={{ '--c': item.color }} onClick={() => onSelect(item.id)}
      aria-current={item.id === active ? 'page' : undefined}>
      <span className="nav-icon-wrap">{item.icon}</span>
      <span className="label">{item.label}</span>
      {!mobile && <span className="badge">{item.badge}</span>}
    </button>
  );

  return <>
    <aside className={'sidebar' + (open ? ' open' : ' closed')}>
      <div className="brand">
        <PulseLogo />
        <div className="brand-copy">
          <div className="wordmark"><span className="slash" />ai chat<span className="slash" /></div>
          <div className="sub">CREATOR HUB</div>
        </div>
        <button className="power" title="Sign out" aria-label="Sign out" onClick={() => supabase.auth.signOut()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>
        </button>
      </div>
      <nav className="nav">{visibleItems.map((item) => renderItem(item))}</nav>
      <div className="stats-card">
        <h4>رشد هفتگی فالوور</h4>
        <div className="bars" aria-label="Weekly follower growth">{[30,45,38,62,55,78,90].map((h, i) => <span key={i} style={{ height: h + '%' }} />)}</div>
        <div className="stats-row"><span>امروز</span><b>+60%</b></div>
      </div>
      <div className="profile">
        <div className="avatar">{(email || 'C').slice(0,1).toUpperCase()}</div>
        <div className="profile-info"><div className="name">Creator</div><div className="status">Online</div></div>
      </div>
      <div className="footer-tag"><div className="eq"><span/><span/><span/><span/><span/></div><span>AI • CONTENT • SOCIAL • GROWTH</span></div>
      <div className="account-email">{email}</div>
      <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </aside>
    <nav className={"mobile-bottom-nav" + (navVisible ? "" : " nav-hidden")} aria-label="Main navigation">{visibleItems.map((item) => renderItem(item, true))}</nav>
  </>;
}
