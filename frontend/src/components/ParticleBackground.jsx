import { useEffect, useRef } from 'react';

const CONFIG = {
  speed: 0.3,
  minRadius: 1,
  maxRadius: 2.5,
  connectionDistance: 120,
  mouseRadius: 80,
  mouseStrength: 0.015,
};

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function makeParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * CONFIG.speed * 2,
    vy: (Math.random() - 0.5) * CONFIG.speed * 2,
    r: randomBetween(CONFIG.minRadius, CONFIG.maxRadius),
  };
}

export default function ParticleBackground({ opacity = 1, particleCount = 60 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ particles: [], mouse: { x: -999, y: -999 }, raf: null, paused: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = stateRef.current;

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      if (state.particles.length === 0) {
        state.particles = Array.from({ length: particleCount }, () => makeParticle(canvas.width, canvas.height));
      }
    }

    function getColors() {
      const style = getComputedStyle(document.documentElement);
      const particle = style.getPropertyValue('--color-particle').trim() || 'rgba(37,99,235,0.15)';
      return { particle };
    }

    function draw() {
      if (state.paused) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const { particle: pColor } = getColors();

      for (const p of state.particles) {
        // Mouse attraction
        const dx = state.mouse.x - p.x;
        const dy = state.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.mouseRadius && dist > 0) {
          p.vx += (dx / dist) * CONFIG.mouseStrength;
          p.vy += (dy / dist) * CONFIG.mouseStrength;
        }

        // Clamp velocity
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpeed = CONFIG.speed * 2;
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Bounce at edges
        if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx); }
        if (p.x > w - p.r) { p.x = w - p.r; p.vx = -Math.abs(p.vx); }
        if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); }
        if (p.y > h - p.r) { p.y = h - p.r; p.vy = -Math.abs(p.vy); }
      }

      // Draw connections
      for (let i = 0; i < state.particles.length; i++) {
        for (let j = i + 1; j < state.particles.length; j++) {
          const a = state.particles[i];
          const b = state.particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONFIG.connectionDistance) {
            const alpha = (1 - dist / CONFIG.connectionDistance);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = pColor.replace(/[\d.]+\)$/, `${alpha * 0.5})`);
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of state.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = pColor.replace(/[\d.]+\)$/, '0.6)');
        ctx.fill();
      }

      state.raf = requestAnimationFrame(draw);
    }

    function onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      state.mouse.x = e.clientX - rect.left;
      state.mouse.y = e.clientY - rect.top;
    }

    function onVisibilityChange() {
      state.paused = document.visibilityState === 'hidden';
      if (!state.paused && !state.raf) {
        state.raf = requestAnimationFrame(draw);
      }
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('visibilitychange', onVisibilityChange);

    state.raf = requestAnimationFrame(draw);

    return () => {
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = null;
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [particleCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity,
      }}
    />
  );
}
