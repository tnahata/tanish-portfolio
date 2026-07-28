
import { Mail, ExternalLink } from 'lucide-react';

/* ─── Hero SVG: Slack Digest Schematic ───────────────────────────────────── */
function SlackDigestVisual() {
  return (
    <svg viewBox="0 0 900 440" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="900" height="440" fill="#080c1f" />

      {/* Slack window chrome */}
      <rect width="900" height="36" fill="#0d1230" />
      <circle cx="18" cy="18" r="5" fill="rgba(255,80,80,0.4)" />
      <circle cx="34" cy="18" r="5" fill="rgba(255,190,0,0.3)" />
      <circle cx="50" cy="18" r="5" fill="rgba(0,200,80,0.3)" />
      <text x="450" y="23" textAnchor="middle" fontSize="11" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Noiseless — Slack Workspace</text>

      {/* Sidebar */}
      <rect x="0" y="36" width="180" height="404" fill="#0b0f26" />
      <rect x="180" y="36" width="1" height="404" fill="rgba(99,102,241,0.12)" />

      {/* Sidebar content */}
      <text x="16" y="62" fontSize="9" fill="rgba(99,102,241,0.5)" fontFamily="monospace" letterSpacing="2">CHANNELS</text>
      {['# noiseless', '# approved', '# rejected', '# agent-logs'].map((ch, i) => {
        const active = i === 0;
        return (
          <g key={ch}>
            {active && <rect x="4" y={72 + i * 26} width="172" height="24" rx="3" fill="rgba(99,102,241,0.1)" />}
            {active && <rect x="4" y={72 + i * 26} width="2" height="24" rx="1" fill="#6366f1" />}
            <text x="16" y={88 + i * 26} fontSize="10" fill={active ? 'rgba(99,102,241,0.9)' : 'rgba(245,245,245,0.3)'} fontFamily="monospace">{ch}</text>
            {i === 0 && <circle cx="164" cy={84 + i * 26} r="7" fill="rgba(99,102,241,0.8)" />}
            {i === 0 && <text x="164" y={88 + i * 26} textAnchor="middle" fontSize="8" fill="#fff" fontFamily="monospace">3</text>}
          </g>
        );
      })}

      {/* Sidebar stats */}
      <rect x="12" y="200" width="156" height="1" fill="rgba(99,102,241,0.08)" />
      <text x="16" y="222" fontSize="9" fill="rgba(99,102,241,0.5)" fontFamily="monospace" letterSpacing="2">SESSION</text>
      {[
        { label: 'Searched', value: '142 posts', y: 240 },
        { label: 'Ranked', value: '28 relevant', y: 260 },
        { label: 'Drafted', value: '12 replies', y: 280 },
        { label: 'Cost', value: '$0.04', y: 300 },
      ].map(({ label, value, y }) => (
        <g key={label}>
          <text x="16" y={y} fontSize="8" fill="rgba(245,245,245,0.25)" fontFamily="monospace">{label}</text>
          <text x="168" y={y} textAnchor="end" fontSize="8" fill="rgba(99,102,241,0.6)" fontFamily="monospace">{value}</text>
        </g>
      ))}

      {/* Pipeline indicator */}
      <rect x="12" y="320" width="156" height="1" fill="rgba(99,102,241,0.08)" />
      <text x="16" y="342" fontSize="9" fill="rgba(99,102,241,0.5)" fontFamily="monospace" letterSpacing="2">PIPELINE</text>
      {['Search', 'Classify', 'Rank', 'Draft', 'Deliver'].map((stage, i) => {
        const done = i < 5;
        return (
          <g key={stage}>
            <circle cx="24" cy={360 + i * 18} r="4" fill={done ? 'rgba(99,102,241,0.6)' : 'rgba(245,245,245,0.1)'} />
            {done && <text x="24" y={363 + i * 18} textAnchor="middle" fontSize="6" fill="#fff" fontFamily="monospace">✓</text>}
            <text x="36" y={364 + i * 18} fontSize="8" fill={done ? 'rgba(245,245,245,0.5)' : 'rgba(245,245,245,0.2)'} fontFamily="monospace">{stage}</text>
            {i < 4 && <line x1="24" y1={364 + i * 18} x2="24" y2={356 + (i + 1) * 18} stroke="rgba(99,102,241,0.2)" strokeWidth="1" />}
          </g>
        );
      })}

      {/* Main content — digest messages */}
      <rect x="181" y="36" width="719" height="34" fill="#0a0e27" />
      <rect x="181" y="69" width="719" height="1" fill="rgba(99,102,241,0.08)" />
      <text x="200" y="58" fontSize="12" fill="rgba(245,245,245,0.6)" fontFamily="monospace" fontWeight="bold"># noiseless</text>
      <text x="780" y="58" textAnchor="end" fontSize="9" fill="rgba(245,245,245,0.2)" fontFamily="monospace">3 new items</text>

      {/* Digest item 1 */}
      <rect x="200" y="85" width="680" height="100" rx="4" fill="rgba(99,102,241,0.06)" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
      <rect x="200" y="85" width="3" height="100" rx="1" fill="rgba(99,102,241,0.6)" />
      <circle cx="222" cy="105" r="10" fill="rgba(99,102,241,0.3)" />
      <text x="222" y="109" textAnchor="middle" fontSize="9" fill="rgba(99,102,241,0.9)" fontFamily="monospace">N</text>
      <text x="240" y="102" fontSize="10" fill="rgba(99,102,241,0.8)" fontFamily="monospace" fontWeight="bold">Noiseless</text>
      <text x="330" y="102" fontSize="8" fill="rgba(245,245,245,0.2)" fontFamily="monospace">2 min ago</text>
      <text x="218" y="120" fontSize="9" fill="rgba(245,245,245,0.55)" fontFamily="monospace">@user posted about building LangGraph agents in production...</text>
      <text x="218" y="136" fontSize="8" fill="rgba(245,245,245,0.35)" fontFamily="monospace" fontStyle="italic">&quot;Interesting take — I&apos;ve been running a multi-stage pipeline with...&quot;</text>
      <text x="218" y="152" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">Topic: agentic-ai · Relevance: 0.91 · Category: expertise-match</text>

      {/* Action buttons for item 1 */}
      <rect x="218" y="160" width="70" height="20" rx="3" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="1" />
      <text x="253" y="174" textAnchor="middle" fontSize="9" fill="rgba(34,197,94,0.9)" fontFamily="monospace">Approve</text>
      <rect x="296" y="160" width="60" height="20" rx="3" fill="rgba(255,80,80,0.1)" stroke="rgba(255,80,80,0.3)" strokeWidth="1" />
      <text x="326" y="174" textAnchor="middle" fontSize="9" fill="rgba(255,80,80,0.7)" fontFamily="monospace">Reject</text>
      <rect x="364" y="160" width="50" height="20" rx="3" fill="rgba(245,245,245,0.04)" stroke="rgba(245,245,245,0.1)" strokeWidth="1" />
      <text x="389" y="174" textAnchor="middle" fontSize="9" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Edit</text>

      {/* Digest item 2 */}
      <rect x="200" y="198" width="680" height="100" rx="4" fill="rgba(99,102,241,0.06)" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
      <rect x="200" y="198" width="3" height="100" rx="1" fill="rgba(99,102,241,0.6)" />
      <circle cx="222" cy="218" r="10" fill="rgba(99,102,241,0.3)" />
      <text x="222" y="222" textAnchor="middle" fontSize="9" fill="rgba(99,102,241,0.9)" fontFamily="monospace">N</text>
      <text x="240" y="215" fontSize="10" fill="rgba(99,102,241,0.8)" fontFamily="monospace" fontWeight="bold">Noiseless</text>
      <text x="330" y="215" fontSize="8" fill="rgba(245,245,245,0.2)" fontFamily="monospace">2 min ago</text>
      <text x="218" y="233" fontSize="9" fill="rgba(245,245,245,0.55)" fontFamily="monospace">Thread about cost control patterns for autonomous agents...</text>
      <text x="218" y="249" fontSize="8" fill="rgba(245,245,245,0.35)" fontFamily="monospace" fontStyle="italic">&quot;Cost enforcement before every call is non-negotiable — I run...&quot;</text>
      <text x="218" y="265" fontSize="7" fill="rgba(245,245,245,0.2)" fontFamily="monospace">Topic: agent-reliability · Relevance: 0.87 · Category: expertise-match</text>

      <rect x="218" y="273" width="70" height="20" rx="3" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="1" />
      <text x="253" y="287" textAnchor="middle" fontSize="9" fill="rgba(34,197,94,0.9)" fontFamily="monospace">Approve</text>
      <rect x="296" y="273" width="60" height="20" rx="3" fill="rgba(255,80,80,0.1)" stroke="rgba(255,80,80,0.3)" strokeWidth="1" />
      <text x="326" y="287" textAnchor="middle" fontSize="9" fill="rgba(255,80,80,0.7)" fontFamily="monospace">Reject</text>
      <rect x="364" y="273" width="50" height="20" rx="3" fill="rgba(245,245,245,0.04)" stroke="rgba(245,245,245,0.1)" strokeWidth="1" />
      <text x="389" y="287" textAnchor="middle" fontSize="9" fill="rgba(245,245,245,0.35)" fontFamily="monospace">Edit</text>

      {/* Digest item 3 — skipped (outside expertise) */}
      <rect x="200" y="311" width="680" height="75" rx="4" fill="rgba(245,245,245,0.02)" stroke="rgba(245,245,245,0.06)" strokeWidth="1" strokeDasharray="4 3" />
      <circle cx="222" cy="331" r="10" fill="rgba(245,245,245,0.06)" />
      <text x="222" y="335" textAnchor="middle" fontSize="9" fill="rgba(245,245,245,0.2)" fontFamily="monospace">N</text>
      <text x="240" y="328" fontSize="10" fill="rgba(245,245,245,0.25)" fontFamily="monospace">Noiseless</text>
      <text x="330" y="328" fontSize="8" fill="rgba(245,245,245,0.15)" fontFamily="monospace">2 min ago</text>
      <text x="218" y="346" fontSize="9" fill="rgba(245,245,245,0.25)" fontFamily="monospace">Discussion about Kubernetes networking internals...</text>
      <text x="218" y="362" fontSize="8" fill="rgba(245,245,245,0.2)" fontFamily="monospace" fontStyle="italic">Skipped — topic outside your declared expertise</text>
      <text x="218" y="376" fontSize="7" fill="rgba(245,245,245,0.12)" fontFamily="monospace">Topic: infrastructure · Relevance: 0.32 · Category: outside-domain</text>

      {/* Bottom status */}
      <rect y="424" width="900" height="16" fill="#0a0e27" />
      <rect y="424" width="900" height="1" fill="rgba(99,102,241,0.08)" />
      <text x="200" y="435" fontSize="7" fill="rgba(245,245,245,0.25)" fontFamily="monospace">Session: 2025-07-25 · Searched: 142 · Ranked: 28 · Drafted: 12 · Skipped: 16 · Budget remaining: $0.96</text>
      <circle cx="880" cy="432" r="3" fill="#6366f1" opacity="0.7" />
      <text x="870" y="435" textAnchor="end" fontSize="7" fill="rgba(99,102,241,0.6)" fontFamily="monospace">Awaiting</text>
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
          AI agent that finds high-signal conversations on X, learns from your feedback, and never posts without your approval.
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
              Finds signal in the noise. Never posts without your say.
            </h2>
          </div>
          <div className="space-y-6">
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: '1.85', color: 'var(--color-text)' }}>
              Most engagement tools either blast generic replies or leave you to trawl feeds manually. Noiseless sits in between. It profiles your expertise from multiple sources (your posts, your code, websites you provide), searches X daily for conversations where your perspective adds value, and delivers ranked results to Slack. You review, approve or reject, and the agent posts on your behalf. Every post requires explicit approval; the system never acts on its own.
            </p>
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              The system runs as a scheduled daily pipeline: search, classify, rank, draft, deliver. Each user gets an isolated profile, budget, and learning history. Execution pauses at the approval stage and resumes asynchronously when decisions come through Slack (potentially hours later). Human-in-the-loop was the architectural starting point, not a safety feature added after the fact.
            </p>
            <p className="" style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: '1.85', color: 'var(--color-text-muted)' }}>
              The agent gets better the more you use it. Every approval, rejection, and skip feeds into preference profiles that reshape future ranking. Query strategies shift toward topics producing higher-signal results. Style traits extracted during onboarding keep drafts grounded in how you actually write, not how a language model defaults to writing.
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
              body: 'The pipeline runs on a daily schedule per user. Search, classification, ranking, and drafting execute autonomously, then the system pauses while waiting for approval decisions through Slack (potentially hours later). State survives process restarts and timezone differences. The orchestration layer handles the pause, but wiring it to an external approval surface required strict separation: the pipeline owns scheduling, Slack owns the user interface, and the database is the only shared state. Getting that boundary wrong means lost decisions or duplicate posts.',
            },
            {
              num: '02',
              title: 'Spending Real Money on Every Request',
              body: 'The agent makes API calls that cost real money: reads to find posts, writes to publish, and LLM calls to rank and draft. Without hard limits, a misconfigured run could burn through a budget in minutes. Cost enforcement runs before any work begins. Per-user daily and monthly limits are checked independently. Every external action gets a durable audit entry before the call is made, so if the process crashes mid-request, there is always a record of what was attempted. This is the only responsible way to run a system that spends money on behalf of other people.',
            },
            {
              num: '03',
              title: 'Learning Without Hallucinating Expertise',
              body: 'The model drafts replies that need to match your tone and reference your actual background, not hallucinate expertise you do not have. The ranking stage classifies each conversation against your profile, separating what you know from what you do not. If a topic falls outside your domain, the system skips it entirely rather than fabricating authority. Profile building merges signals from multiple sources with confidence scoring: your posts carry more weight for interests, your code carries more weight for technical skills. The result is a profile grounded in evidence, not self-reported claims.',
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
            { metric: '0', label: 'Posts published without explicit user approval' },
            { metric: '6', label: 'Pipeline stages orchestrated with persistent state and async resumption' },
            { metric: 'Daily', label: 'Scheduled discovery runs per user, adapted to timezone' },
            { metric: 'Adaptive', label: 'Ranking sharpens with every approve, reject, and skip' },
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
              { title: 'Engagement-driven learning', desc: 'Track how approved posts perform after publication. The current loop learns from your decisions. The next version will learn from audience response.' },
              { title: 'Voice evolution', desc: 'Style profiles that adapt as your writing naturally changes over time, instead of staying locked to the initial onboarding snapshot.' },
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
            Follow the project or reach out to discuss the engineering.
          </p>
          <div className="flex gap-3 shrink-0">
            <a href="https://github.com/tnahata/twitterbot"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 transition-opacity duration-200 hover:opacity-80"
              style={{ backgroundColor: '#6366f1', color: '#fff', fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '3px' }}>
              <ExternalLink size={14} />
              View Project
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
