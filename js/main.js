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

  /* ---------------- 音频中枢：背景音乐 + 视频，统一调度 ---------------- */
  const bgm = document.getElementById('bgm');
  // BGM 压低音量做背景氛围，不抢视频；视频音量保持 1.0
  if (bgm) bgm.volume = 0.35;
  const videos = Array.from(document.querySelectorAll('[data-video]'));
  const films = Array.from(document.querySelectorAll('[data-film]'));
  const filmSoundButtons = Array.from(document.querySelectorAll('[data-sound]'));
  const globalSoundButton = document.getElementById('globalSound');
  const allSoundButtons = globalSoundButton
    ? filmSoundButtons.concat(globalSoundButton)
    : filmSoundButtons;

  // soundOn：用户期望的全局声音开关；needUnlock：有声自动播放被拦，等待首次手势
  let soundOn = true;
  let needUnlock = false;

  // 安全播放：静音自动播放始终允许；有声被拦时记下等手势，不抛未捕获异常
  const safePlay = (media) => {
    const attempt = media.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch((err) => {
        if (err && err.name === 'NotAllowedError') needUnlock = true;
      });
    }
    return attempt;
  };

  // 同步所有声音按钮的状态、文案与无障碍属性
  const syncSoundUI = () => {
    document.body.classList.toggle('sound-off', !soundOn);
    allSoundButtons.forEach((button) => {
      button.classList.toggle('is-off', !soundOn);
      button.setAttribute('aria-pressed', String(!soundOn));
      button.setAttribute('aria-label', soundOn ? '关闭声音' : '开启声音');
    });
    filmSoundButtons.forEach((button) => {
      const text = button.querySelector('.film__sound-text');
      if (text) text.textContent = soundOn ? '关闭声音' : '开启声音';
    });
  };

  /* 统一调度：决定此刻谁出声
     全局关闭：BGM 暂停、视频静音（画面继续）
     全局开启且有视频在播放：把声音让给视频，BGM 暂停
     其余情况：BGM 播放 */
  const updateAudio = () => {
    syncSoundUI();
    if (!soundOn) {
      if (bgm) bgm.pause();
      videos.forEach((video) => { video.muted = true; });
      return;
    }
    videos.forEach((video) => { video.muted = false; });
    const videoPlaying = videos.some((video) => !video.paused && !video.ended);
    if (videoPlaying) {
      if (bgm) bgm.pause();
    } else if (bgm) {
      safePlay(bgm);
    }
  };

  const toggleSound = () => {
    soundOn = !soundOn;
    needUnlock = false; // 点击本身就是有效手势
    updateAudio();
  };
  allSoundButtons.forEach((button) => button.addEventListener('click', toggleSound));

  /* 每个视频：单次播放，结束显示"再看一次"，状态变化同步调度 */
  videos.forEach((video) => {
    const film = video.closest('.film');
    const note = film.querySelector('.film__note');
    const playText = film.querySelector('.film__play-text');

    video.muted = false;

    video.addEventListener('play', () => {
      film.classList.remove('is-paused', 'is-ended');
      if (playText) playText.textContent = '播放';
      updateAudio();
    });
    video.addEventListener('pause', () => {
      film.classList.add('is-paused');
      updateAudio();
    });
    video.addEventListener('ended', () => {
      film.classList.add('is-paused', 'is-ended');
      if (playText) playText.textContent = '再看一次';
      updateAudio();
    });
    video.addEventListener('error', () => {
      if (note) note.hidden = false;
    });

    // 播放/重播按钮：从头播一次
    const playButton = film.querySelector('.film__play');
    if (playButton) {
      playButton.addEventListener('click', () => {
        video.currentTime = 0;
        safePlay(video);
      });
    }
  });

  /* 进入视口播放一次，离开即暂停；再次进入若已结束则重播。
     直接观察视频画面，避免文字区还在视口、画面已离屏时不暂停 */
  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const film = video.closest('.film');
        if (!film) return;

        if (entry.isIntersecting) {
          if (video.ended) video.currentTime = 0;
          if (video.paused) safePlay(video);
        } else if (!video.paused) {
          video.pause();
        }
        updateAudio();
      });
    }, { threshold: 0.25 });
    videos.forEach((video) => videoObserver.observe(video));
  } else {
    videos.forEach((video) => safePlay(video));
  }

  // 初始化：首屏没有视频，尝试起 BGM（无手势会被拦，等首次手势）
  updateAudio();

  /* 首次真实手势解锁自动播放（手势上下文允许出声） */
  ['pointerdown', 'touchstart', 'keydown'].forEach((type) => {
    window.addEventListener(type, () => {
      if (needUnlock) {
        needUnlock = false;
        updateAudio();
      }
    }, { passive: true });
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
