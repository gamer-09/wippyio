/*
 * © 2026 gamer-09. All rights reserved.
 * Admin dashboard — distinct live motion background (animated node network).
 * Deliberately different from the home page's particle/3D scene.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('adminBg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let nodes = [];
  let mouse = { x: -9999, y: -9999 };
  let running = false;
  let raf = 0;

  const DARK = { node: '0,187,249', link: '0,187,249', alt: '155,93,229', glow: 0.9 };
  const LIGHT = { node: '2,132,199', link: '2,132,199', alt: '124,58,237', glow: 0.7 };

  function theme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? LIGHT : DARK;
  }

  function makeNodes() {
    const density = Math.min(110, Math.max(40, Math.round((W * H) / 22000)));
    nodes = [];
    for (let i = 0; i < density; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.2 + Math.random() * 1.8,
        alt: Math.random() < 0.25,
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeNodes();
  }

  const LINK_DIST = 150;

  function draw() {
    if (!running) return;
    raf = requestAnimationFrame(draw);

    const pal = theme();
    ctx.clearRect(0, 0, W, H);

    // move
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = W + 20;
      if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20;
      if (n.y > H + 20) n.y = -20;

      // subtle mouse repulsion
      const dx = n.x - mouse.x;
      const dy = n.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 12000 && d2 > 1) {
        const f = (1 - d2 / 12000) * 0.9;
        const d = Math.sqrt(d2);
        n.x += (dx / d) * f;
        n.y += (dy / d) * f;
      }
    }

    // links
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const alpha = (1 - dist / LINK_DIST) * 0.28;
          ctx.strokeStyle = 'rgba(' + pal.link + ',' + alpha + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // nodes
    for (const n of nodes) {
      const col = n.alt ? pal.alt : pal.node;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + col + ',' + pal.glow + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 3.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + col + ',0.08)';
      ctx.fill();
    }
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    draw();
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });

  new MutationObserver(() => {}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
  if (reduceMotion) {
    running = true; draw(); running = false;
  } else {
    start();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });
  }
})();
