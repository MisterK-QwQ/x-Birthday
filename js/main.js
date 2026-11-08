/* =========================================================
   生日快乐 · 交互
   1. 滚动出现 / 影像入场  2. 首屏星空（离屏自动暂停）
   3. 视频控制（自动播放状态机，不反复触发拦截）
   4. 吹蜡烛许愿 + 撒花  5. 鼠标光晕  6. 滚动进度
   ========================================================= */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------- 工具：可随时启停的 rAF 循环 ---------------- */
  const createLoop = (frame) => {
    let raf = 0;
    const tick = (time) => {
      raf = requestAnimationFrame(tick);
      frame(time);
    };
    return {
      start() { if (!raf) raf = requestAnimationFrame(tick); },
      stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } },
      get running() { return raf !== 0; }
    };
  };

  /* ---------------- 滚动出现（一次性触发） ---------------- */
  const observeOnce = (selector, options) => {
    const els = Array.from(document.querySelectorAll(selector));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, options);
    els.forEach((el) => io.observe(el));
  };

  observeOnce('.reveal', { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
  observeOnce('.film--reveal', { threshold: 0.24 });

  /* ---------------- 首屏星空 ---------------- */
  const sky = document.getElementById('sky');
  if (sky && !reduce) {
    const ctx = sky.getContext('2d');
    let width = 0, height = 0, stars = [], orbs = [], shoot = null;
    let lastTime = 0, nextShoot = 2600;

    const resizeSky = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = sky.clientWidth;
      height = sky.clientHeight;
      sky.width = Math.round(width * dpr);
      sky.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = width < 720 ? 44 : 96;
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.3 + 0.3,
        alpha: Math.random() * 0.55 + 0.18,
        speed: Math.random() * 0.12 + 0.03,
        phase: Math.random() * Math.PI * 2,
        warm: Math.random() > 0.76
      }));

      orbs = Array.from({ length: 3 }, (_, i) => ({
        x: width * (0.2 + 0.3 * i),
        y: height * (0.34 + 0.18 * (i % 2)),
        r: Math.min(width, height) * (0.2 + 0.11 * i)
      }));
    };

    const drawSky = (time) => {
      if (!lastTime) lastTime = time;
      const dt = Math.min(32, time - lastTime);
      lastTime = time;
      ctx.clearRect(0, 0, width, height);

      // 柔光雾
      orbs.forEach((orb, i) => {
        const cx = orb.x + Math.sin(time / 9000 + i * 1.7) * 24;
        const cy = orb.y + Math.cos(time / 11000 + i * 1.3) * 18;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb.r);
        grad.addColorStop(0, 'rgba(201,111,123,.10)');
        grad.addColorStop(0.55, 'rgba(233,200,143,.045)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, orb.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 星尘
      stars.forEach((star) => {
        star.y -= star.speed * dt * 0.06;
        if (star.y < -4) {
          star.y = height + 4;
          star.x = Math.random() * width;
        }
        const twinkle = 0.6 + 0.4 * Math.sin(time * 0.0012 + star.phase);
        ctx.beginPath();
        ctx.fillStyle = star.warm
          ? `rgba(233,200,143,${(star.alpha * twinkle).toFixed(3)})`
          : `rgba(246,236,221,${(star.alpha * twinkle).toFixed(3)})`;
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 偶发流星
      if (!shoot && time > nextShoot) {
        shoot = {
          x: width * (0.25 + Math.random() * 0.55),
          y: height * (0.08 + Math.random() * 0.3),
          vx: 4.2 + Math.random() * 2,
          vy: 1.4 + Math.random() * 0.8,
          life: 1
        };
      }
      if (shoot) {
        const tailX = shoot.x - shoot.vx * 26;
        const tailY = shoot.y - shoot.vy * 26;
        const line = ctx.createLinearGradient(shoot.x, shoot.y, tailX, tailY);
        line.addColorStop(0, `rgba(255,247,232,${0.85 * shoot.life})`);
        line.addColorStop(1, 'rgba(233,200,143,0)');
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(shoot.x, shoot.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        shoot.x += shoot.vx * dt * 0.12;
        shoot.y += shoot.vy * dt * 0.12;
        shoot.life -= dt * 0.0011;
        if (shoot.life <= 0 || shoot.x > width + 80 || shoot.y > height + 80) {
          shoot = null;
          nextShoot = time + 4200 + Math.random() * 5200;
        }
      }
    };

    const skyLoop = createLoop(drawSky);
    resizeSky();
    window.addEventListener('resize', resizeSky);
    skyLoop.start();

    // 首屏滚出视口后停掉星空循环，省电省性能；滚回来再恢复
    const hero = sky.closest('.hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            lastTime = 0;
            skyLoop.start();
          } else {
            skyLoop.stop();
          }
        });
      }, { threshold: 0.02 }).observe(hero);
    }
  }

  /* ---------------- 鼠标光晕 ---------------- */
  if (finePointer && !reduce) {
    const glow = document.getElementById('cursor');
    if (glow) {
      let targetX = window.innerWidth / 2;
      let targetY = window.innerHeight / 2;
      let currentX = targetX;
      let currentY = targetY;
      let shown = false;

      window.addEventListener('pointermove', (event) => {
        targetX = event.clientX;
        targetY = event.clientY;
        if (!shown) {
          shown = true;
          glow.style.opacity = '1';
        }
      }, { passive: true });

      const glowLoop = createLoop(() => {
        currentX += (targetX - currentX) * 0.12;
        currentY += (targetY - currentY) * 0.12;
        glow.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      });
      glowLoop.start();

      // 切到后台标签页时停掉跟随循环
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) glowLoop.stop();
        else glowLoop.start();
      });
    }
  }

  /* ---------------- 滚动进度 ---------------- */
  const progressBar = document.getElementById('progressBar');
  let scrollQueued = false;

  const renderScroll = () => {
    scrollQueued = false;
    if (!progressBar) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`;
  };

  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(renderScroll);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  renderScroll();

  /* ---------------- 回到开头：JS 平滑回顶，避免 hash 残留与重复点击失效 ---------------- */
  const backTop = document.querySelector('.finale__top');
  if (backTop) {
    backTop.addEventListener('click', (event) => {
      event.preventDefault();
      if (reduce) {
        window.scrollTo(0, 0);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  /* ---------------- 视频 ---------------- */
  const videos = Array.from(document.querySelectorAll('[data-video]'));
  const films = Array.from(document.querySelectorAll('[data-film]'));

  // autoplayBlocked：浏览器拒绝过有声自动播放，之后直接静音起播，不再反复撞拦截
  // userSoundChoice：用户手动选过声音 'on' / 'off'，优先级最高
  let autoplayBlocked = false;
  let userSoundChoice = null;

  const syncSoundUI = (video) => {
    const film = video.closest('.film');
    const button = film ? film.querySelector('[data-sound]') : null;
    if (!button) return;
    const text = video.muted ? '开启声音' : '关闭声音';
    button.classList.toggle('is-off', video.muted);
    button.setAttribute('aria-label', text);
    button.setAttribute('aria-pressed', String(video.muted));
    const label = button.querySelector('.film__sound-text');
    if (label) label.textContent = text;
  };

  // 按当前状态决定静音与否并播放；失败时静音兜底，绝不把用户卡在黑屏
  const applyPlay = (video, film) => {
    if (userSoundChoice === 'on') video.muted = false;
    else if (userSoundChoice === 'off') video.muted = true;
    else video.muted = autoplayBlocked;

    syncSoundUI(video);
    const attempt = video.play();
    if (!attempt || typeof attempt.then !== 'function') {
      film.classList.remove('is-paused');
      return;
    }

    attempt.then(() => {
      film.classList.remove('is-paused');
    }).catch(() => {
      if (video.muted) {
        film.classList.add('is-paused');
        return;
      }
      // 有声播放被拦：记住，静音再试一次
      autoplayBlocked = true;
      userSoundChoice = null;
      video.muted = true;
      syncSoundUI(video);
      const silent = video.play();
      if (silent && typeof silent.catch === 'function') {
        silent.catch(() => film.classList.add('is-paused'));
      }
    });
  };

  videos.forEach((video) => {
    const film = video.closest('.film');
    const playButton = film.querySelector('.film__play');
    const soundButton = film.querySelector('[data-sound]');
    const note = film.querySelector('.film__note');

    video.muted = false;
    syncSoundUI(video);

    video.addEventListener('playing', () => film.classList.remove('is-paused'));
    video.addEventListener('pause', () => film.classList.add('is-paused'));
    video.addEventListener('error', () => {
      if (note) note.hidden = false;
    });

    if (playButton) {
      playButton.addEventListener('click', () => applyPlay(video, film));
    }

    if (soundButton) {
      soundButton.addEventListener('click', () => {
        const wantMuted = !video.muted;

        // 同一时间只允许一个视频出声，其余全部静音
        videos.forEach((other) => {
          if (other === video) return;
          other.muted = true;
          syncSoundUI(other);
        });

        video.muted = wantMuted;
        userSoundChoice = wantMuted ? 'off' : 'on';
        autoplayBlocked = false;
        syncSoundUI(video);

        if (video.paused) applyPlay(video, film);
      });
    }
  });

  // 进入视口才播放，离开就暂停，避免两个视频同时占带宽
  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const film = entry.target;
        const video = film.querySelector('[data-video]');
        if (!video) return;

        if (entry.isIntersecting) {
          films.forEach((other) => {
            if (other === film) return;
            const otherVideo = other.querySelector('[data-video]');
            if (otherVideo && !otherVideo.paused) otherVideo.pause();
          });
          applyPlay(video, film);
        } else if (!video.paused) {
          video.pause();
        }
      });
    }, { threshold: 0.25 });
    films.forEach((film) => videoObserver.observe(film));
  }

  // 用户还没手动管过声音时，第一次真实手势帮忙把静音补上（浏览器手势上下文允许出声）
  const unlockSound = (event) => {
    if (userSoundChoice || !autoplayBlocked) return;
    const target = event.target;
    if (target && target.closest && target.closest('button, a, [data-sound], .film__play')) return;

    const film = films.find((item) => {
      const rect = item.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.8 && rect.bottom > window.innerHeight * 0.2;
    });
    if (!film) return;

    const video = film.querySelector('[data-video]');
    if (!video || !video.muted || video.paused) return;

    video.muted = false;
    const promise = video.play();
    if (!promise || typeof promise.then !== 'function') return;
    promise.then(() => {
      autoplayBlocked = false;
      syncSoundUI(video);
    }).catch(() => {
      video.muted = true;
      syncSoundUI(video);
    });
  };
  ['pointerdown', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, unlockSound, { passive: true });
  });

  /* ---------------- 吹蜡烛 ---------------- */
  const wish = document.getElementById('wish');
  const wishTip = document.getElementById('wishTip');
  const wishAgain = document.getElementById('wishAgain');
  const candles = Array.from(document.querySelectorAll('.candle'));
  let blownOut = 0;

  const celebrate = () => {
    if (wish) wish.classList.add('is-wished');
    if (wishTip) wishTip.textContent = '许好啦，接下来就看你的了。';
    if (wishAgain) wishAgain.hidden = false;
    burstConfetti();
  };

  candles.forEach((candle) => {
    candle.addEventListener('click', () => {
      if (candle.classList.contains('is-out')) return;
      candle.classList.add('is-out');
      candle.setAttribute('aria-pressed', 'true');
      blownOut += 1;
      if (blownOut === candles.length) celebrate();
    });
  });

  if (wishAgain) {
    wishAgain.addEventListener('click', () => {
      candles.forEach((candle) => {
        candle.classList.remove('is-out');
        candle.setAttribute('aria-pressed', 'false');
      });
      blownOut = 0;
      if (wish) wish.classList.remove('is-wished');
      if (wishTip) wishTip.textContent = '点一下蜡烛，许个愿吧';
      wishAgain.hidden = true;
    });
  }

  /* ---------------- 撒花 ---------------- */
  const confettiCanvas = document.getElementById('confetti');
  let confettiCtx = null;
  let confettiParticles = [];
  let confettiFrame = 0;

  const sizeConfetti = () => {
    if (!confettiCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = Math.round(window.innerWidth * dpr);
    confettiCanvas.height = Math.round(window.innerHeight * dpr);
    confettiCtx = confettiCanvas.getContext('2d');
    confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const stepConfetti = () => {
    if (!confettiCtx) return;
    confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    confettiParticles = confettiParticles.filter((p) => {
      p.vy += 0.17;
      p.vx *= 0.995;
      p.vy *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;
      if (p.life <= 0) return false;

      confettiCtx.save();
      confettiCtx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.8));
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confettiCtx.restore();
      return true;
    });

    if (confettiParticles.length) {
      confettiFrame = requestAnimationFrame(stepConfetti);
    } else {
      confettiFrame = 0;
      confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  };

  const burstConfetti = () => {
    if (!confettiCanvas || reduce) return;
    sizeConfetti();

    const cake = document.getElementById('cake');
    const rect = cake ? cake.getBoundingClientRect() : null;
    const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const originY = rect ? rect.top + rect.height * 0.18 : window.innerHeight / 2;
    const colors = ['#e9c88f', '#fdf3e2', '#c96f7b', '#f6ecdd', '#b9853f'];

    for (let i = 0; i < 130; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = 6 + Math.random() * 11;
      confettiParticles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 4 + Math.random() * 7,
        h: 6 + Math.random() * 10,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.36,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.005 + Math.random() * 0.006
      });
    }

    if (!confettiFrame) confettiFrame = requestAnimationFrame(stepConfetti);
  };

  window.addEventListener('resize', () => {
    if (confettiParticles.length) sizeConfetti();
  });
})();
