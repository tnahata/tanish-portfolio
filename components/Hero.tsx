'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Staggered animation: content -> visualizer
    const elements = containerRef.current?.querySelectorAll('[data-animate]');
    if (!elements) return;

    elements.forEach((el, idx) => {
      (el as HTMLElement).style.animation = `slideInUp 0.8s ease-out ${idx * 0.15}s both`;
    });
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative w-full min-h-screen overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      {/* Content wrapper - center with mx-auto */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 sm:px-8 md:px-12 flex flex-col items-center justify-center">
        {/* H1: Name */}
        <h1
          data-animate
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-tight text-center mb-4 sm:mb-6 w-full"
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Tanish Nahata
        </h1>

        {/* Subtitle: Role + Interests */}
        <p
          data-animate
          className="text-sm sm:text-base md:text-lg text-center mb-6 sm:mb-8 font-medium tracking-wider w-full"
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.05em',
          }}
        >
          Software Engineer · AI Agent Builder · Electronic Music Lover · Athlete
        </p>

        {/* Tagline */}
        <p
          data-animate
          className="text-xs sm:text-sm md:text-base leading-relaxed mb-8 sm:mb-12 text-center w-full"
          style={{
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-body)',
            lineHeight: '1.8',
          }}
        >
          I design systems that scale, build AI agents that reason deeply, and find rhythm in
          code and music. Obsessed with optimization—both algorithmically and athletically.
          Currently exploring the intersection of agentic workflows and emergent intelligence.
        </p>

        {/* CTAs: Centered, Consistent */}
        <div
          data-animate
          className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center justify-center mb-12 sm:mb-16 w-full"
        >
          {/* Primary CTA: cyan background */}
          <Link
            href="#projects"
            className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/50 active:scale-95 text-center"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              letterSpacing: '0.05em',
            }}
          >
            View My Work
          </Link>

          {/* Secondary CTA: cyan border */}
          <Link
            href="#contact"
            className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 rounded-lg font-semibold transition-all duration-300 active:scale-95 text-center"
            style={{
              border: '2px solid var(--color-accent)',
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              fontSize: '0.9rem',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent)';
              e.currentTarget.style.color = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-accent)';
            }}
          >
            Get In Touch
          </Link>
        </div>

        {/* Frequency Visualizer */}
        <div data-animate className="w-full flex justify-center items-center pointer-events-none">
          <FrequencyVisualizer />
        </div>
      </div>
    </section>
  );
}

/**
 * FrequencyVisualizer: Animated frequency bars + heartbeat rhythm
 * Combines electronic music aesthetics with athletic pulse
 * Evokes both a music visualizer and an EKG/heartbeat monitor
 */
function FrequencyVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barCount = 24;
    const barWidth = width / (barCount * 1.5);
    const barGap = barWidth * 0.5;

    // Frequency data (simulated audio spectrum)
    const frequencies = Array(barCount).fill(0);

    // Heartbeat pattern: ba-dum (two quick pulses, then silence)
    // Tempo: ~120 BPM = 0.5s per beat, heartbeat pattern
    const getHeartbeatEnvelope = (time: number) => {
      const beatCycle = (time % 1000) / 1000; // 1 second cycle
      // Heartbeat: pulse at 0-0.15s, small pulse at 0.3-0.45s
      if (beatCycle < 0.15) {
        return Math.sin(beatCycle * Math.PI / 0.15) * 0.7; // Main pulse
      } else if (beatCycle > 0.3 && beatCycle < 0.45) {
        return Math.sin((beatCycle - 0.3) * Math.PI / 0.15) * 0.4; // Secondary pulse
      }
      return 0;
    };

    const animate = () => {
      const now = Date.now();
      const heartbeat = getHeartbeatEnvelope(now);

      // Update frequencies with noise + heartbeat envelope
      frequencies.forEach((_, i) => {
        const targetHeight = (Math.random() * 0.4 + 0.1 + Math.abs(Math.sin((i + now * 0.0005) * 0.1)) * 0.3) * (0.6 + heartbeat * 0.4);
        frequencies[i] += (targetHeight - frequencies[i]) * 0.12;
      });

      // Clear canvas
      ctx.fillStyle = 'rgba(10, 14, 39, 1)';
      ctx.fillRect(0, 0, width, height);

      // Draw bars
      frequencies.forEach((height, i) => {
        const x = i * (barWidth + barGap) + barGap;
        const barHeight = height * (height * 150);

        // Gradient: cyan to indigo based on frequency
        const gradient = ctx.createLinearGradient(0, height * 150, 0, 0);
        gradient.addColorStop(0, 'rgba(0, 217, 255, 0.1)');
        gradient.addColorStop(0.5, 'rgba(0, 217, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.8)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height * 150 - barHeight, barWidth * 0.8, barHeight);

        // Glow effect on peaks
        if (height > 0.5) {
          ctx.fillStyle = `rgba(0, 217, 255, ${(height - 0.5) * 0.4})`;
          ctx.fillRect(x - 2, height * 150 - barHeight - 4, barWidth * 0.8 + 4, 8);
        }
      });

      // Draw center line (like EKG monitor line)
      const lineY = 75;
      ctx.strokeStyle = 'rgba(0, 217, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
      ctx.stroke();

      // Draw heartbeat spike at center
      const spikeStrength = heartbeat * 40;
      if (spikeStrength > 0.1) {
        ctx.strokeStyle = 'rgba(0, 217, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 20, lineY);
        ctx.lineTo(width / 2 - 10, lineY - spikeStrength);
        ctx.lineTo(width / 2, lineY + spikeStrength * 0.5);
        ctx.lineTo(width / 2 + 15, lineY - spikeStrength * 0.3);
        ctx.lineTo(width / 2 + 30, lineY);
        ctx.stroke();
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={150}
      className="w-full max-w-2xl"
      style={{
        filter: 'drop-shadow(0 0 20px rgba(0, 217, 255, 0.15))',
        backgroundColor: 'rgba(15, 20, 25, 0.5)',
        borderRadius: '0.5rem',
        border: '1px solid rgba(0, 217, 255, 0.2)',
      }}
    />
  );
}
