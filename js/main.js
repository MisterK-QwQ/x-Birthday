/* =========================================================
   生日快乐 · 交互
   1. 滚动出现 / 影像入场  2. 首屏烟火见 fireworks.js
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
  const blowAll = document.getElementById('blowAll');
  const candles = Array.from(document.querySelectorAll('.candle'));
  let blownOut = 0;
  let blowTimers = [];
  let draggingCandles = false;

  const celebrate = () => {
    if (wish) wish.classList.add('is-wished');
    if (wishTip) wishTip.textContent = '许好啦，接下来就看你的了。';
    if (wishAgain) wishAgain.hidden = false;
    if (blowAll) blowAll.hidden = true;
    burstConfetti();
  };

  const blowCandle = (candle) => {
    if (!candle || candle.classList.contains('is-out')) return;
    candle.classList.add('is-out');
    candle.setAttribute('aria-pressed', 'true');
    blownOut += 1;
    if (wishTip && blownOut < candles.length) wishTip.textContent = `还剩 ${candles.length - blownOut} 根蜡烛。`;
    if (blownOut === candles.length) celebrate();
  };

  candles.forEach((candle) => {
    candle.addEventListener('click', () => blowCandle(candle));
    candle.addEventListener('pointerdown', () => {
      draggingCandles = true;
      blowCandle(candle);
    });
  });

  window.addEventListener('pointermove', (event) => {
    if (!draggingCandles) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    blowCandle(target && target.closest('.candle'));
  });
  ['pointerup', 'pointercancel'].forEach((type) => window.addEventListener(type, () => { draggingCandles = false; }));

  if (blowAll) blowAll.addEventListener('click', () => {
    if (blowAll.disabled) return;
    blowAll.disabled = true;
    wish.classList.add('is-blowing');
    const pending = candles.filter((candle) => !candle.classList.contains('is-out'));
    pending.forEach((candle, index) => {
      blowTimers.push(setTimeout(() => {
        blowCandle(candle);
        if (index === pending.length - 1) wish.classList.remove('is-blowing');
      }, index * 220 + 280));
    });
  });

  if (wishAgain) {
    wishAgain.addEventListener('click', () => {
      blowTimers.forEach(clearTimeout);
      blowTimers = [];
      candles.forEach((candle) => {
        candle.classList.remove('is-out');
        candle.setAttribute('aria-pressed', 'false');
      });
      blownOut = 0;
      if (wish) wish.classList.remove('is-wished', 'is-blowing');
      if (wishTip) wishTip.textContent = '点一下蜡烛，许个愿吧';
      if (blowAll) { blowAll.disabled = false; blowAll.hidden = false; }
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

  const burstConfetti = (source) => {
    if (!confettiCanvas || reduce) return;
    sizeConfetti();

    const cake = document.getElementById('cake');
    const rect = (source || cake) ? (source || cake).getBoundingClientRect() : null;
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

  /* ---------------- 两个可玩的生日章节 ---------------- */
  let starCompleted = false;
  let giftsCompleted = false;
  const finale = document.querySelector('.finale');
  const finaleBonus = document.getElementById('finaleBonus');
  const updateFinale = () => {
    const unlocked = starCompleted && giftsCompleted;
    if (finale) finale.classList.toggle('is-unlocked', unlocked);
    if (finaleBonus) finaleBonus.hidden = !unlocked;
  };

  let audioContext = null;
  const playNote = (frequency) => {
    if (!soundOn || reduce) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioContext = audioContext || new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, now + 0.14);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.23);
    } catch (_) {
      // A blocked audio context never prevents the interaction.
    }
  };

  const starSection = document.getElementById('star-game');
  const starBoard = document.getElementById('starBoard');
  const starCells = Array.from(document.querySelectorAll('.star-cell'));
  const starScore = document.getElementById('starScore');
  const starClock = document.getElementById('starClock');
  const starStatus = document.getElementById('starStatus');
  const starStart = document.getElementById('starStart');
  let starRunning = false;
  let score = 0;
  let seconds = 20;
  let activeCell = null;
  let lastCell = -1;
  let spawnTimer = 0;
  let clockTimer = 0;

  const clearStarCell = (cell) => {
    if (!cell) return;
    cell.textContent = '';
    cell.classList.remove('is-star', 'is-cloud', 'is-hit');
    cell.disabled = true;
    cell.setAttribute('aria-label', '空位');
    delete cell.dataset.kind;
  };

  const spawnStar = () => {
    if (!starRunning || document.hidden) return;
    clearStarCell(activeCell);
    const offset = Math.floor(Math.random() * (starCells.length - 1)) + 1;
    const index = (lastCell + offset + starCells.length) % starCells.length;
    const cell = starCells[index];
    const kind = Math.random() < 0.22 ? 'cloud' : 'star';
    lastCell = index;
    activeCell = cell;
    cell.dataset.kind = kind;
    cell.disabled = false;
    cell.classList.add(kind === 'star' ? 'is-star' : 'is-cloud');
    cell.textContent = kind === 'star' ? '✦' : '☁';
    cell.setAttribute('aria-label', kind === 'star' ? '抓住好运星' : '避开乌云');
  };

  const finishStarRound = (won) => {
    starRunning = false;
    clearInterval(spawnTimer);
    clearInterval(clockTimer);
    clearStarCell(activeCell);
    activeCell = null;
    if (starStart) starStart.innerHTML = '再玩一次 <span aria-hidden="true">↗</span>';
    if (won) {
      starCompleted = true;
      starSection.classList.add('is-won');
      starStatus.textContent = '好运已装满，送你一整年。';
      playNote(880);
      burstConfetti(starBoard);
      updateFinale();
    } else {
      starStatus.textContent = '还差一点，再试一次。';
    }
  };

  if (starStart && starCells.length) {
    starStart.addEventListener('click', () => {
      clearInterval(spawnTimer);
      clearInterval(clockTimer);
      clearStarCell(activeCell);
      starSection.classList.remove('is-won');
      starRunning = true;
      score = 0;
      seconds = 20;
      lastCell = -1;
      starScore.innerHTML = '00 <small>/ 09</small>';
      starClock.textContent = '20';
      starStatus.textContent = '好运正在靠近。';
      starStart.innerHTML = '重新开始 <span aria-hidden="true">↗</span>';
      spawnStar();
      spawnTimer = setInterval(spawnStar, 780);
      clockTimer = setInterval(() => {
        if (document.hidden) return;
        seconds -= 1;
        starClock.textContent = String(seconds).padStart(2, '0');
        if (seconds <= 0) finishStarRound(false);
      }, 1000);
    });
    starCells.forEach((cell) => cell.addEventListener('click', () => {
      if (!starRunning || cell !== activeCell) return;
      const kind = cell.dataset.kind;
      if (kind === 'star') {
        score += 1;
        starStatus.textContent = score >= 9 ? '最后一颗，抓到了！' : '接住一颗好运星。';
        playNote(500 + score * 40);
      } else {
        score = Math.max(0, score - 1);
        starStatus.textContent = '乌云路过，少了一颗星。';
        playNote(220);
      }
      starScore.innerHTML = `${String(score).padStart(2, '0')} <small>/ 09</small>`;
      if (score >= 9) finishStarRound(true);
      else spawnStar();
    }));
  }

  const giftsSection = document.getElementById('gifts');
  const giftBoxes = Array.from(document.querySelectorAll('.gift-box'));
  const giftCount = document.getElementById('giftCount');
  const giftStatus = document.getElementById('giftStatus');
  const giftReset = document.getElementById('giftReset');
  let openedGifts = 0;

  giftBoxes.forEach((box) => box.addEventListener('click', () => {
    if (box.classList.contains('is-open')) return;
    box.classList.add('is-open');
    box.setAttribute('aria-expanded', 'true');
    const surprise = box.querySelector('.gift-box__surprise');
    surprise.setAttribute('aria-hidden', 'false');
    box.setAttribute('aria-label', surprise.textContent.trim());
    openedGifts += 1;
    giftCount.textContent = String(openedGifts).padStart(2, '0');
    giftReset.hidden = false;
    playNote(620 + openedGifts * 90);
    if (openedGifts === giftBoxes.length) {
      giftsCompleted = true;
      giftStatus.textContent = '三份惊喜都归你。';
      burstConfetti(giftsSection);
      updateFinale();
    } else {
      giftStatus.textContent = '还有惊喜没拆开。';
    }
  }));

  if (giftReset) giftReset.addEventListener('click', () => {
    giftBoxes.forEach((box, index) => {
      box.classList.remove('is-open');
      box.setAttribute('aria-expanded', 'false');
      box.setAttribute('aria-label', `拆开第${['一', '二', '三'][index]}份礼物`);
      box.querySelector('.gift-box__surprise').setAttribute('aria-hidden', 'true');
    });
    openedGifts = 0;
    giftCount.textContent = '00';
    giftStatus.textContent = '挑一个，先打开看看。';
    giftReset.hidden = true;
  });
})();
