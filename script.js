/* =====================================================
   BIRTHDAY WISHES WEBSITE — script.js  v2
   Features:
   ✅ "Happy Birthday to you, [NAME]!" via Speech Synthesis + melody BGM
   ✅ Shake-to-blow-out candles (DeviceMotion API)
   ✅ Desktop fallback: "Blow Out Candles" button
   ✅ Candle extinguish animation + smoke puffs
   ✅ Confetti, balloons, fireworks, wishes, share
   ===================================================== */

'use strict';

/* ======================================================
   STATE
   ====================================================== */
let currentName       = '';
let confettiAnimId    = null;
let balloonTimers     = [];
let fireworkTimers    = [];
let audioCtx          = null;
let musicPlaying      = false;
let musicLoopTimeout  = null;
let candlesBlown      = false;
let shakeListening    = false;
let lastShakeTime     = 0;
const SHAKE_THRESHOLD = 22;   // m/s² — tune up/down if needed
const SHAKE_COOLDOWN  = 1200; // ms between shake triggers

/* ======================================================
   WISHES POOL
   ====================================================== */
const wishes = [
  "May all your dreams take flight like shooting stars! ✨",
  "Wishing you a year overflowing with love, laughter & magical moments! 💫",
  "May happiness be your constant companion all year long! 🌈",
  "Your best chapters are still ahead — here's to an amazing year! 📖",
  "May every day bring you a reason to smile! 😊",
  "May your heart be light and your spirit always bright! 💖",
  "Wishing you endless blessings and unforgettable memories! 🎊",
  "May the universe conspire to make all your wishes come true! 🌙",
];

/* ======================================================
   HELPERS
   ====================================================== */
function sanitizeName(raw) {
  return raw
    .replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))
    .slice(0, 40).trim();
}

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/* ======================================================
   ENTRY POINT
   ====================================================== */
function startCelebration() {
  const input   = document.getElementById('nameInput');
  const errorEl = document.getElementById('inputError');
  const raw     = input.value.trim();

  if (!raw) {
    errorEl.classList.remove('hidden');
    input.focus();
    return;
  }
  errorEl.classList.add('hidden');
  currentName  = sanitizeName(raw);
  candlesBlown = false;

  showCelebrationScreen();
}

/* ======================================================
   SHOW CELEBRATION SCREEN
   ====================================================== */
function showCelebrationScreen() {
  document.getElementById('welcomeScreen').classList.remove('active');

  const cel = document.getElementById('celebrationScreen');
  cel.classList.add('active');

  // Reset candles
  resetCandles();

  // Populate
  document.getElementById('birthdayName').innerHTML = currentName;
  document.getElementById('birthdayMessage').innerHTML =
    `May your special day be filled with love, laughter, happiness, and unforgettable memories, <strong>${currentName}</strong>! ` +
    `May all your dreams come true and every wish your heart holds be granted. You deserve the very best! 🌟`;

  document.getElementById('wishResult').classList.add('hidden');
  document.getElementById('candlesBlownMsg').classList.add('hidden');

  // Show shake hint
  document.getElementById('shakeHint').classList.remove('hidden');
  document.getElementById('blowBtn').style.display = '';

  // Start visual effects
  startConfetti();
  startBalloons();
  spawnStars();
  triggerFireworks();

  // Auto-play the birthday song with name after a short delay
  setTimeout(() => playSong(), 800);

  // Start shake detection
  startShakeDetection();
}

/* ======================================================
   ██████  BIRTHDAY SONG WITH NAME  ██████
   Plays "Happy Birthday to you" melody via Web Audio API
   AND speaks the lyrics including the person's name
   via SpeechSynthesis simultaneously.
   ====================================================== */

// "Happy Birthday to You" — note [frequency, beat-length]
// Tempo ≈ 100 BPM → 1 beat = 0.6 s
const BEAT = 0.6; // seconds per beat

const MELODY_NOTES = [
  // Line 1: "Happy birthday to you"
  [261.63, 0.75], [261.63, 0.25], [293.66, 1],
  [261.63, 1],    [349.23, 1],    [329.63, 2],
  // Line 2: "Happy birthday to you"
  [261.63, 0.75], [261.63, 0.25], [293.66, 1],
  [261.63, 1],    [392.00, 1],    [349.23, 2],
  // Line 3: "Happy birthday dear NAME"
  [261.63, 0.75], [261.63, 0.25], [523.25, 1],
  [440.00, 1],    [349.23, 1],    [329.63, 1], [293.66, 2],
  // Line 4: "Happy birthday to you"
  [466.16, 0.75], [466.16, 0.25], [440.00, 1],
  [349.23, 1],    [392.00, 1],    [349.23, 2.5],
];

function playSong() {
  if (musicPlaying) return; // already playing
  startMelody();
  singWithVoice();
  updateMusicBtn(true);
}

function startMelody() {
  if (musicPlaying) return;
  musicPlaying = true;

  const ac = getAudioCtx();
  let t    = ac.currentTime + 0.05;

  function scheduleMelody() {
    if (!musicPlaying) return;

    MELODY_NOTES.forEach(([freq, beats]) => {
      const dur  = beats * BEAT;
      const osc  = ac.createOscillator();
      const gain = ac.createGain();

      // Add a slight vibrato
      const vibrato     = ac.createOscillator();
      const vibratoGain = ac.createGain();
      vibrato.frequency.value = 5.5;
      vibratoGain.gain.value  = 4;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(t);
      vibrato.stop(t + dur);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
      gain.gain.setValueAtTime(0.22, t + dur - 0.06);
      gain.gain.linearRampToValueAtTime(0, t + dur);

      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.02;
    });

    // Total duration for the melody
    const totalDur = MELODY_NOTES.reduce((sum, [, b]) => sum + b * BEAT + 0.02, 0);

    if (musicPlaying) {
      musicLoopTimeout = setTimeout(() => {
        if (musicPlaying) {
          scheduleMelody();
          singWithVoice(); // sing again on loop
        }
      }, totalDur * 1000 + 600);
    }
  }

  scheduleMelody();
}

function singWithVoice() {
  if (!window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Build lyrics with the person's raw (unsanitized display) name
  const displayName = document.getElementById('birthdayName').textContent || currentName;

  const lyrics =
    `Happy birthday to you! ` +
    `Happy birthday to you! ` +
    `Happy birthday dear ${displayName}! ` +
    `Happy birthday to you!`;

  const utter = new SpeechSynthesisUtterance(lyrics);
  utter.rate   = 0.82;   // slightly slow for singing feel
  utter.pitch  = 1.15;   // cheerful higher pitch
  utter.volume = 0.85;

  // Pick a pleasant voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Samantha'))
  ) || voices.find(v => v.lang.startsWith('en')) || null;

  if (preferred) utter.voice = preferred;

  window.speechSynthesis.speak(utter);
}

function stopSong() {
  musicPlaying = false;
  if (musicLoopTimeout) { clearTimeout(musicLoopTimeout); musicLoopTimeout = null; }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  updateMusicBtn(false);
}

function toggleMusic() {
  if (musicPlaying) {
    stopSong();
  } else {
    playSong();
  }
}

function updateMusicBtn(playing) {
  const btn = document.getElementById('musicBtn');
  if (playing) {
    btn.textContent = '⏸ PAUSE SONG';
    btn.style.background = 'linear-gradient(135deg,#ec4899,#be185d)';
  } else {
    btn.textContent = '🎵 BIRTHDAY SONG';
    btn.style.background = 'linear-gradient(135deg,#a855f7,#7c3aed)';
  }
}

/* ======================================================
   ██████  SHAKE DETECTION  ██████
   Uses DeviceMotionEvent.  Works on:
   • Android: no permission needed
   • iOS 13+: needs requestPermission()
   • Laptops with accelerometer: works
   • Desktops without sensor: fallback button shown
   ====================================================== */
function startShakeDetection() {
  if (!window.DeviceMotionEvent) {
    console.log('DeviceMotion not supported — showing button only');
    return;
  }

  // iOS 13+ requires explicit permission
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    // Show a tap-to-enable button if we haven't got permission yet
    showIOSPermissionBanner();
    return;
  }

  attachShakeListener();
}

function showIOSPermissionBanner() {
  // Repurpose the hint banner to also include permission request
  const hint = document.getElementById('shakeHint');
  const extra = document.createElement('button');
  extra.className = 'btn btn-blow';
  extra.style.cssText = 'margin-top:10px;width:auto;padding:10px 20px;font-size:.85rem;';
  extra.textContent = '📳 Enable Shake Detection (iOS)';
  extra.onclick = requestIOSPermission;
  hint.appendChild(extra);
}

function requestIOSPermission() {
  DeviceMotionEvent.requestPermission().then(state => {
    if (state === 'granted') attachShakeListener();
  }).catch(console.error);
}

function attachShakeListener() {
  if (shakeListening) return;
  shakeListening = true;

  let lastX = null, lastY = null, lastZ = null;

  window.addEventListener('devicemotion', function onMotion(e) {
    if (!document.getElementById('celebrationScreen').classList.contains('active')) {
      window.removeEventListener('devicemotion', onMotion);
      shakeListening = false;
      return;
    }
    if (candlesBlown) return;

    const acc = e.accelerationIncludingGravity;
    if (!acc) return;

    const { x, y, z } = acc;
    if (lastX === null) { lastX = x; lastY = y; lastZ = z; return; }

    const delta = Math.sqrt(
      Math.pow(x - lastX, 2) +
      Math.pow(y - lastY, 2) +
      Math.pow(z - lastZ, 2)
    );

    lastX = x; lastY = y; lastZ = z;

    const now = Date.now();
    if (delta > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN) {
      lastShakeTime = now;
      blowOutCandles();
    }
  });
}

/* ======================================================
   ██████  BLOW OUT CANDLES  ██████
   ====================================================== */
function blowOutCandles() {
  if (candlesBlown) return;
  candlesBlown = true;

  // Hide hint + blow button
  document.getElementById('shakeHint').classList.add('hidden');
  document.getElementById('blowBtn').style.display = 'none';

  // Extinguish flames one by one with staggered delay
  const flames = document.querySelectorAll('.flame');
  const smokes = document.querySelectorAll('.smoke');

  flames.forEach((flame, i) => {
    setTimeout(() => {
      flame.classList.add('out');
      playBlowSound();
    }, i * 180);
  });

  // Puff smoke after flames go out
  smokes.forEach((smoke, i) => {
    setTimeout(() => {
      smoke.style.opacity = '1';
      smoke.classList.add('puffing');
      setTimeout(() => { smoke.style.opacity = '0'; smoke.classList.remove('puffing'); }, 1800);
    }, i * 180 + 300);
  });

  // Show inline message
  setTimeout(() => {
    document.getElementById('candlesBlownMsg').classList.remove('hidden');
  }, 1000);

  // Show big overlay celebration
  setTimeout(() => showBlownOverlay(), 1400);

  // Extra fireworks burst
  setTimeout(() => { fireworkBurst(); fireworkBurst(); fireworkBurst(); }, 1800);
}

function playBlowSound() {
  try {
    const ac   = getAudioCtx();
    const buf  = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate);
    const data = buf.getChannelData(0);
    // White-noise "puff"
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src  = ac.createBufferSource();
    const filt = ac.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 900;
    filt.Q.value = 0.6;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.25, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
    src.buffer = buf;
    src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
    src.start();
  } catch(e) {}
}

/* ======================================================
   BLOWN OVERLAY
   ====================================================== */
function showBlownOverlay() {
  const overlay = document.getElementById('blownOverlay');
  const starsEl = document.getElementById('blownStars');
  const rawName = document.getElementById('birthdayName').textContent;

  document.getElementById('blownTitle').textContent = '🎊 Candles Blown Out!';
  document.getElementById('blownOverlayText').textContent =
    `Your wish is sent to the universe, ${rawName}! May everything you wished for come true! 🌟✨`;

  starsEl.innerHTML = '';
  for (let i = 0; i < 22; i++) {
    const s = document.createElement('div');
    s.className = 'wish-star-particle';
    s.textContent = ['✨','⭐','🌟','💫','🎊','🎉'][Math.floor(Math.random() * 6)];
    s.style.left = (5 + Math.random() * 90) + '%';
    s.style.top  = (5 + Math.random() * 90) + '%';
    s.style.setProperty('--wx', ((Math.random() - 0.5) * 200) + 'px');
    s.style.setProperty('--wy', ((Math.random() - 0.5) * 200) + 'px');
    s.style.animationDelay = (Math.random() * 0.6) + 's';
    starsEl.appendChild(s);
  }

  overlay.classList.remove('hidden');
  playSparkle();
}

function closeBlownOverlay() {
  document.getElementById('blownOverlay').classList.add('hidden');
}

/* ======================================================
   RESET CANDLES (for reuse)
   ====================================================== */
function resetCandles() {
  document.querySelectorAll('.flame').forEach(f => f.classList.remove('out'));
  document.querySelectorAll('.smoke').forEach(s => { s.style.opacity='0'; s.classList.remove('puffing'); });
  candlesBlown = false;
}

/* ======================================================
   CONFETTI
   ====================================================== */
const CONFETTI_COLORS = ['#ff4ecd','#ffd700','#3b82f6','#22c55e','#f97316','#a855f7','#ec4899','#06b6d4'];
let confettiPieces = [];

function startConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  confettiPieces = [];
  for (let i = 0; i < 170; i++) confettiPieces.push(mkConfetti());

  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animateConfetti(ctx, canvas);
}

function mkConfetti(fromTop = false) {
  return {
    x: Math.random() * window.innerWidth,
    y: fromTop ? -10 : Math.random() * window.innerHeight,
    w: 6 + Math.random() * 10, h: 4 + Math.random() * 8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    vx: (Math.random() - 0.5) * 2.5,
    vy: 1.5 + Math.random() * 3.5,
    rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 8,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
    alpha: 0.8 + Math.random() * 0.2,
  };
}

function animateConfetti(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  confettiPieces.forEach((p, i) => {
    p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.vy += 0.04;
    if (p.y > canvas.height + 20) confettiPieces[i] = mkConfetti(true);
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rot * Math.PI) / 180);
    if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0,0,p.w/2,0,Math.PI*2); ctx.fill(); }
    else ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
    ctx.restore();
  });
  confettiAnimId = requestAnimationFrame(() => animateConfetti(ctx, canvas));
}

function stopConfetti() {
  if (confettiAnimId) { cancelAnimationFrame(confettiAnimId); confettiAnimId = null; }
  const canvas = document.getElementById('confettiCanvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/* ======================================================
   BALLOONS
   ====================================================== */
const BALLOON_EMOJIS = ['🎈','🎈','🎈','🎉','🎊','💜','💗','💙','⭐','🌟'];

function startBalloons() {
  balloonTimers.forEach(t => { clearTimeout(t); clearInterval(t); });
  balloonTimers = [];
  const c = document.getElementById('balloonsContainer');
  c.innerHTML = '';
  for (let i = 0; i < 14; i++) {
    const t = setTimeout(() => spawnBalloon(c), i * 600);
    balloonTimers.push(t);
  }
  const rid = setInterval(() => {
    if (!document.getElementById('celebrationScreen').classList.contains('active')) { clearInterval(rid); return; }
    spawnBalloon(c);
  }, 3000);
  balloonTimers.push(rid);
}

function spawnBalloon(c) {
  const b = document.createElement('div');
  b.className = 'balloon';
  b.textContent = BALLOON_EMOJIS[Math.floor(Math.random() * BALLOON_EMOJIS.length)];
  b.style.left = (5 + Math.random() * 90) + '%';
  b.style.fontSize = (32 + Math.random() * 28) + 'px';
  const dur = 7 + Math.random() * 8;
  b.style.animationDuration = dur + 's';
  c.appendChild(b);
  setTimeout(() => b.remove(), dur * 1000 + 200);
}

function stopBalloons() {
  balloonTimers.forEach(t => { clearTimeout(t); clearInterval(t); });
  balloonTimers = [];
  document.getElementById('balloonsContainer').innerHTML = '';
}

/* ======================================================
   STARS
   ====================================================== */
function spawnStars() {
  const c = document.getElementById('starsContainer');
  c.innerHTML = '';
  const pool = ['⭐','🌟','💫','✨','💖','❤️','🩷','💙','💜'];
  for (let i = 0; i < 25; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.textContent = pool[Math.floor(Math.random() * pool.length)];
    s.style.left = (Math.random() * 98) + '%';
    s.style.top  = (Math.random() * 90) + '%';
    s.style.fontSize = (14 + Math.random() * 22) + 'px';
    s.style.animationDelay    = (Math.random() * 4) + 's';
    s.style.animationDuration = (4 + Math.random() * 5) + 's';
    c.appendChild(s);
  }
}

/* ======================================================
   FIREWORKS
   ====================================================== */
const FW_COLORS = ['#ff4ecd','#ffd700','#3b82f6','#22c55e','#f97316','#a855f7','#fff'];

function fireworkBurst() {
  const c  = document.getElementById('fireworksContainer');
  const cx = 15 + Math.random() * 70 + '%';
  const cy = 5  + Math.random() * 45 + '%';
  const color = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'firework-particle';
    const angle = (i / 30) * 2 * Math.PI;
    const dist  = 60 + Math.random() * 80;
    p.style.left = cx; p.style.top = cy;
    p.style.background = color;
    p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    p.style.width = p.style.height = (4 + Math.random() * 5) + 'px';
    p.style.boxShadow = `0 0 6px 2px ${color}`;
    c.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}

function triggerFireworks() {
  fireworkBurst();
  const a = setTimeout(fireworkBurst, 900);
  const b = setTimeout(fireworkBurst, 1900);
  fireworkTimers.push(a, b);
  const rid = setInterval(() => {
    if (!document.getElementById('celebrationScreen').classList.contains('active')) { clearInterval(rid); return; }
    fireworkBurst();
  }, 3500);
  fireworkTimers.push(rid);
}

function stopFireworks() {
  fireworkTimers.forEach(t => { clearTimeout(t); clearInterval(t); });
  fireworkTimers = [];
  document.getElementById('fireworksContainer').innerHTML = '';
}

/* ======================================================
   MAKE A WISH
   ====================================================== */
function makeAWish() {
  const overlay  = document.getElementById('wishOverlay');
  const wishText = document.getElementById('wishOverlayText');
  const starsEl  = document.getElementById('wishStars');
  const randomWish = wishes[Math.floor(Math.random() * wishes.length)];

  wishText.textContent = randomWish;
  starsEl.innerHTML = '';
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('div');
    s.className = 'wish-star-particle';
    s.textContent = ['✨','⭐','🌟','💫'][Math.floor(Math.random() * 4)];
    s.style.left = (10 + Math.random() * 80) + '%';
    s.style.top  = (10 + Math.random() * 80) + '%';
    s.style.setProperty('--wx', ((Math.random() - 0.5) * 180) + 'px');
    s.style.setProperty('--wy', ((Math.random() - 0.5) * 180) + 'px');
    s.style.animationDelay = (Math.random() * 0.5) + 's';
    starsEl.appendChild(s);
  }
  overlay.classList.remove('hidden');

  const resultEl = document.getElementById('wishResult');
  document.getElementById('wishText').textContent = '✨ ' + randomWish;
  resultEl.classList.remove('hidden');

  playSparkle();
}

function closeWishOverlay() { document.getElementById('wishOverlay').classList.add('hidden'); }

function playSparkle() {
  try {
    const ac = getAudioCtx();
    const freqs = [880,1100,1320,1760,2200];
    let t = ac.currentTime;
    freqs.forEach(f => {
      const osc = ac.createOscillator(); const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = f; osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t); osc.stop(t + 0.42); t += 0.07;
    });
  } catch(e) {}
}

/* ======================================================
   SHARE WISH
   ====================================================== */
function shareWish() {
  const rawName = document.getElementById('birthdayName').textContent;
  const msg =
    `🎉 HAPPY BIRTHDAY, ${rawName}! 🎂\n\n` +
    `May your special day be filled with love, laughter, happiness, and unforgettable memories. ` +
    `May all your dreams come true! 🌟\n\n` +
    `Celebrate with this magical birthday page! 🎈`;

  if (navigator.share) {
    navigator.share({ title: `Happy Birthday, ${rawName}! 🎂`, text: msg })
      .catch(() => openWhatsApp(msg));
  } else {
    openWhatsApp(msg);
  }
}

function openWhatsApp(msg) {
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
}

/* ======================================================
   RESET
   ====================================================== */
function resetCelebration() {
  stopConfetti();
  stopBalloons();
  stopFireworks();
  stopSong();
  closeWishOverlay();
  closeBlownOverlay();

  shakeListening = false;
  candlesBlown   = false;

  updateMusicBtn(false);
  document.getElementById('starsContainer').innerHTML     = '';
  document.getElementById('fireworksContainer').innerHTML = '';
  document.getElementById('wishResult').classList.add('hidden');
  document.getElementById('candlesBlownMsg').classList.add('hidden');
  document.getElementById('shakeHint').classList.remove('hidden');

  document.getElementById('celebrationScreen').classList.remove('active');
  document.getElementById('welcomeScreen').classList.add('active');

  const inp = document.getElementById('nameInput');
  inp.value = '';
  inp.focus();
}

/* ======================================================
   KEYBOARD & INIT
   ====================================================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') startCelebration();
  });

  // Preload voices (some browsers are async)
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => window.speechSynthesis.getVoices());
  }

  // Resume AudioContext on first touch/click (browser policy)
  document.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }, { once: false });
});
