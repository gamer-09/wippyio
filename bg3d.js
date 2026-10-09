/*
 * © 2026 gamer-09. All rights reserved.
 * This code is proprietary. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * Proprietary — all rights reserved. See LICENSE for details.
 * Repository: https://github.com/gamer-09/wippyio
 */
/* ==========================================================================
   wippy — live 3D background (three.js, whole-page scene)
   ========================================================================== */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(function () {
  'use strict';

  const canvas = document.getElementById('bg3d');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth < 720;

  // ---- Palettes (bright for dark UI, deeper for light UI) ----
  const PALETTE_DARK = [0xff6b35, 0xff9f1c, 0xff006e, 0x9b5de5, 0x00bbf9, 0x00e5a0, 0xffc857];
  const PALETTE_LIGHT = [0xe05520, 0xd97706, 0xe0006e, 0x7c3aed, 0x0284c7, 0x059669, 0xb45309];
  const CORE_DARK = { a: 0xff6b35, b: 0x00bbf9 };
  const CORE_LIGHT = { a: 0xe05520, b: 0x0284c7 };

  // ---- Renderer ----
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none';
    return;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 26);

  // ---- Soft round point sprite ----
  function makeSprite() {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---- Particle field ----
  const COUNT = isMobile ? 700 : 1700;
  const SPREAD = { x: 70, y: 46, z: 60 };
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * SPREAD.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD.y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD.z;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pMat = new THREE.PointsMaterial({
    size: isMobile ? 0.5 : 0.6,
    map: makeSprite(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    opacity: 0.9,
  });

  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // ---- Wireframe core ----
  const core = new THREE.Group();
  const wireA = new THREE.Mesh(
    new THREE.IcosahedronGeometry(8.5, 1),
    new THREE.MeshBasicMaterial({ color: CORE_DARK.a, wireframe: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const wireB = new THREE.Mesh(
    new THREE.DodecahedronGeometry(13, 0),
    new THREE.MeshBasicMaterial({ color: CORE_DARK.b, wireframe: true, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  const wireC = new THREE.Mesh(
    new THREE.OctahedronGeometry(4.5, 0),
    new THREE.MeshBasicMaterial({ color: CORE_DARK.a, wireframe: true, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  core.add(wireA, wireB, wireC);
  scene.add(core);

  // ---- Theme application ----
  function applyTheme() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    const palette = light ? PALETTE_LIGHT : PALETTE_DARK;
    const attr = pGeo.getAttribute('color');
    for (let i = 0; i < COUNT; i++) {
      tmp.setHex(palette[(Math.random() * palette.length) | 0]);
      attr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    attr.needsUpdate = true;

    pMat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    pMat.opacity = light ? 0.65 : 0.9;
    pMat.needsUpdate = true;

    wireA.material.color.setHex(light ? CORE_LIGHT.a : CORE_DARK.a);
    wireC.material.color.setHex(light ? CORE_LIGHT.a : CORE_DARK.a);
    wireB.material.color.setHex(light ? CORE_LIGHT.b : CORE_DARK.b);
    wireA.material.blending = wireB.material.blending = wireC.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    wireA.material.opacity = light ? 0.18 : 0.12;
    wireB.material.opacity = light ? 0.12 : 0.07;
    wireC.material.opacity = light ? 0.22 : 0.16;
    wireA.material.needsUpdate = wireB.material.needsUpdate = wireC.material.needsUpdate = true;
  }
  applyTheme();

  new MutationObserver(applyTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // ---- Resize ----
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- Input ----
  let mouseX = 0;
  let mouseY = 0;
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });
  }

  let scrollP = 0;
  window.addEventListener('scroll', () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollP = Math.min(1, Math.max(0, window.scrollY / max));
  }, { passive: true });

  // ---- Animation ----
  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const t = clock.getElapsedTime();

    points.rotation.y = t * 0.02 + scrollP * 0.7;
    points.rotation.x = Math.sin(t * 0.05) * 0.04 + scrollP * 0.5;
    points.position.y = scrollP * 4;

    wireA.rotation.set(t * 0.05, t * 0.08, 0);
    wireB.rotation.set(-t * 0.03, -t * 0.05, t * 0.02);
    wireC.rotation.set(t * 0.12, -t * 0.1, 0);
    core.position.y = -scrollP * 4;
    core.rotation.z = scrollP * 0.4;

    const tx = (mouseX / window.innerWidth - 0.5) * 7;
    const ty = -(mouseY / window.innerHeight - 0.5) * 5;
    camera.position.x += (tx - camera.position.x) * 0.045;
    camera.position.y += (ty - camera.position.y) * 0.045;
    camera.position.z = 26 - scrollP * 9;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    clock.start();
    frame();
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  if (reduceMotion) {
    points.rotation.set(0.1, 0.4, 0);
    wireA.rotation.set(0.4, 0.6, 0);
    wireB.rotation.set(-0.2, -0.3, 0.1);
    wireC.rotation.set(0.5, -0.4, 0);
    renderer.render(scene, camera);
  } else {
    start();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else start();
    });
  }
})();
