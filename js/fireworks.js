(() => {
  'use strict';

  const canvas = document.getElementById('sky');
  const button = document.getElementById('fireworkButton');
  if (!canvas || !button) return;

  const ctx = canvas.getContext('2d');
  const hero = canvas.closest('.hero');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = ['#e9c88f', '#fff3df', '#bd7881', '#d9a86f', '#f7e4c7'];
  let width = 0;
  let height = 0;
  let particles = [];
  let frame = 0;
  let last = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = (time) => {
    const dt = Math.min(32, time - (last || time));
    last = time;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'screen';
    particles = particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += dt * 0.00024;
      p.vx *= 0.997;
      p.life -= dt / p.duration;
      if (p.life <= 0) return false;

      const alpha = Math.min(1, p.life * 2);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.weight;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 28, p.y - p.vy * 28);
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#fff3df';
      ctx.arc(p.x, p.y, p.weight * 0.7, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    frame = particles.length ? requestAnimationFrame(draw) : 0;
    if (!frame) last = 0;
  };

  const burst = (x, y, count = 54) => {
    if (reduced) return;
    const color = colors[Math.floor(Math.random() * colors.length)];
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.14;
      const speed = 0.13 + Math.random() * 0.19;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        duration: 1050 + Math.random() * 650,
        color: Math.random() > 0.74 ? '#fff3df' : color,
        weight: 1.4 + Math.random() * 2.7
      });
    }
    if (!frame) frame = requestAnimationFrame(draw);
  };

  let launchTimers = [];
  const launch = () => {
    launchTimers.forEach(clearTimeout);
    launchTimers = [];
    const positions = width < 760
      ? [[0.26, 0.25], [0.72, 0.39], [0.48, 0.16]]
      : [[0.61, 0.35], [0.83, 0.22], [0.73, 0.63]];
    positions.forEach(([x, y], index) => {
      launchTimers.push(setTimeout(() => burst(width * x, height * y), index * 260));
    });
  };

  button.addEventListener('click', () => {
    if (reduced) {
      hero.classList.add('is-lit');
      button.textContent = '夜空已点亮';
      return;
    }
    launch();
    button.innerHTML = '再放一次 <span aria-hidden="true">✦</span>';
  });
  hero.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button')) return;
    const rect = canvas.getBoundingClientRect();
    burst(event.clientX - rect.left, event.clientY - rect.top, 28);
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    particles = [];
    ctx.clearRect(0, 0, width, height);
  });
  resize();
  if (!reduced) {
    launchTimers.push(setTimeout(() => burst(width * 0.75, height * 0.34), 900));
    launchTimers.push(setTimeout(() => burst(width * 0.61, height * 0.58), 1550));
  }
})();
