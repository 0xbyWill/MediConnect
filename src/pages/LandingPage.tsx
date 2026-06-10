import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import Hero from '../components/landing/Hero';
import ProblemSection from '../components/landing/ProblemSection';
import TransformationSection from '../components/landing/TransformationSection';
import AISection from '../components/landing/AISection';
import CommunicationSection from '../components/landing/CommunicationSection';
import RolesSection from '../components/landing/RolesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import FutureSection from '../components/landing/FutureSection';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

interface LandingPageProps {
  onEnter: () => void;
}

const NAV_LINKS = [
  { id: 'problema', label: 'Recursos' },
  { id: 'assistente-ia', label: 'Assistente IA' },
  { id: 'comunicacao', label: 'Comunicação' },
  { id: 'como-funciona', label: 'Como funciona' },
];

export default function LandingPage({ onEnter }: LandingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = useCallback((id: string) => {
    setMenuOpen(false);
    const target = document.getElementById(id);
    const root = rootRef.current;
    if (!target || !root) return;
    const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 76;
    root.scrollTo({ top, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > 8);
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="mcl-root" ref={rootRef}>
      <header className={`mcl-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="mcl-container mcl-nav-inner">
          <button type="button" className="mcl-nav-brand" onClick={() => scrollTo('inicio')}>
            <img src="/mediconnect-mark.png" alt="" aria-hidden="true" />
            <span>MediConnect</span>
          </button>

          <nav className="mcl-nav-links" aria-label="Navegação principal">
            {NAV_LINKS.map(link => (
              <button key={link.id} type="button" onClick={() => scrollTo(link.id)}>
                {link.label}
              </button>
            ))}
          </nav>

          <div className="mcl-nav-actions">
            <button type="button" className="mcl-btn mcl-btn-primary" onClick={onEnter}>
              Entrar no Sistema
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="mcl-nav-toggle"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="mcl-nav-mobile">
            {NAV_LINKS.map(link => (
              <button key={link.id} type="button" onClick={() => scrollTo(link.id)}>
                {link.label}
              </button>
            ))}
            <button type="button" className="mcl-btn mcl-btn-primary mcl-btn-block" onClick={onEnter}>
              Entrar no Sistema
            </button>
          </div>
        )}
      </header>

      <main className="mcl-main">
        <Hero onEnter={onEnter} onExplore={() => scrollTo('problema')} />
        <ProblemSection />
        <TransformationSection />
        <AISection />
        <CommunicationSection />
        <RolesSection />
        <HowItWorksSection />
        <FutureSection />
        <FinalCTA onEnter={onEnter} />
        <Footer onEnter={onEnter} onNavigate={scrollTo} />
      </main>

      <style>{LANDING_STYLES}</style>
    </div>
  );
}

const LANDING_STYLES = `
.mcl-root {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  background: #f6fbf8;
  color: #0f172a;
  font-family: 'Montserrat', sans-serif;
  scroll-behavior: smooth;
}

.mcl-root *, .mcl-root *::before, .mcl-root *::after { box-sizing: border-box; }

.mcl-container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 28px;
}

/* ─── Buttons ─────────────────────────────────────────── */
.mcl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 0;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  padding: 11px 18px;
  cursor: pointer;
  white-space: nowrap;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease, border-color .18s ease;
}
.mcl-btn-lg { padding: 15px 26px; font-size: 15px; border-radius: 14px; }
.mcl-btn-block { width: 100%; }
.mcl-btn-primary {
  background: linear-gradient(95deg, #00a63f 0%, #009157 100%);
  color: #fff;
  box-shadow: 0 14px 26px rgba(0, 166, 63, 0.28);
}
.mcl-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 34px rgba(0, 166, 63, 0.34);
}
.mcl-btn-ghost {
  background: rgba(255, 255, 255, 0.7);
  color: #0c4a32;
  border: 1.5px solid rgba(0, 166, 63, 0.28);
}
.mcl-btn-ghost:hover {
  background: #fff;
  border-color: #00a63f;
  transform: translateY(-2px);
}

/* ─── Nav ─────────────────────────────────────────────── */
.mcl-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  width: 100%;
  transition: background .25s ease, box-shadow .25s ease, border-color .25s ease;
  border-bottom: 1px solid transparent;
}
.mcl-nav.is-scrolled {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  border-bottom-color: rgba(15, 118, 75, 0.1);
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.05);
}
.mcl-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
  gap: 18px;
}
.mcl-nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: 0;
  font-weight: 800;
  font-size: 19px;
  color: #0b3b27;
}
.mcl-nav-brand img { width: 34px; height: 34px; object-fit: contain; }
.mcl-nav-links {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mcl-nav-links button {
  background: transparent;
  border: 0;
  padding: 8px 14px;
  border-radius: 9px;
  font-weight: 600;
  font-size: 14px;
  color: #334155;
  transition: background .15s ease, color .15s ease;
}
.mcl-nav-links button:hover { background: rgba(0, 166, 63, 0.08); color: #00863a; }
.mcl-nav-actions { display: flex; align-items: center; gap: 10px; }
.mcl-nav-toggle {
  display: none;
  width: 42px; height: 42px;
  align-items: center; justify-content: center;
  border: 1px solid rgba(15, 118, 75, 0.16);
  border-radius: 11px;
  background: #fff;
  color: #0b3b27;
}
.mcl-nav-mobile {
  display: none;
  flex-direction: column;
  gap: 6px;
  padding: 12px 28px 18px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(15, 118, 75, 0.1);
}
.mcl-nav-mobile button:not(.mcl-btn) {
  text-align: left;
  background: transparent;
  border: 0;
  padding: 11px 8px;
  font-weight: 600;
  font-size: 15px;
  color: #1e293b;
  border-radius: 8px;
}
.mcl-nav-mobile button:not(.mcl-btn):hover { background: rgba(0, 166, 63, 0.07); }

/* ─── Section shells ──────────────────────────────────── */
.mcl-section { padding: 96px 0; position: relative; }
.mcl-section-head { max-width: 720px; margin: 0 auto 56px; text-align: center; }
.mcl-eyebrow {
  display: inline-block;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #00a63f;
  margin-bottom: 16px;
}
.mcl-eyebrow-light { color: #6ee7a8; }
.mcl-section-title {
  font-size: clamp(28px, 3.6vw, 44px);
  line-height: 1.1;
  font-weight: 800;
  color: #0b1f17;
  letter-spacing: -0.02em;
}
.mcl-title-light { color: #f0fdf6; }
.mcl-muted-title { color: #64748b; }
.mcl-section-lead {
  margin-top: 18px;
  font-size: clamp(15px, 1.5vw, 18px);
  line-height: 1.6;
  color: #475569;
  font-weight: 500;
}
.mcl-lead-light { color: rgba(220, 252, 231, 0.78); }
.mcl-grad-text {
  background: linear-gradient(95deg, #00a63f, #34d399);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ─── Hero ────────────────────────────────────────────── */
.mcl-hero {
  position: relative;
  padding: 64px 0 104px;
  overflow: hidden;
  background:
    radial-gradient(circle at 78% 8%, rgba(110, 231, 183, 0.32) 0, transparent 38%),
    radial-gradient(circle at 12% 30%, rgba(0, 166, 63, 0.12) 0, transparent 42%),
    linear-gradient(180deg, #f0faf4 0%, #f6fbf8 60%, #f6fbf8 100%);
}
.mcl-hero-glow {
  position: absolute;
  top: -160px; right: -120px;
  width: 620px; height: 620px;
  background: radial-gradient(circle, rgba(0, 166, 63, 0.18), transparent 64%);
  filter: blur(20px);
  pointer-events: none;
}
.mcl-hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 56px;
  align-items: center;
}
.mcl-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(0, 166, 63, 0.1);
  border: 1px solid rgba(0, 166, 63, 0.2);
  color: #00863a;
  font-size: 13px;
  font-weight: 700;
}
.mcl-hero-title {
  margin-top: 22px;
  font-size: clamp(34px, 4.6vw, 58px);
  line-height: 1.06;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #08160f;
}
.mcl-hero-sub {
  margin-top: 22px;
  max-width: 540px;
  font-size: clamp(16px, 1.6vw, 19px);
  line-height: 1.6;
  color: #41584d;
  font-weight: 500;
}
.mcl-hero-actions { margin-top: 32px; display: flex; flex-wrap: wrap; gap: 14px; }
.mcl-hero-points {
  margin-top: 34px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  list-style: none;
}
.mcl-hero-points li {
  position: relative;
  padding-left: 24px;
  font-size: 14px;
  font-weight: 600;
  color: #2f4a3c;
}
.mcl-hero-points li::before {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  width: 16px; height: 16px;
  transform: translateY(-50%);
  border-radius: 50%;
  background: rgba(0, 166, 63, 0.15);
  box-shadow: inset 0 0 0 4px #00a63f;
}

/* Hero mockup */
.mcl-hero-visual { position: relative; }
.mcl-mock {
  border-radius: 20px;
  background: #fff;
  border: 1px solid rgba(15, 118, 75, 0.1);
  box-shadow: 0 30px 70px rgba(7, 51, 33, 0.18);
  overflow: hidden;
}
.mcl-mock-dash { animation: mclFloatY 7s ease-in-out infinite; }
.mcl-mock-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 13px 16px;
  background: #f3f8f5;
  border-bottom: 1px solid rgba(15, 118, 75, 0.08);
}
.mcl-dot { width: 10px; height: 10px; border-radius: 50%; background: #cbd5d0; }
.mcl-dot:nth-child(1) { background: #fca5a5; }
.mcl-dot:nth-child(2) { background: #fcd34d; }
.mcl-dot:nth-child(3) { background: #6ee7a8; }
.mcl-mock-bar-title { margin-left: 8px; font-size: 12px; font-weight: 700; color: #5a6b62; }
.mcl-mock-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.mcl-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.mcl-kpi {
  display: flex; flex-direction: column; gap: 6px;
  padding: 14px;
  border-radius: 14px;
  background: #f7fbf9;
  border: 1px solid rgba(15, 118, 75, 0.08);
}
.mcl-kpi-ic {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9px; color: #fff;
}
.mcl-kpi-ic-green { background: #00a63f; }
.mcl-kpi-ic-blue { background: #2563eb; }
.mcl-kpi-ic-amber { background: #d97706; }
.mcl-kpi-val { font-size: 22px; font-weight: 800; color: #0b1f17; line-height: 1; }
.mcl-kpi-lbl { font-size: 11px; font-weight: 600; color: #64748b; }
.mcl-chart-card {
  padding: 16px;
  border-radius: 14px;
  background: #f7fbf9;
  border: 1px solid rgba(15, 118, 75, 0.08);
}
.mcl-chart-head {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 14px;
}
.mcl-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px;
}
.mcl-chip-up { background: rgba(0, 166, 63, 0.12); color: #00863a; }
.mcl-bars { display: flex; align-items: flex-end; gap: 9px; height: 96px; }
.mcl-bar {
  flex: 1;
  border-radius: 6px 6px 3px 3px;
  background: linear-gradient(180deg, #34d399, #00a63f);
  opacity: 0.9;
  animation: mclGrow 1s ease forwards;
  transform-origin: bottom;
}
.mcl-float {
  position: absolute;
  display: flex;
  gap: 11px;
  align-items: flex-start;
  padding: 13px 15px;
  width: 232px;
  background: #fff;
  border-radius: 14px;
  border: 1px solid rgba(15, 118, 75, 0.1);
  box-shadow: 0 18px 40px rgba(7, 51, 33, 0.16);
}
.mcl-float strong { display: block; font-size: 13px; font-weight: 800; color: #0b1f17; }
.mcl-float p { margin-top: 3px; font-size: 12px; color: #5a6b62; line-height: 1.4; }
.mcl-float-ic {
  flex-shrink: 0;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9px;
  background: linear-gradient(135deg, #00a63f, #34d399);
  color: #fff;
}
.mcl-float-ic-green { background: #25d366; }
.mcl-float-ai { top: 8%; left: -34px; animation: mclFloatY 6s ease-in-out infinite; }
.mcl-float-notify { bottom: 6%; right: -28px; animation: mclFloatY 6.5s ease-in-out infinite reverse; }

/* ─── Problem ─────────────────────────────────────────── */
.mcl-problem { background: #fff; }
.mcl-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.mcl-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.mcl-card {
  padding: 26px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid rgba(15, 118, 75, 0.1);
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.mcl-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 22px 44px rgba(7, 51, 33, 0.1);
  border-color: rgba(0, 166, 63, 0.28);
}
.mcl-card-problem { background: #f8fbf9; }
.mcl-card-ic {
  width: 46px; height: 46px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 13px;
  margin-bottom: 18px;
}
.mcl-card-ic-soft { background: rgba(220, 38, 38, 0.08); color: #dc2626; }
.mcl-card-ic-grad { background: linear-gradient(135deg, #00a63f, #34d399); color: #fff; }
.mcl-card-ic-glow {
  background: rgba(0, 166, 63, 0.1);
  color: #00a63f;
  box-shadow: 0 0 0 6px rgba(0, 166, 63, 0.06);
}
.mcl-card-title { font-size: 18px; font-weight: 800; color: #0b1f17; }
.mcl-card-text { margin-top: 9px; font-size: 14px; line-height: 1.6; color: #51635a; font-weight: 500; }

/* ─── Transformation ──────────────────────────────────── */
.mcl-transform { background: #f6fbf8; }
.mcl-compare {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 22px;
  max-width: 940px;
  margin: 0 auto;
}
.mcl-compare-card {
  padding: 30px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid rgba(15, 118, 75, 0.12);
}
.mcl-compare-before { box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05); }
.mcl-compare-after {
  border-color: rgba(0, 166, 63, 0.3);
  box-shadow: 0 24px 50px rgba(0, 166, 63, 0.14);
  background: linear-gradient(180deg, #ffffff, #f3fcf6);
}
.mcl-compare-head { margin-bottom: 20px; }
.mcl-compare-tag {
  display: inline-block;
  font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
  padding: 5px 12px; border-radius: 999px; margin-bottom: 12px;
}
.mcl-compare-tag-before { background: #f1f5f9; color: #64748b; }
.mcl-compare-tag-after { background: rgba(0, 166, 63, 0.12); color: #00863a; }
.mcl-compare-head h3 { font-size: 19px; font-weight: 800; color: #0b1f17; }
.mcl-compare-list { list-style: none; display: flex; flex-direction: column; gap: 14px; }
.mcl-compare-list li {
  display: flex; align-items: center; gap: 12px;
  font-size: 15px; font-weight: 600; color: #334155;
}
.mcl-compare-mark {
  flex-shrink: 0;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 7px;
}
.mcl-compare-mark-x { background: #f1f5f9; color: #94a3b8; }
.mcl-compare-mark-check { background: #00a63f; color: #fff; }
.mcl-compare-arrow {
  display: flex; align-items: center; justify-content: center;
  width: 46px; height: 46px;
  border-radius: 50%;
  background: #fff;
  color: #00a63f;
  border: 1px solid rgba(0, 166, 63, 0.24);
  box-shadow: 0 8px 20px rgba(0, 166, 63, 0.16);
}

/* ─── AI ──────────────────────────────────────────────── */
.mcl-ai {
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at 80% 0%, #0d4a30 0, #07351f 46%, #04231480 100%), #062a19;
  background-color: #052e1c;
}
.mcl-ai-glow {
  position: absolute;
  top: 10%; left: 50%;
  width: 760px; height: 760px;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(52, 211, 153, 0.16), transparent 62%);
  pointer-events: none;
}
.mcl-ai-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 56px;
  align-items: center;
}
.mcl-ai-caps { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 10px; }
.mcl-ai-cap {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(110, 231, 183, 0.22);
  color: #d1fae5;
  font-size: 13px; font-weight: 600;
}
.mcl-ai-questions { margin-top: 30px; }
.mcl-ai-questions-label {
  display: block;
  font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  color: #6ee7a8; margin-bottom: 12px;
}
.mcl-ai-questions ul { list-style: none; display: flex; flex-direction: column; gap: 9px; }
.mcl-ai-questions li {
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e8fbf1;
  font-size: 14px; font-weight: 500; font-style: italic;
}
.mcl-mock-ai {
  background: #0a3a25;
  border: 1px solid rgba(110, 231, 183, 0.18);
  box-shadow: 0 36px 80px rgba(0, 0, 0, 0.4);
  animation: mclFloatY 7s ease-in-out infinite;
}
.mcl-mock-bar-ai { background: #08301e; border-bottom-color: rgba(110, 231, 183, 0.12); }
.mcl-mock-bar-ai .mcl-mock-bar-title { color: #a7f3cf; margin-left: 0; }
.mcl-ai-avatar {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9px;
  background: linear-gradient(135deg, #00a63f, #34d399);
  color: #fff;
}
.mcl-ai-chat { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.mcl-bubble {
  max-width: 86%;
  padding: 13px 16px;
  border-radius: 16px;
  font-size: 14px; line-height: 1.55;
}
.mcl-bubble-user {
  align-self: flex-end;
  background: linear-gradient(135deg, #00a63f, #06b366);
  color: #fff; font-weight: 600;
  border-bottom-right-radius: 4px;
}
.mcl-bubble-ai {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(110, 231, 183, 0.16);
  color: #e8fbf1;
  border-bottom-left-radius: 4px;
  width: 100%;
}
.mcl-bubble-ai strong { color: #6ee7a8; }
.mcl-bubble-stats { margin-top: 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mcl-bubble-stats > div {
  padding: 10px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.05);
  text-align: center;
}
.mcl-stat-val { display: block; font-size: 18px; font-weight: 800; color: #fff; }
.mcl-stat-lbl { display: block; font-size: 11px; color: #9fd9bd; margin-top: 2px; }
.mcl-mini-bars { margin-top: 14px; display: flex; align-items: flex-end; gap: 7px; height: 60px; }
.mcl-mini-bars span {
  flex: 1;
  border-radius: 5px 5px 2px 2px;
  background: linear-gradient(180deg, #6ee7a8, #00a63f);
  animation: mclGrow 1s ease forwards;
  transform-origin: bottom;
}
.mcl-bubble-insight {
  margin-top: 14px;
  display: flex; align-items: flex-start; gap: 7px;
  padding-top: 12px;
  border-top: 1px solid rgba(110, 231, 183, 0.14);
  font-size: 13px; color: #c6f6dd; font-weight: 500;
}
.mcl-bubble-insight svg { flex-shrink: 0; margin-top: 2px; color: #6ee7a8; }

/* ─── Communication ───────────────────────────────────── */
.mcl-comm { background: #fff; }
.mcl-comm-grid {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 48px;
  align-items: center;
  max-width: 1000px;
  margin: 0 auto;
}
.mcl-flow { display: flex; flex-direction: column; gap: 6px; }
.mcl-flow-item { display: flex; flex-direction: column; align-items: stretch; }
.mcl-flow-node {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  background: #f6fbf8;
  border: 1px solid rgba(15, 118, 75, 0.12);
}
.mcl-flow-ic {
  flex-shrink: 0;
  width: 42px; height: 42px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 11px;
  background: linear-gradient(135deg, #00a63f, #34d399);
  color: #fff;
}
.mcl-flow-node strong { display: block; font-size: 15px; font-weight: 800; color: #0b1f17; }
.mcl-flow-node span { font-size: 12.5px; color: #5a6b62; }
.mcl-flow-arrow {
  align-self: center;
  display: flex; align-items: center; justify-content: center;
  color: #00a63f; height: 26px;
}
.mcl-comm-examples { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.mcl-msg {
  padding: 16px 18px;
  border-radius: 16px;
  background: #f0faf4;
  border: 1px solid rgba(0, 166, 63, 0.16);
  position: relative;
}
.mcl-msg-tag {
  display: inline-block;
  font-size: 11px; font-weight: 800; letter-spacing: 0.03em;
  color: #00863a; margin-bottom: 8px;
  text-transform: uppercase;
}
.mcl-msg p { font-size: 13.5px; line-height: 1.5; color: #2f4a3c; font-weight: 500; }

/* ─── Roles ───────────────────────────────────────────── */
.mcl-roles { background: #f6fbf8; }

/* ─── How it works ────────────────────────────────────── */
.mcl-how { background: #fff; }
.mcl-steps {
  list-style: none;
  max-width: 780px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  counter-reset: step;
}
.mcl-step {
  display: flex;
  align-items: flex-start;
  gap: 22px;
  padding: 24px;
  border-radius: 16px;
  transition: background .2s ease;
}
.mcl-step:hover { background: #f6fbf8; }
.mcl-step-num {
  flex-shrink: 0;
  font-size: 22px;
  font-weight: 800;
  color: #00a63f;
  width: 54px; height: 54px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 14px;
  background: rgba(0, 166, 63, 0.09);
}
.mcl-step-copy h3 { font-size: 18px; font-weight: 800; color: #0b1f17; }
.mcl-step-copy p { margin-top: 6px; font-size: 14.5px; line-height: 1.6; color: #51635a; font-weight: 500; }

/* ─── Future ──────────────────────────────────────────── */
.mcl-future { background: #f6fbf8; }
.mcl-card-future { background: #fff; }

/* ─── Final CTA ───────────────────────────────────────── */
.mcl-final { background: #fff; padding-bottom: 110px; }
.mcl-final-card {
  position: relative;
  overflow: hidden;
  max-width: 940px;
  margin: 0 auto;
  text-align: center;
  padding: 72px 40px;
  border-radius: 28px;
  background: radial-gradient(circle at 50% 0%, #0d4a30 0, #07351f 60%), #062a19;
  box-shadow: 0 40px 90px rgba(7, 51, 33, 0.28);
}
.mcl-final-glow {
  position: absolute;
  top: -120px; left: 50%;
  width: 560px; height: 560px;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(52, 211, 153, 0.22), transparent 62%);
  pointer-events: none;
}
.mcl-final-title {
  position: relative;
  font-size: clamp(28px, 3.6vw, 42px);
  line-height: 1.12;
  font-weight: 800;
  color: #f0fdf6;
  letter-spacing: -0.02em;
}
.mcl-final-text {
  position: relative;
  margin: 20px auto 32px;
  max-width: 560px;
  font-size: 17px;
  line-height: 1.6;
  color: rgba(220, 252, 231, 0.82);
  font-weight: 500;
}
.mcl-final .mcl-btn-primary { position: relative; }

/* ─── Footer ──────────────────────────────────────────── */
.mcl-footer { background: #062a19; color: #d1fae5; }
.mcl-footer-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  padding-top: 56px;
  padding-bottom: 40px;
  flex-wrap: wrap;
}
.mcl-footer-logo { display: flex; align-items: center; gap: 11px; }
.mcl-footer-logo img { width: 36px; height: 36px; object-fit: contain; }
.mcl-footer-logo span { font-size: 20px; font-weight: 800; color: #fff; }
.mcl-footer-brand p { margin-top: 12px; font-size: 14px; color: #9fd9bd; max-width: 280px; line-height: 1.5; }
.mcl-footer-nav { display: flex; flex-wrap: wrap; gap: 8px 24px; }
.mcl-footer-nav button {
  background: transparent; border: 0;
  color: #c6f6dd; font-size: 14px; font-weight: 600;
  padding: 4px 0;
  transition: color .15s ease;
}
.mcl-footer-nav button:hover { color: #fff; }
.mcl-footer-bottom {
  border-top: 1px solid rgba(110, 231, 183, 0.14);
  padding: 20px 0;
  font-size: 13px;
  color: #7fc6a4;
}

/* ─── Animations ──────────────────────────────────────── */
@keyframes mclFloatY {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes mclGrow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

/* ─── Responsive ──────────────────────────────────────── */
@media (max-width: 1024px) {
  .mcl-hero-inner { grid-template-columns: 1fr; gap: 64px; }
  .mcl-hero-visual { max-width: 540px; margin: 0 auto; width: 100%; }
  .mcl-ai-inner { grid-template-columns: 1fr; gap: 44px; }
  .mcl-comm-grid { grid-template-columns: 1fr; gap: 36px; max-width: 620px; }
  .mcl-grid-4 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 860px) {
  .mcl-nav-links { display: none; }
  .mcl-nav-actions .mcl-btn-primary { display: none; }
  .mcl-nav-toggle { display: flex; }
  .mcl-nav-mobile { display: flex; }
  .mcl-section { padding: 72px 0; }
  .mcl-grid-3 { grid-template-columns: 1fr; }
  .mcl-compare { grid-template-columns: 1fr; }
  .mcl-compare-arrow { transform: rotate(90deg); justify-self: center; }
}

@media (max-width: 560px) {
  .mcl-container { padding: 0 20px; }
  .mcl-grid-4 { grid-template-columns: 1fr; }
  .mcl-comm-examples { grid-template-columns: 1fr; }
  .mcl-float { display: none; }
  .mcl-hero-actions .mcl-btn { width: 100%; }
  .mcl-final-card { padding: 48px 24px; }
  .mcl-step { padding: 16px; gap: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .mcl-root { scroll-behavior: auto; }
  .mcl-mock-dash, .mcl-mock-ai, .mcl-float-ai, .mcl-float-notify, .mcl-bar, .mcl-mini-bars span { animation: none; }
}
`;
