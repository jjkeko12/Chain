/* CHAIN - QTE FIGHT
 * Recreates Roblox Chain final fight QTEs
 * Configurable shake & moving
 */

const DEFAULT_CONFIG = {
  shakeIntensity: 60, // 0-100
  shakeEnabled: true,
  moveIntensity: 50, // 0-100
  moveEnabled: true,
  qteTime: 1500, // ms
  difficulty: 'normal',
  rounds: 10,
  soundEnabled: true,
};

const DIFFICULTY_MODS = {
  easy:   { timeMul: 1.6, playerDmg: 8, chainDmgMul: 1.2, moveMul: 0.6, shakeMul: 0.6 },
  normal: { timeMul: 1.0, playerDmg: 12, chainDmgMul: 1.0, moveMul: 1.0, shakeMul: 1.0 },
  hard:   { timeMul: 0.7, playerDmg: 18, chainDmgMul: 0.85, moveMul: 1.4, shakeMul: 1.3 },
  chain:  { timeMul: 0.45, playerDmg: 25, chainDmgMul: 0.7, moveMul: 2.0, shakeMul: 2.0 },
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// --- State ---
let config = { ...DEFAULT_CONFIG };
let gameState = {
  playing: false,
  playerHP: 100,
  chainHP: 100,
  score: 0,
  streak: 0,
  bestStreak: 0,
  round: 1,
  totalRounds: 10,
  successes: 0,
  failures: 0,
  currentLetter: null,
  qteActive: false,
  qteStartTime: 0,
  qteTimeout: null,
  qteRAF: null,
  moveRAF: null,
};

let audioCtx = null;

// --- DOM ---
const $ = s => document.querySelector(s);
const menuScreen = $('#menu-screen');
const gameScreen = $('#game-screen');
const resultScreen = $('#result-screen');
const arena = $('#arena');
const qteContainer = $('#qte-container');
const chainEntity = $('#chain-entity');
const feedbackEl = $('#feedback');

const playerHpFill = $('#player-hp-fill');
const chainHpFill = $('#chain-hp-fill');
const playerHpText = $('#player-hp-text');
const chainHpText = $('#chain-hp-text');
const streakEl = $('#streak');
const scoreEl = $('#score');
const roundEl = $('#round');

// modals
const settingsModal = $('#settings-modal');
const howtoModal = $('#howto-modal');

// --- Config Load/Save ---
function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('chain-qte-config'));
    if (saved) config = { ...DEFAULT_CONFIG, ...saved };
  } catch {}
}
function saveConfig() {
  localStorage.setItem('chain-qte-config', JSON.stringify(config));
}

function applyConfigToUI() {
  $('#shake-intensity').value = config.shakeIntensity;
  $('#shake-value').textContent = config.shakeIntensity + '%';
  $('#shake-enabled').checked = config.shakeEnabled;

  $('#move-intensity').value = config.moveIntensity;
  $('#move-value').textContent = config.moveIntensity + '%';
  $('#move-enabled').checked = config.moveEnabled;

  $('#qte-time').value = config.qteTime;
  $('#time-value').textContent = (config.qteTime/1000).toFixed(1) + 's';

  $('#difficulty').value = config.difficulty;
  $('#diff-value').textContent = config.difficulty.toUpperCase();

  $('#rounds').value = config.rounds;
  $('#rounds-value').textContent = config.rounds;
  $('#howto-rounds').textContent = config.rounds;

  $('#sound-enabled').checked = config.soundEnabled;

  renderKeysPreview();
}

function renderKeysPreview() {
  const c = $('#keys-preview');
  c.innerHTML = '';
  LETTERS.forEach(l => {
    const s = document.createElement('span');
    s.textContent = l;
    c.appendChild(s);
  });
}

// --- Audio ---
function ensureAudio() {
  if (!config.soundEnabled) return null;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(freq, dur, type='sine', vol=0.2) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(ctx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.stop(ctx.currentTime + dur);
}
function sfxSuccess() { playTone(800, 0.15, 'sine', 0.3); setTimeout(()=>playTone(1200,0.2,'sine',0.25),80); }
function sfxFail() { playTone(150,0.4,'sawtooth',0.3); setTimeout(()=>playTone(80,0.4,'sawtooth',0.3),100); }
function sfxSpawn() { playTone(400,0.08,'square',0.15); }
function sfxTick() { playTone(1000,0.04,'sine',0.08); }

// --- Screen Shake ---
function triggerScreenShake(intensity = 10) {
  const app = $('#app');
  app.style.setProperty('--screen-shake', intensity + 'px');
  app.classList.remove('shake-screen');
  void app.offsetWidth;
  app.classList.add('shake-screen');
  setTimeout(()=>app.classList.remove('shake-screen'), 350);
}

// --- Game Flow ---
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  if (name==='menu') menuScreen.classList.add('active');
  if (name==='game') gameScreen.classList.add('active');
  if (name==='result') resultScreen.classList.add('active');
}

function resetGame() {
  gameState.playerHP = 100;
  gameState.chainHP = 100;
  gameState.score = 0;
  gameState.streak = 0;
  gameState.bestStreak = 0;
  gameState.round = 1;
  gameState.totalRounds = config.rounds;
  gameState.successes = 0;
  gameState.failures = 0;
  updateHUD();
  qteContainer.innerHTML = '';
}

function startGame() {
  resetGame();
  gameState.playing = true;
  showScreen('game');
  setTimeout(spawnQTE, 600);
}

function endGame(win) {
  gameState.playing = false;
  clearTimeout(gameState.qteTimeout);
  cancelAnimationFrame(gameState.qteRAF);
  cancelAnimationFrame(gameState.moveRAF);
  qteContainer.innerHTML = '';

  const title = $('#result-title');
  const desc = $('#result-desc');
  const finalScore = $('#final-score');
  const bestStreak = $('#best-streak');
  const accuracy = $('#accuracy');

  finalScore.textContent = gameState.score;
  bestStreak.textContent = gameState.bestStreak;
  const total = gameState.successes + gameState.failures;
  const acc = total ? Math.round((gameState.successes/total)*100) : 0;
  accuracy.textContent = acc + '%';

  if (win) {
    title.textContent = 'YOU ESCAPED';
    title.className = 'result-title win';
    desc.textContent = `You survived Chain's onslaught. ${gameState.successes} correct presses, ${gameState.failures} mistakes. The chains are broken... for now.`;
    playTone(523,0.3,'sine',0.3); setTimeout(()=>playTone(659,0.3,'sine',0.3),150); setTimeout(()=>playTone(784,0.6,'sine',0.3),300);
  } else {
    title.textContent = 'CHAINED';
    title.className = 'result-title lose';
    desc.textContent = `Chain took you. You lasted ${gameState.round} rounds with ${gameState.successes} successful defends. Don't let him shake you next time.`;
    sfxFail();
  }

  showScreen('result');
}

function updateHUD() {
  playerHpFill.style.width = Math.max(0, gameState.playerHP) + '%';
  chainHpFill.style.width = Math.max(0, gameState.chainHP) + '%';
  playerHpText.textContent = Math.max(0, Math.round(gameState.playerHP)) + '%';
  chainHpText.textContent = Math.max(0, Math.round(gameState.chainHP)) + '%';
  streakEl.textContent = gameState.streak;
  scoreEl.textContent = gameState.score;
  roundEl.textContent = `${Math.min(gameState.successes+1, gameState.totalRounds)}/${gameState.totalRounds}`;

  // chain entity low hp visual
  if (gameState.chainHP < 30) chainEntity.style.filter = 'brightness(1.5) hue-rotate(-20deg)';
  else chainEntity.style.filter = '';
}

// --- QTE Logic ---
let qteMoveState = null;

function spawnQTE() {
  if (!gameState.playing) return;

  const diff = DIFFICULTY_MODS[config.difficulty] || DIFFICULTY_MODS.normal;

  // pick random letter A-Z
  const letter = LETTERS[Math.floor(Math.random()*LETTERS.length)];
  gameState.currentLetter = letter;
  gameState.qteActive = true;
  gameState.qteStartTime = performance.now();

  const timeWindow = config.qteTime * diff.timeMul;

  // build prompt element
  qteContainer.innerHTML = '';
  const prompt = document.createElement('div');
  prompt.className = 'qte-prompt';
  prompt.innerHTML = `
    <div class="qte-timer-bg"></div>
    <div class="qte-timer"></div>
    <div class="qte-letter">${letter}</div>
    <div class="qte-key-hint">PRESS ${letter}</div>
  `;
  qteContainer.appendChild(prompt);

  // shake setup
  if (config.shakeEnabled) {
    const shakeBase = (config.shakeIntensity / 100) * 12 * diff.shakeMul; // px
    const shakeDur = Math.max(0.05, 0.25 - (config.shakeIntensity/100)*0.15);
    prompt.style.setProperty('--shake-x', shakeBase + 'px');
    prompt.style.setProperty('--shake-y', (shakeBase*0.6) + 'px');
    prompt.style.setProperty('--shake-dur', shakeDur + 's');
    prompt.classList.add('shake');
  }

  // moving setup - random start pos + velocity
  const arenaRect = arena.getBoundingClientRect();
  const promptSize = 140;
  let x, y;

  if (config.moveEnabled) {
    // random pos within arena, not too close to edge
    const pad = 20;
    const maxX = arena.clientWidth - promptSize - pad*2;
    const maxY = arena.clientHeight - promptSize - pad*2;
    x = pad + Math.random()*Math.max(10,maxX);
    y = pad + Math.random()*Math.max(10,maxY);
    // velocity based on intensity
    const speedBase = (config.moveIntensity/100) * 3.5 * diff.moveMul + 0.3; // px per frame
    const angle = Math.random()*Math.PI*2;
    qteMoveState = {
      x, y,
      vx: Math.cos(angle)*speedBase,
      vy: Math.sin(angle)*speedBase,
      maxX: arena.clientWidth - promptSize,
      maxY: arena.clientHeight - promptSize,
    };
    prompt.style.left = x + 'px';
    prompt.style.top = y + 'px';
    prompt.style.transform = 'none';
    startMovingLoop(prompt);
  } else {
    prompt.style.left = '50%';
    prompt.style.top = '50%';
    prompt.style.transform = 'translate(-50%,-50%)';
    qteMoveState = null;
  }

  // timer animation
  const timerEl = prompt.querySelector('.qte-timer');
  let lastTick = 0;
  function tick(now) {
    if (!gameState.qteActive) return;
    const elapsed = now - gameState.qteStartTime;
    const progress = Math.min(1, elapsed / timeWindow);
    const deg = 360 * progress;
    // rotate timer to show remaining (shrink)
    // we do border rotation: actually we want full circle shrinking -> use conic? Simple rotate
    timerEl.style.transform = `rotate(${-90 + deg}deg)`;
    timerEl.style.borderTopColor = progress > 0.7 ? '#ff1a1a' : progress > 0.4 ? '#ffaa00' : '#ff1a1a';
    // tick sound near end
    if (progress > 0.6 && now - lastTick > 150) {
      sfxTick();
      lastTick = now;
      if (config.shakeEnabled && progress > 0.75) {
        triggerScreenShake((config.shakeIntensity/100)*2);
      }
    }
    if (progress >= 1) {
      handleQTEFail('TIMEOUT');
      return;
    }
    gameState.qteRAF = requestAnimationFrame(tick);
  }
  gameState.qteRAF = requestAnimationFrame(tick);

  // fail timeout backup
  clearTimeout(gameState.qteTimeout);
  gameState.qteTimeout = setTimeout(()=> {
    if (gameState.qteActive) handleQTEFail('TIMEOUT');
  }, timeWindow + 50);

  sfxSpawn();
  chainEntity.classList.add('attack');
  setTimeout(()=>chainEntity.classList.remove('attack'), 300);
}

function startMovingLoop(promptEl) {
  cancelAnimationFrame(gameState.moveRAF);
  function move() {
    if (!gameState.qteActive || !qteMoveState) return;
    let { x, y, vx, vy, maxX, maxY } = qteMoveState;
    x += vx;
    y += vy;
    // bounce
    if (x <= 0 || x >= maxX) { vx *= -1; x = Math.max(0, Math.min(maxX, x)); }
    if (y <= 0 || y >= maxY) { vy *= -1; y = Math.max(0, Math.min(maxY, y)); }
    // occasional random jitter based on intensity
    if (Math.random() < 0.02) {
      vx += (Math.random()-0.5)*0.5;
      vy += (Math.random()-0.5)*0.5;
      const speed = Math.hypot(vx, vy);
      const maxSpeed = (config.moveIntensity/100)*4 + 0.5;
      if (speed > maxSpeed) {
        vx = (vx/speed)*maxSpeed;
        vy = (vy/speed)*maxSpeed;
      }
    }
    qteMoveState.x = x; qteMoveState.y = y; qteMoveState.vx = vx; qteMoveState.vy = vy;
    promptEl.style.left = x + 'px';
    promptEl.style.top = y + 'px';
    gameState.moveRAF = requestAnimationFrame(move);
  }
  gameState.moveRAF = requestAnimationFrame(move);
}

function showFeedback(text, success) {
  feedbackEl.textContent = text;
  feedbackEl.className = 'feedback show ' + (success ? 'success' : 'fail');
  setTimeout(()=>{ feedbackEl.className = 'feedback'; }, 700);
}

function handleQTESuccess() {
  if (!gameState.qteActive) return;
  gameState.qteActive = false;
  clearTimeout(gameState.qteTimeout);
  cancelAnimationFrame(gameState.qteRAF);
  cancelAnimationFrame(gameState.moveRAF);

  const diff = DIFFICULTY_MODS[config.difficulty];
  const timeLeft = (config.qteTime*diff.timeMul) - (performance.now() - gameState.qteStartTime);
  const timeBonus = Math.max(0, Math.floor(timeLeft / 10));

  gameState.successes++;
  gameState.streak++;
  gameState.bestStreak = Math.max(gameState.bestStreak, gameState.streak);
  gameState.score += 100 + timeBonus + (gameState.streak*10);

  const chainDmg = (100 / gameState.totalRounds) * diff.chainDmgMul;
  gameState.chainHP = Math.max(0, gameState.chainHP - chainDmg);

  // visual
  const prompt = qteContainer.querySelector('.qte-prompt');
  if (prompt) prompt.classList.add('success');
  showFeedback(['PERFECT!','NICE!','HIT!','BLOCKED!'][Math.floor(Math.random()*4)], true);
  chainEntity.classList.add('hit');
  setTimeout(()=>chainEntity.classList.remove('hit'), 250);
  sfxSuccess();
  updateHUD();

  if (gameState.chainHP <= 0 || gameState.successes >= gameState.totalRounds) {
    setTimeout(()=>endGame(true), 600);
  } else {
    const nextDelay = config.difficulty === 'chain' ? 200 : config.difficulty === 'hard' ? 350 : 600;
    setTimeout(spawnQTE, nextDelay);
  }
}

function handleQTEFail(reason) {
  if (!gameState.qteActive) return;
  gameState.qteActive = false;
  clearTimeout(gameState.qteTimeout);
  cancelAnimationFrame(gameState.qteRAF);
  cancelAnimationFrame(gameState.moveRAF);

  const diff = DIFFICULTY_MODS[config.difficulty];

  gameState.failures++;
  gameState.streak = 0;
  gameState.playerHP = Math.max(0, gameState.playerHP - diff.playerDmg);

  const prompt = qteContainer.querySelector('.qte-prompt');
  if (prompt) prompt.classList.add('fail');

  showFeedback(reason === 'TIMEOUT' ? 'TOO SLOW!' : 'WRONG!', false);
  sfxFail();

  const shakeAmt = (config.shakeEnabled ? (config.shakeIntensity/100)*18 : 6) * diff.shakeMul;
  triggerScreenShake(shakeAmt);
  arena.style.background = 'rgba(255,0,0,0.1)';
  setTimeout(()=>arena.style.background='', 150);

  updateHUD();

  if (gameState.playerHP <= 0) {
    setTimeout(()=>endGame(false), 600);
  } else {
    setTimeout(spawnQTE, 700);
  }
}

// --- Input ---
function handleKeyPress(e) {
  if (!gameState.playing || !gameState.qteActive) return;
  // only A-Z, ignore space and symbols
  const key = e.key.toUpperCase();
  if (key.length !== 1) return; // ignore shift, etc
  if (!LETTERS.includes(key)) return; // ignore space, symbols
  // prevent default
  e.preventDefault();

  if (key === gameState.currentLetter) {
    handleQTESuccess();
  } else {
    // In original Chain, wrong key counts as fail? We'll count as fail but not consume? Let's make wrong = fail.
    handleQTEFail('WRONG');
  }
}

// --- UI Events ---
function bindUI() {
  // menu
  $('#play-btn').addEventListener('click', startGame);
  $('#settings-btn').addEventListener('click', ()=>settingsModal.classList.add('active'));
  $('#howto-btn').addEventListener('click', ()=>howtoModal.classList.add('active'));

  $('#settings-close').addEventListener('click', ()=> {
    settingsModal.classList.remove('active');
    saveConfig();
  });
  $('#settings-reset').addEventListener('click', ()=> {
    config = { ...DEFAULT_CONFIG };
    applyConfigToUI();
    saveConfig();
  });
  $('#howto-close').addEventListener('click', ()=>howtoModal.classList.remove('active'));
  $('#retry-btn').addEventListener('click', startGame);
  $('#menu-return-btn').addEventListener('click', ()=>showScreen('menu'));

  // close modals on backdrop
  settingsModal.addEventListener('click', (e)=>{ if(e.target===settingsModal) settingsModal.classList.remove('active'); });
  howtoModal.addEventListener('click', (e)=>{ if(e.target===howtoModal) howtoModal.classList.remove('active'); });

  // settings inputs
  $('#shake-intensity').addEventListener('input', (e)=>{
    config.shakeIntensity = parseInt(e.target.value);
    $('#shake-value').textContent = config.shakeIntensity + '%';
  });
  $('#shake-enabled').addEventListener('change', (e)=>{ config.shakeEnabled = e.target.checked; });
  $('#move-intensity').addEventListener('input', (e)=>{
    config.moveIntensity = parseInt(e.target.value);
    $('#move-value').textContent = config.moveIntensity + '%';
  });
  $('#move-enabled').addEventListener('change', (e)=>{ config.moveEnabled = e.target.checked; });
  $('#qte-time').addEventListener('input', (e)=>{
    config.qteTime = parseInt(e.target.value);
    $('#time-value').textContent = (config.qteTime/1000).toFixed(1) + 's';
  });
  $('#difficulty').addEventListener('change', (e)=>{
    config.difficulty = e.target.value;
    $('#diff-value').textContent = config.difficulty.toUpperCase();
  });
  $('#rounds').addEventListener('input', (e)=>{
    config.rounds = parseInt(e.target.value);
    $('#rounds-value').textContent = config.rounds;
    $('#howto-rounds').textContent = config.rounds;
  });
  $('#sound-enabled').addEventListener('change', (e)=>{ config.soundEnabled = e.target.checked; });

  // keyboard
  window.addEventListener('keydown', handleKeyPress);

  // prevent space scrolling etc during game
  window.addEventListener('keydown', (e)=>{
    if ([' ', 'Spacebar'].includes(e.key) && gameState.playing) e.preventDefault();
  });
}

// --- Init ---
loadConfig();
applyConfigToUI();
bindUI();
showScreen('menu');

// dev log
console.log('CHAIN QTE Ready - Config:', config);
