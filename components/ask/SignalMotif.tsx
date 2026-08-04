'use client';

import { useEffect, useId, useRef } from 'react';

export type SignalState = 'idle' | 'hover' | 'thinking' | 'open';
export type SignalStage = 'received' | 'generating' | null;

interface SignalMotifProps {
  size: number;
  state: SignalState;
  stage?: SignalStage;
  reducedMotion: boolean;
}

/** Squircle silhouette (superellipse, n=4) in a 64x64 box. Distinct from the orb and pill shapes rejected for this mark. */
const SQUIRCLE_PATH =
  'M62,32 L61.87,42.84 L61.48,47.26 L60.84,50.56 L59.92,53.21 L58.72,55.41 L57.23,57.23 L55.41,58.72 ' +
  'L53.21,59.92 L50.56,60.84 L47.26,61.48 L42.84,61.87 L32,62 L21.16,61.87 L16.74,61.48 L13.44,60.84 ' +
  'L10.79,59.92 L8.59,58.72 L6.77,57.23 L5.28,55.41 L4.08,53.21 L3.16,50.56 L2.52,47.26 L2.13,42.84 ' +
  'L2,32 L2.13,21.16 L2.52,16.74 L3.16,13.44 L4.08,10.79 L5.28,8.59 L6.77,6.77 L8.59,5.28 L10.79,4.08 ' +
  'L13.44,3.16 L16.74,2.52 L21.16,2.13 L32,2 L42.84,2.13 L47.26,2.52 L50.56,3.16 L53.21,4.08 L55.41,5.28 ' +
  'L57.23,6.77 L58.72,8.59 L59.92,10.79 L60.84,13.44 L61.48,16.74 L61.87,21.16 Z';

const CX = 32;
const CY = 32;
const RINGS = [10, 17];
const SPOKE_R = 22;
const ORBIT_R = 20;

/** Idle target angular velocity, radians/sec, per visible state (before a thinking stage overrides it). */
const BASE_VELOCITY: Record<SignalState, number> = {
  idle: 0.2,
  hover: 0.55,
  open: 0.25,
  thinking: 0.55,
};

/** Thinking overrides the state-based velocity: the stage transition is the accelerating-orbit moment. */
const STAGE_VELOCITY: Record<Exclude<SignalStage, null>, number> = {
  received: 1.6,
  generating: 5.4,
};

function targetVelocity(state: SignalState, stage: SignalStage): number {
  if (state === 'thinking' && stage) return STAGE_VELOCITY[stage];
  return BASE_VELOCITY[state];
}

function point(angleRad: number, radius: number): { x: number; y: number } {
  return { x: CX + Math.cos(angleRad) * radius, y: CY + Math.sin(angleRad) * radius };
}

/**
 * Rotates the orbit group via a ref-driven rAF loop, velocity lerped toward its target so the
 * accelerating sweep reads as continuous spin-up rather than a snapped animation-duration change.
 */
function useOrbitRotation(rotorRef: React.RefObject<SVGGElement | null>, state: SignalState, stage: SignalStage, disabled: boolean) {
  useEffect(() => {
    if (disabled) return;
    const rotor = rotorRef.current;
    if (!rotor) return;

    let angle = 0;
    let velocity = BASE_VELOCITY.idle;
    let lastTime = performance.now();
    let rafId: number;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const target = targetVelocity(state, stage);
      velocity += (target - velocity) * Math.min(dt * 2.5, 1);
      angle += velocity * dt;

      rotor.style.transform = `rotate(${angle}rad)`;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [rotorRef, state, stage, disabled]);
}

/**
 * The Signal node: a squircle radar mark derived from `AthleticRadar`'s rings, spokes, and
 * cyan/indigo axis dots. The orbiting sweep accelerates while `stage` moves from received to
 * generating; under reduced motion the sweep never rotates and thinking reads as a pulse instead.
 */
export default function SignalMotif({ size, state, stage = null, reducedMotion }: SignalMotifProps) {
  const rotorRef = useRef<SVGGElement | null>(null);
  const uid = useId();
  const thinking = state === 'thinking';

  useOrbitRotation(rotorRef, state, stage, reducedMotion);

  const spokeAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  const glowId = `signal-glow-${uid}`;
  const bgId = `signal-bg-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={reducedMotion && thinking ? 'signal-motif signal-motif-pulse' : 'signal-motif'}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={bgId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#141a3d" />
          <stop offset="100%" stopColor="#0a0e27" />
        </radialGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d={SQUIRCLE_PATH}
        fill={`url(#${bgId})`}
        stroke={thinking ? 'rgba(0,217,255,0.55)' : 'rgba(0,217,255,0.25)'}
        strokeWidth="1.25"
      />

      {RINGS.map((r) => (
        <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(0,217,255,0.14)" strokeWidth="1" />
      ))}

      {spokeAngles.map((angle) => {
        const p = point(angle, SPOKE_R);
        return <line key={angle} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(0,217,255,0.16)" strokeWidth="1" />;
      })}

      <g ref={rotorRef} style={{ transformOrigin: '32px 32px' }}>
        <path
          d={`M${CX},${CY} L${point(-0.42, ORBIT_R + 2).x},${point(-0.42, ORBIT_R + 2).y} A${ORBIT_R + 2},${ORBIT_R + 2} 0 0 1 ${point(0.42, ORBIT_R + 2).x},${point(0.42, ORBIT_R + 2).y} Z`}
          fill="rgba(0,217,255,0.22)"
        />
        <circle cx={point(0, ORBIT_R).x} cy={point(0, ORBIT_R).y} r={thinking ? 3.2 : 2.6} fill="#00d9ff" filter={`url(#${glowId})`} />
        <circle cx={point(Math.PI, ORBIT_R - 4).x} cy={point(Math.PI, ORBIT_R - 4).y} r={2} fill="#6366f1" opacity={0.85} />
      </g>

      <circle cx={CX} cy={CY} r={thinking ? 3.4 : 2.6} fill="#00d9ff" filter={`url(#${glowId})`} className="signal-motif-center" />
    </svg>
  );
}
