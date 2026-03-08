'use client';

import { useEffect, useRef } from 'react';

// A runner silhouette defined as normalized [x,y] points (0–1 range)
// These trace a simplified sprinting figure
const RUNNER_SHAPE: [number, number][] = [
  // Head
  [0.50, 0.08],
  // Torso
  [0.50, 0.18], [0.48, 0.28], [0.46, 0.38],
  // Left arm (forward)
  [0.40, 0.22], [0.32, 0.30], [0.26, 0.38],
  // Right arm (back)
  [0.56, 0.24], [0.64, 0.32], [0.70, 0.28],
  // Left leg (forward stride)
  [0.44, 0.48], [0.38, 0.60], [0.32, 0.72], [0.28, 0.84], [0.26, 0.96],
  // Right leg (push-off)
  [0.50, 0.50], [0.56, 0.62], [0.62, 0.74], [0.68, 0.82], [0.72, 0.70],
  // Hip area
  [0.47, 0.43], [0.53, 0.44],
];

// Circuit board waypoints (scattered nodes)
const makeCircuitPoints = (count: number): [number, number][] =>
  Array.from({ length: count }, () => [Math.random(), Math.random()] as [number, number]);

type Particle = {
  x: number; y: number;
  tx: number; ty: number; // target
  vx: number; vy: number;
  size: number;
  color: string;
  alpha: number;
};

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const PARTICLE_COUNT = 120;
    // Phases: 0=circuit scatter, 1=form runner, 2=runner holds, 3=dissolve sprint
    let phase = 0;
    let phaseTimer = 0;

    const circuitPts = makeCircuitPoints(PARTICLE_COUNT);

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const [rx, ry] = circuitPts[i];
      return {
        x: rx * W,
        y: ry * H,
        tx: rx * W,
        ty: ry * H,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: 1.5 + Math.random() * 2,
        color: Math.random() > 0.4 ? '#00d9ff' : '#6366f1',
        alpha: 0.3 + Math.random() * 0.5,
      };
    });

    // Circuit connections (pairs of particle indices)
    const connections: [number, number][] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dx = circuitPts[i][0] - circuitPts[j][0];
        const dy = circuitPts[i][1] - circuitPts[j][1];
        if (Math.sqrt(dx * dx + dy * dy) < 0.12) {
          connections.push([i, j]);
        }
      }
    }

    const setTargetsCircuit = () => {
      particles.forEach((p, i) => {
        const [rx, ry] = circuitPts[i];
        p.tx = rx * W;
        p.ty = ry * H;
      });
    };

    // Scale runner shape to canvas, centered
    const runnerPadX = W * 0.28;
    const runnerPadY = H * 0.04;
    const runnerW = W * 0.44;
    const runnerH = H * 0.92;

    const setTargetsRunner = () => {
      particles.forEach((p, i) => {
        const si = i % RUNNER_SHAPE.length;
        const [rx, ry] = RUNNER_SHAPE[si];
        // Add small random offset so multiple particles cluster around each point
        p.tx = runnerPadX + rx * runnerW + (Math.random() - 0.5) * 14;
        p.ty = runnerPadY + ry * runnerH + (Math.random() - 0.5) * 14;
      });
    };

    const setTargetsSprint = () => {
      // Particles fly rightward off-screen
      particles.forEach((p) => {
        p.tx = W + 60 + Math.random() * 200;
        p.ty = p.y + (Math.random() - 0.5) * 40;
        p.vx = 3 + Math.random() * 5;
      });
    };

    setTargetsCircuit();

    let rafId: number;

    const animate = () => {
      phaseTimer++;

      // Phase transitions
      if (phase === 0 && phaseTimer > 140) { phase = 1; phaseTimer = 0; setTargetsRunner(); }
      if (phase === 1 && phaseTimer > 160) { phase = 2; phaseTimer = 0; }
      if (phase === 2 && phaseTimer > 120) { phase = 3; phaseTimer = 0; setTargetsSprint(); }
      if (phase === 3 && phaseTimer > 90)  {
        phase = 0; phaseTimer = 0;
        // Reset positions to right side for re-entry
        particles.forEach((p, i) => {
          const [, ry] = circuitPts[i];
          p.x = -20 - Math.random() * 40;
          p.y = ry * H;
          p.vx = 0; p.vy = 0;
        });
        setTargetsCircuit();
      }

      ctx.fillStyle = 'rgba(10,14,39,0.25)';
      ctx.fillRect(0, 0, W, H);

      // Draw circuit connections in phase 0 / 1
      if (phase === 0 || phase === 1) {
        const opacity = phase === 0
          ? Math.min(1, phaseTimer / 60) * 0.25
          : Math.max(0, 1 - phaseTimer / 80) * 0.25;

        connections.slice(0, 80).forEach(([a, b]) => {
          const pa = particles[a]; const pb = particles[b];
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          // Right-angle circuit routing
          ctx.lineTo(pa.x, pb.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.strokeStyle = `rgba(99,102,241,${opacity})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });
      }

      // Update + draw particles
      particles.forEach((p) => {
        const ease = phase === 3 ? 0.08 : 0.04;
        p.vx += (p.tx - p.x) * ease;
        p.vy += (p.ty - p.y) * ease;
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x += p.vx;
        p.y += p.vy;

        // Speed-based stretch (motion blur dot → line)
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 2 && phase === 3) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4);
          ctx.strokeStyle = `rgba(0,217,255,${p.alpha * 0.6})`;
          ctx.lineWidth = p.size * 0.6;
          ctx.stroke();
        } else {
          // Glow
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
          const hex = p.color.replace('#', '');
          const pr = parseInt(hex.slice(0, 2), 16);
          const pg = parseInt(hex.slice(2, 4), 16);
          const pb2 = parseInt(hex.slice(4, 6), 16);
          glow.addColorStop(0, `rgba(${pr},${pg},${pb2},${p.alpha * 0.4})`);
          glow.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      rafId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={200}
      className="w-full max-w-2xl rounded-lg"
      style={{
        border: '1px solid rgba(0,217,255,0.1)',
        background: 'rgba(10,14,39,0.7)',
        filter: 'drop-shadow(0 0 24px rgba(0,217,255,0.1))',
      }}
    />
  );
}
