import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 72px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            left: '-100px',
            width: '350px',
            height: '350px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 1 }}>
          <div style={{ fontSize: 56, fontWeight: 800, color: '#ffffff', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
            Tanish Nahata
          </div>
          <div style={{ fontSize: 24, color: '#94a3b8', marginTop: '8px', fontWeight: 400 }}>
            Software Engineer — AI Agents, Full-Stack, Startups
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '48px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#3b82f6' }}>3+</div>
              <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Projects Shipped</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#3b82f6' }}>20mn+</div>
              <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Tokens Burnt</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: '#3b82f6' }}>60%</div>
              <div style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Latency Reduced</div>
            </div>
          </div>
          <div style={{ fontSize: 18, color: '#475569', display: 'flex' }}>tanishnahata.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
