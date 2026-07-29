
import { Mail, ExternalLink } from 'lucide-react';

/* ─── Hero SVG: Slack DM Thread Schematic ────────────────────────────────── */
function SlackDigestVisual() {
  return (
    <svg viewBox="0 0 900 440" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="900" height="440" fill="#080c1f" />

      {/* Slack window chrome */}
      <rect width="900" height="36" fill="#0d1230" />
      <circle cx="18" cy="18" r="5" fill="rgba(255,80,80,0.4)" />
      <circle cx="34" cy="18" r="5" fill="rgba(255,190,0,0.3)" />
      <circle cx="50" cy="18" r="5" fill="rgba(0,200,80,0.3)" />
      <text x="450" y="23" textAnchor="middle" fontSize="11" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Slack — Direct Messages</text>

      {/* Sidebar */}
      <rect x="0" y="36" width="180" height="404" fill="#0b0f26" />
      <rect x="180" y="36" width="1" height="404" fill="rgba(99,102,241,0.12)" />

      {/* Sidebar heading */}
      <text x="16" y="62" fontSize="9" fill="rgba(99,102,241,0.5)" fontFamily="monospace" letterSpacing="2">DIRECT MESSAGES</text>

      {/* DM list */}
      <rect x="4" y="72" width="172" height="24" rx="3" fill="rgba(99,102,241,0.1)" />
      <rect x="4" y="72" width="2" height="24" rx="1" fill="#6366f1" />
      <circle cx="22" cy="84" r="8" fill="rgba(99,102,241,0.4)" />
      <text x="22" y="88" textAnchor="middle" fontSize="7" fill="rgba(99,102,241,0.9)" fontFamily="monospace">N</text>
      <text x="36" y="88" fontSize="10" fill="rgba(99,102,241,0.9)" fontFamily="monospace">Noiseless</text>
      <circle cx="164" cy="84" r="7" fill="rgba(99,102,241,0.8)" />
      <text x="164" y="88" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="monospace">3</text>

      {['Slackbot', 'Team Updates'].map((name, i) => (
        <g key={name}>
          <circle cx="22" cy={110 + i * 26} r="8" fill="rgba(245,245,245,0.06)" />
          <text x="36" y={114 + i * 26} fontSize="10" fill="rgba(245,245,245,0.3)" fontFamily="monospace">{name}</text>
        </g>
      ))}

      {/* Sidebar divider */}
      <rect x="12" y="175" width="156" height="1" fill="rgba(99,102,241,0.08)" />
      <text x="16" y="197" fontSize="9" fill="rgba(99,102,241,0.5)" fontFamily="monospace" letterSpacing="2">COMMANDS</text>
      {['/discover', '/stats', '/run-stats'].map((cmd, i) => (
        <text key={cmd} x="16" y={217 + i * 20} fontSize="9" fill="rgba(245,245,245,0.3)" fontFamily="monospace">{cmd}</text>
      ))}

      {/* Main content area — DM conversation */}
      <rect x="181" y="36" width="719" height="34" fill="#0a0e27" />
      <rect x="181" y="69" width="719" height="1" fill="rgba(99,102,241,0.08)" />
      <circle cx="200" cy="53" r="10" fill="rgba(99,102,241,0.3)" />
      <text x="200" y="57" textAnchor="middle" fontSize="8" fill="rgba(99,102,241,0.9)" fontFamily="monospace">N</text>
      <text x="216" y="57" fontSize="12" fill="rgba(245,245,245,0.6)" fontFamily="monospace" fontWeight="bold">Noiseless</text>

      {/* ── Parent digest message ── */}
      <circle cx="210" cy="95" r="12" fill="rgba(99,102,241,0.35)" />
      <text x="210" y="99" textAnchor="middle" fontSize="9" fill="rgba(99,102,241,0.9)" fontFamily="monospace">N</text>
      <text x="228" y="92" fontSize="10" fill="rgba(99,102,241,0.8)" fontFamily="monospace" fontWeight="bold">Noiseless</text>
      <text x="310" y="92" fontSize="8" fill="rgba(245,245,245,0.2)" fontFamily="monospace">12:30 PM</text>

      {/* Header block */}
      <text x="228" y="110" fontSize="11" fill="rgba(245,245,245,0.7)" fontFamily="monospace" fontWeight="bold">Discovery Digest — Jul 28, 2026</text>

      {/* Persona summary */}
      <text x="228" y="128" fontSize="8" fill="rgba(245,245,245,0.4)" fontFamily="monospace">🧭 Based on your profile, we searched for posts about AI agents,</text>
      <text x="228" y="140" fontSize="8" fill="rgba(245,245,245,0.4)" fontFamily="monospace">distributed systems, and production engineering...</text>

      {/* Results summary */}
      <text x="228" y="158" fontSize="9" fill="rgba(245,245,245,0.55)" fontFamily="monospace">Found 8 items from 12 queries. Review each item in the thread below.</text>

      {/* Context line */}
      <text x="228" y="174" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">Run #47 | Jul 28 12:30 PM | /discover</text>

      {/* Thread indicator */}
      <rect x="228" y="184" width="200" height="18" rx="3" fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
      <text x="238" y="196" fontSize="8" fill="rgba(99,102,241,0.7)" fontFamily="monospace">💬 8 replies</text>

      {/* ── Thread panel (right side) ── */}
      <rect x="520" y="70" width="380" height="370" fill="#0a0f28" />
      <rect x="520" y="70" width="1" height="370" fill="rgba(99,102,241,0.12)" />

      {/* Thread header */}
      <rect x="520" y="70" width="380" height="30" fill="#0d1230" />
      <text x="536" y="90" fontSize="10" fill="rgba(245,245,245,0.6)" fontFamily="monospace" fontWeight="bold">Thread</text>
      <text x="880" y="90" textAnchor="end" fontSize="8" fill="rgba(245,245,245,0.2)" fontFamily="monospace">8 replies</text>

      {/* ── Thread item 1 ── */}
      <circle cx="540" cy="120" r="10" fill="rgba(99,102,241,0.3)" />
      <text x="540" y="124" textAnchor="middle" fontSize="8" fill="rgba(99,102,241,0.9)" fontFamily="monospace">N</text>
      <text x="556" y="117" fontSize="9" fill="rgba(99,102,241,0.8)" fontFamily="monospace" fontWeight="bold">Noiseless</text>
      <text x="630" y="117" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">12:30 PM</text>

      {/* Content: linked author + score */}
      <text x="556" y="133" fontSize="9" fill="rgba(99,102,241,0.7)" fontFamily="monospace">@swyx</text>
      <text x="595" y="133" fontSize="9" fill="rgba(245,245,245,0.45)" fontFamily="monospace">(Topic Discussion) | Score:</text>
      <text x="790" y="133" fontSize="9" fill="rgba(99,102,241,0.9)" fontFamily="monospace" fontWeight="bold">8/10</text>

      {/* Quoted post text */}
      <rect x="556" y="140" width="3" height="24" rx="1" fill="rgba(99,102,241,0.3)" />
      <text x="566" y="153" fontSize="8" fill="rgba(245,245,245,0.4)" fontFamily="monospace">Building LangGraph agents in production is tricky.</text>
      <text x="566" y="163" fontSize="8" fill="rgba(245,245,245,0.4)" fontFamily="monospace">Here&apos;s what I learned about state management...</text>

      {/* Context line */}
      <text x="556" y="178" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">💡 Topic Discussion | Jul 28 · 3h ago</text>

      {/* Action buttons */}
      <rect x="556" y="186" width="44" height="18" rx="3" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="1" />
      <text x="578" y="198" textAnchor="middle" fontSize="8" fill="rgba(34,197,94,0.9)" fontFamily="monospace">Like</text>
      <rect x="606" y="186" width="58" height="18" rx="3" fill="rgba(255,80,80,0.1)" stroke="rgba(255,80,80,0.3)" strokeWidth="1" />
      <text x="635" y="198" textAnchor="middle" fontSize="8" fill="rgba(255,80,80,0.7)" fontFamily="monospace">Dislike</text>
      <rect x="670" y="186" width="44" height="18" rx="3" fill="rgba(245,245,245,0.04)" stroke="rgba(245,245,245,0.1)" strokeWidth="1" />
      <text x="692" y="198" textAnchor="middle" fontSize="8" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Skip</text>

      {/* Divider */}
      <line x1="536" y1="214" x2="884" y2="214" stroke="rgba(99,102,241,0.06)" strokeWidth="1" />

      {/* ── Thread item 2 (already acted on) ── */}
      <circle cx="540" cy="234" r="10" fill="rgba(99,102,241,0.3)" />
      <text x="540" y="238" textAnchor="middle" fontSize="8" fill="rgba(99,102,241,0.9)" fontFamily="monospace">N</text>
      <text x="556" y="231" fontSize="9" fill="rgba(99,102,241,0.8)" fontFamily="monospace" fontWeight="bold">Noiseless</text>
      <text x="630" y="231" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">12:30 PM</text>

      <text x="556" y="247" fontSize="9" fill="rgba(99,102,241,0.7)" fontFamily="monospace">@karpathy</text>
      <text x="620" y="247" fontSize="9" fill="rgba(245,245,245,0.45)" fontFamily="monospace">(Expertise Match) | Score:</text>
      <text x="810" y="247" fontSize="9" fill="rgba(99,102,241,0.9)" fontFamily="monospace" fontWeight="bold">9/10</text>

      <rect x="556" y="254" width="3" height="24" rx="1" fill="rgba(99,102,241,0.3)" />
      <text x="566" y="267" fontSize="8" fill="rgba(245,245,245,0.4)" fontFamily="monospace">Cost control in autonomous agents is underrated.</text>
      <text x="566" y="277" fontSize="8" fill="rgba(245,245,245,0.4)" fontFamily="monospace">Per-request budgets prevent runaway spending...</text>

      <text x="556" y="292" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">🔬 Expertise Match | Jul 28 · 5h ago</text>

      {/* Already-acted button (Liked) */}
      <rect x="556" y="300" width="60" height="18" rx="3" fill="rgba(34,197,94,0.25)" stroke="rgba(34,197,94,0.5)" strokeWidth="1" />
      <text x="586" y="312" textAnchor="middle" fontSize="8" fill="rgba(34,197,94,0.9)" fontFamily="monospace">✓ Liked</text>

      {/* Divider */}
      <line x1="536" y1="328" x2="884" y2="328" stroke="rgba(99,102,241,0.06)" strokeWidth="1" />

      {/* ── Thread item 3 (lower score, still pending) ── */}
      <circle cx="540" cy="348" r="10" fill="rgba(99,102,241,0.3)" />
      <text x="540" y="352" textAnchor="middle" fontSize="8" fill="rgba(99,102,241,0.9)" fontFamily="monospace">N</text>
      <text x="556" y="345" fontSize="9" fill="rgba(99,102,241,0.8)" fontFamily="monospace" fontWeight="bold">Noiseless</text>
      <text x="630" y="345" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">12:30 PM</text>

      <text x="556" y="361" fontSize="9" fill="rgba(99,102,241,0.7)" fontFamily="monospace">@dan_abramov</text>
      <text x="644" y="361" fontSize="9" fill="rgba(245,245,245,0.45)" fontFamily="monospace">(Topic Discussion) | Score:</text>
      <text x="840" y="361" fontSize="9" fill="rgba(99,102,241,0.9)" fontFamily="monospace" fontWeight="bold">6/10</text>

      <rect x="556" y="368" width="3" height="16" rx="1" fill="rgba(99,102,241,0.3)" />
      <text x="566" y="381" fontSize="8" fill="rgba(245,245,245,0.4)" fontFamily="monospace">React Server Components mental model for...</text>

      <text x="556" y="396" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">💡 Topic Discussion | Jul 27 · 1d ago</text>

      <rect x="556" y="404" width="44" height="18" rx="3" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="1" />
      <text x="578" y="416" textAnchor="middle" fontSize="8" fill="rgba(34,197,94,0.9)" fontFamily="monospace">Like</text>
      <rect x="606" y="404" width="58" height="18" rx="3" fill="rgba(255,80,80,0.1)" stroke="rgba(255,80,80,0.3)" strokeWidth="1" />
      <text x="635" y="416" textAnchor="middle" fontSize="8" fill="rgba(255,80,80,0.7)" fontFamily="monospace">Dislike</text>
      <rect x="670" y="404" width="44" height="18" rx="3" fill="rgba(245,245,245,0.04)" stroke="rgba(245,245,245,0.1)" strokeWidth="1" />
      <text x="692" y="416" textAnchor="middle" fontSize="8" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Skip</text>
    </svg>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function NoiselessPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-primary)', minHeight: '100vh', paddingTop: '60px' }}>

      {/* ── Hero ── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 pt-16 pb-0">
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(99,102,241,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Agentic AI · Python · LangGraph
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
          <span className="flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#22c55e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
            Live
          </span>
        </div>

        <h1 className=""
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 7vw, 6.5rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.0, letterSpacing: '-0.03em', marginBottom: '1rem' }}>
          Noiseless
        </h1>
        <p className="mb-10"
          style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(1rem, 1.5vw, 1.2rem)', color: 'var(--color-text-muted)', maxWidth: '55ch', lineHeight: 1.6 }}>
          AI agent that finds high-signal conversations on X and learns from your feedback to surface better results over time.
        </p>

        {/* Hero visual */}
        <div className="relative overflow-hidden"
          style={{ borderRadius: '6px', border: '1px solid rgba(99,102,241,0.2)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.05)' }}>
          <SlackDigestVisual />
          <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--color-primary))' }} />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-24 lg:py-32">

        {/* Overview */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            01 — Overview
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20 mb-24 items-start">
          <div className="lg:sticky lg:top-28">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Finds signal in the noise. Gets smarter every time you use it.
            </h2>
          </div>
          <div className="space-y-6">
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: '1.85', color: 'var(--color-text)' }}>
              Most discovery tools either flood you with noise or require hours of manual searching. Noiseless sits in between. It profiles your expertise from multiple sources (your posts, your code, websites you provide), searches X daily for conversations where your perspective adds value, and delivers ranked results to Slack. You like, dislike, or skip each result, and that feedback shapes what surfaces next.
            </p>
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              The system runs as a scheduled daily pipeline: search, classify, rank, deliver. Each user gets an isolated profile, budget, and learning history. After delivery, feedback flows back asynchronously through Slack as users react to results over hours. The learning loop was the architectural starting point, not something grafted on after the fact.
            </p>
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              The agent gets better the more you use it. Every like, dislike, and skip feeds into preference profiles that reshape future ranking. Query strategies shift toward topics producing higher-signal results. The profile itself is built from cross-referenced evidence across sources, not self-reported claims.
            </p>
          </div>
        </div>

        {/* Hard Parts */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-secondary)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            02 — The Hard Parts
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-24">
          {[
            {
              num: '01',
              title: 'Scheduling Discovery Across Users',
              body: 'The pipeline runs on a daily schedule per user, across timezones. Each run executes search, classification, ranking, and delivery autonomously, then feedback trickles back through Slack over hours as users react to results. State survives process restarts. The pipeline owns scheduling and orchestration, Slack owns the feedback interface, and the database is the only shared state between them. Getting that boundary wrong means lost feedback or results that never learn from user behavior.',
            },
            {
              num: '02',
              title: 'Spending Real Money on Every Request',
              body: 'The agent makes API calls that cost real money: searches to find posts and LLM calls to classify, rank, and generate digests. Without hard limits, a misconfigured run could burn through a budget in minutes. Cost enforcement runs before any work begins. Per-user daily and monthly limits are checked independently. Every external action gets a durable audit entry before the call is made, so if the process crashes mid-request, there is always a record of what was attempted. This is the only responsible way to run a system that spends money on behalf of other people.',
            },
            {
              num: '03',
              title: 'Building Profiles from Noisy Sources',
              body: 'The system needs to know what you are actually an expert in to decide which conversations are worth surfacing. But the inputs are noisy: social posts mix signal with performance, repositories vary in relevance, and self-reported interests are unreliable on their own. Profile building merges signals from multiple sources with confidence scoring: your posts carry more weight for interests, your code carries more weight for technical depth. Overlapping mentions across sources reinforce each other; isolated claims get discounted. If a topic falls outside your demonstrated expertise, the system skips it entirely rather than surfacing noise.',
            },
          ].map(({ num, title, body }) => (
            <div key={num} className="p-7"
              style={{ backgroundColor: '#0d1230', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '4px' }}>
              <div className="flex items-start gap-4 mb-4">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'rgba(99,102,241,0.5)', letterSpacing: '0.1em', marginTop: '2px' }}>{num}</span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>{title}</h3>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', lineHeight: '1.75', color: 'var(--color-text-muted)' }}>{body}</p>
            </div>
          ))}
        </div>

        {/* Outcomes */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            03 — Outcomes
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-24">
          {[
            { metric: 'Minutes', label: 'Spent approving, instead of hours hunting for conversations worth joining.' },
            { metric: 'Learns', label: 'Every like, dislike, and skip makes the next digest sharper than the last.' },
            { metric: 'Capped', label: 'Daily and monthly spend limits per user, with cost visible the whole way.' },
            { metric: 'Zero', label: 'Config to write. A Slack conversation builds the profile, no forms or keyword lists.' },
          ].map(({ metric, label }) => (
            <div key={label} className="p-6"
              style={{ backgroundColor: '#0d1230', border: '1px solid rgba(99,102,241,0.1)', borderRadius: '4px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 700, color: '#6366f1', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
                {metric}
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Tech stack */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-secondary)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            04 — Stack
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(99,102,241,0.15)' }} />
        </div>

        <div className="flex flex-wrap gap-3 mb-24">
          {['Python', 'FastAPI', 'LangGraph', 'Claude', 'OpenAI Embeddings', 'PostgreSQL', 'Supabase', 'Slack Socket Mode', 'Vite', 'Railway'].map(tag => (
            <span key={tag} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.06em', color: 'rgba(99,102,241,0.7)', border: '1px solid rgba(99,102,241,0.2)', padding: '0.35rem 0.85rem', borderRadius: '2px', backgroundColor: 'rgba(99,102,241,0.05)' }}>
              {tag}
            </span>
          ))}
        </div>

        {/* What's Next */}
        <div className="mb-6 flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: 'var(--color-accent)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 600 }}>
            05 — What&apos;s Next
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(0,217,255,0.1)' }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20 mb-24 items-start">
          <div className="lg:sticky lg:top-28">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              An agent that compounds.
            </h2>
          </div>
          <div className="p-7" style={{ backgroundColor: '#0d1230', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '4px' }}>
            {[
              { title: 'Richer feedback dimensions', desc: 'Move beyond like and dislike to capture why a conversation was relevant or not, enabling more precise preference modeling over time.' },
              { title: 'Profile evolution', desc: 'Expertise profiles that adapt as your interests and skills naturally shift, instead of staying locked to the initial onboarding snapshot.' },
              { title: 'Broader discovery', desc: 'Expanding beyond X to find relevant conversations wherever your audience participates.' },
            ].map(({ title, desc }, i) => (
              <div key={i} className="flex gap-3 mb-5 last:mb-0">
                <span style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginTop: '3px', flexShrink: 0 }}>→</span>
                <div>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text)' }}>{title}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--color-text)' }}>: </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', lineHeight: 1.65, color: 'var(--color-text-muted)' }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-8"
          style={{ borderTop: '1px solid rgba(99,102,241,0.15)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            Try it, follow the project, or reach out to discuss the engineering.
          </p>
          <div className="flex flex-wrap gap-3 shrink-0">
            <a href="https://discoveryagent-production.up.railway.app/"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 transition-opacity duration-200 hover:opacity-80"
              style={{ backgroundColor: '#6366f1', color: '#fff', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '3px' }}>
              <ExternalLink size={14} />
              Try Noiseless
            </a>
            <a href="https://github.com/tnahata/twitterbot"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 transition-opacity duration-200 hover:opacity-80"
              style={{ border: '1px solid rgba(99,102,241,0.3)', color: 'rgba(99,102,241,0.8)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '3px', backgroundColor: 'transparent' }}>
              <ExternalLink size={14} />
              GitHub
            </a>
            <a href="mailto:tanishnahata2002@gmail.com?subject=Noiseless"
              className="flex items-center gap-2 px-6 py-3 transition-opacity duration-200 hover:opacity-80"
              style={{ border: '1px solid rgba(99,102,241,0.3)', color: 'rgba(99,102,241,0.8)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '3px', backgroundColor: 'transparent' }}>
              <Mail size={14} />
              Ask me about it
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
