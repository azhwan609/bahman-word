import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import AuthScreen from './components/AuthScreen';
import AgentChat from './components/AgentChat';
import ToolModule from './components/ToolModule';
import InstagramLite from './components/InstagramLite';

export const MODULES = [
  { id: 'chat', label: 'AI Chat' },
  { id: 'image', label: 'Image Generator' },
  { id: 'content', label: 'Content + Hashtags + Brand + Stickers' },
  { id: 'username', label: 'Deep Username Search' },
  { id: 'business', label: 'AI Business Ideas' },
  { id: 'instagram', label: 'Instagram Lite' },
];

export default function App() {
  const [session, setSession] = useState(undefined);
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState('chat');
  const [mobileNavOpen, setMobileNavOpen] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <AuthScreen />;

  const current = MODULES.find((m) => m.id === active);
  return (
    <div className="shell">
      <Sidebar modules={MODULES} active={active} open={open} navVisible={mobileNavOpen} email={session.user.email}
        onSelect={(id) => { setActive(id); if (window.innerWidth < 800) setOpen(false); }} />
      <button className={"mobile-nav-power" + (mobileNavOpen ? " is-open" : "")} type="button" onClick={() => setMobileNavOpen((visible) => !visible)} aria-label={mobileNavOpen ? "Hide navigation for full chat" : "Show navigation"} title={mobileNavOpen ? "Hide menu / Full chat" : "Show menu"}><span>{mobileNavOpen ? "⏻" : "☰"}</span></button>
      <main className="stage">
        <header className="topbar glass">
          <button className="icon" onClick={() => setOpen(!open)} aria-label="Toggle menu">☰</button>
          <h1>{current.label}</h1>
        </header>
        {active === 'chat' && <AgentChat />}
        {active === 'image' && <ToolModule tool="generate_image" title="Image Generator" placeholder="Describe the image: product shot, social graphic, portrait…" showStyle />}
        {active === 'content' && <ToolModule tool="generate_content" title="Content Studio" placeholder="Topic, product or brand. Example: my brand is Asadi, write 3 captions and hashtags" />}
        {active === 'username' && <ToolModule tool="username_search" title="Deep Username Search" placeholder="Base username or brand name" />}
        {active === 'business' && <ToolModule tool="business_ideas" title="Business Ideas" placeholder="Your skills, niche, budget and goal" />}
        {active === 'instagram' && <InstagramLite />}
      </main>
    </div>
  );
}

