/* CHAIN - BAR QTE SIMPLIFIED
 * No health bars, miss count 0/3, centered, realistic boxes, shake kept
 */

const DEFAULT_CONFIG = {
  shakeIntensity: 65,
  shakeEnabled: true,
  maxMisses: 3,
  holdDuration: 4000,
  drainSpeed: 35,
  fillAmount: 12,
  difficulty: 'normal',
  rounds: 10,
  restTime: 1500,
  soundEnabled: true,
};

const DIFFICULTY_MODS = {
  easy:   { drainMul: 0.6, fillMul: 1.5, holdMul: 0.85, shakeMul: 0.6 },
  normal: { drainMul: 1.0, fillMul: 1.0, holdMul: 1.0,  shakeMul: 1.0 },
  hard:   { drainMul: 1.45, fillMul: 0.8, holdMul: 1.2,  shakeMul: 1.4 },
  chain:  { drainMul: 2.05, fillMul: 0.6, holdMul: 1.4,  shakeMul: 2.0 },
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let config = { ...DEFAULT_CONFIG };
let gameState = {
  playing: false,
  misses: 0,
  maxMisses: 3,
  score: 0,
  streak: 0,
  bestStreak: 0,
  round: 1,
  totalRounds: 10,
  successes: 0,
  failures: 0,
  currentLetter: null,
  barValue: 55,
  qteActive: false,
  qteStartTime: 0,
  holdDuration: 4000,
  drainPerSec: 35,
  fillPerPress: 12,
  spamsThisRound: 0,
  totalSpams: 0,
  avgBarSum: 0,
  avgBarCount: 0,
  lastPressTime: 0,
  raf: null,
  intermissionTimer: null,
};

let audioCtx = null;
const $ = s => document.querySelector(s);

const menuScreen = $('#menu-screen');
const gameScreen = $('#game-screen');
const resultScreen = $('#result-screen');
const qteContainer = $('#qte-container');
const feedbackEl = $('#feedback');
const intermissionEl = $('#intermission');
const intermissionTimeEl = $('#intermission-time');

const missDotsEl = $('#miss-dots');
const missCountEl = $('#miss-count');
const missMaxEl = $('#miss-max');
const roundEl = $('#round');
const streakEl = $('#streak');
const spamsEl = $('#spams');

const settingsModal = $('#settings-modal');
const howtoModal = $('#howto-modal');

// Config
function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('chain-qte-config-v3'));
    if (saved) config = { ...DEFAULT_CONFIG, ...saved };
  } catch {}
  // migrate older
  try {
    const v2 = JSON.parse(localStorage.getItem('chain-qte-config-v2'));
    if (v2 && !localStorage.getItem('chain-qte-config-v3')) {
      config.shakeIntensity = v2.shakeIntensity ?? config.shakeIntensity;
      config.shakeEnabled = v2.shakeEnabled ?? config.shakeEnabled;
      config.holdDuration = v2.holdDuration ?? config.holdDuration;
      config.drainSpeed = v2.drainSpeed ?? config.drainSpeed;
      config.fillAmount = v2.fillAmount ?? config.fillAmount;
      config.difficulty = v2.difficulty ?? config.difficulty;
      config.rounds = v2.rounds ?? config.rounds;
      config.restTime = v2.restTime ?? config.restTime;
      config.soundEnabled = v2.soundEnabled ?? config.soundEnabled;
    }
  } catch {}
}
function saveConfig() { localStorage.setItem('chain-qte-config-v3', JSON.stringify(config)); }
function applyConfigToUI() {
  $('#shake-intensity').value = config.shakeIntensity;
  $('#shake-value').textContent = config.shakeIntensity + '%';
  $('#shake-enabled').checked = config.shakeEnabled;
  $('#max-misses').value = config.maxMisses;
  $('#maxmiss-value').textContent = config.maxMisses;
  $('#hold-duration').value = config.holdDuration;
  $('#hold-value').textContent = (config.holdDuration/1000).toFixed(1)+'s';
  $('#drain-speed').value = config.drainSpeed;
  $('#drain-value').textContent = config.drainSpeed+'%';
  $('#fill-amount').value = config.fillAmount;
  $('#fill-value').textContent = config.fillAmount+'%';
  $('#difficulty').value = config.difficulty;
  $('#diff-value').textContent = config.difficulty.toUpperCase();
  $('#rounds').value = config.rounds;
  $('#rounds-value').textContent = config.rounds;
  $('#rest-time').value = config.restTime;
  $('#rest-value').textContent = (config.restTime/1000).toFixed(1)+'s';
  $('#sound-enabled').checked = config.soundEnabled;
  $('#howto-hold').textContent = (config.holdDuration/1000).toFixed(1)+'s';
  $('#howto-rounds').textContent = config.rounds;
  $('#howto-miss').textContent = config.maxMisses;
  renderKeysPreview();
}
function renderKeysPreview() {
  const c = $('#keys-preview'); c.innerHTML='';
  LETTERS.forEach(l=>{ const s=document.createElement('span'); s.textContent=l; c.appendChild(s); });
}

// Audio
function ensureAudio() {
  if (!config.soundEnabled) return null;
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  if (audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(freq,dur,type='sine',vol=0.2){
  const ctx=ensureAudio(); if(!ctx) return;
  const o=ctx.createOscillator(); const g=ctx.createGain();
  o.type=type; o.frequency.value=freq; g.gain.value=vol;
  o.connect(g); g.connect(ctx.destination);
  o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur); o.stop(ctx.currentTime+dur);
}
function sfxSpam(){ playTone(620+Math.random()*180,0.07,'square',0.14); }
function sfxSpamGood(){ playTone(920,0.11,'sine',0.2); }
function sfxWarn(){ playTone(130,0.18,'sawtooth',0.13); }
function sfxSuccess(){ playTone(800,0.14,'sine',0.28); setTimeout(()=>playTone(1200,0.22,'sine',0.22),70); }
function sfxFail(){ playTone(160,0.35,'sawtooth',0.28); setTimeout(()=>playTone(80,0.45,'sawtooth',0.28),110); }
function sfxSpawn(){ playTone(380,0.1,'triangle',0.18); }

function triggerScreenShake(intensity=8){
  const app=$('#app');
  app.style.setProperty('--screen-shake', intensity+'px');
  app.classList.remove('shake-screen'); void app.offsetWidth; app.classList.add('shake-screen');
  setTimeout(()=>app.classList.remove('shake-screen'), 260);
}

// Screens
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  if(name==='menu') menuScreen.classList.add('active');
  if(name==='game') gameScreen.classList.add('active');
  if(name==='result') resultScreen.classList.add('active');
}

function resetGame(){
  gameState.misses=0;
  gameState.maxMisses=config.maxMisses;
  gameState.score=0;
  gameState.streak=0;
  gameState.bestStreak=0;
  gameState.round=1;
  gameState.totalRounds=config.rounds;
  gameState.successes=0;
  gameState.failures=0;
  gameState.totalSpams=0;
  gameState.avgBarSum=0;
  gameState.avgBarCount=0;
  updateHUD();
  qteContainer.innerHTML='';
  intermissionEl.classList.remove('show');
}

function startGame(){
  resetGame();
  gameState.playing=true;
  showScreen('game');
  setTimeout(spawnQTE, 500);
}

function endGame(win){
  gameState.playing=false;
  cancelAnimationFrame(gameState.raf);
  clearInterval(gameState.intermissionTimer);
  qteContainer.innerHTML='';
  intermissionEl.classList.remove('show');

  const title=$('#result-title');
  const desc=$('#result-desc');
  $('#final-misses').textContent=`${gameState.misses}/${gameState.maxMisses}`;
  $('#best-streak').textContent=gameState.bestStreak;
  $('#total-spams').textContent=gameState.totalSpams;
  const avg = gameState.avgBarCount ? Math.round(gameState.avgBarSum/gameState.avgBarCount) : 0;
  $('#accuracy').textContent=avg+'%';

  if(win){
    title.textContent='YOU ESCAPED';
    title.className='result-title win';
    desc.textContent=`You survived ${gameState.successes} rounds with only ${gameState.misses} miss${gameState.misses!==1?'es':''}. ${gameState.totalSpams} spams kept the bar alive.`;
    sfxSuccess();
  }else{
    title.textContent='CHAINED';
    title.className='result-title lose';
    desc.textContent=`Missed ${gameState.misses}/${gameState.maxMisses}. You held ${gameState.successes} rounds. The bar drained you.`;
    sfxFail();
  }
  showScreen('result');
}

function updateHUD(){
  // miss dots
  missDotsEl.innerHTML='';
  for(let i=0;i<gameState.maxMisses;i++){
    const dot=document.createElement('div');
    dot.className='miss-dot'+(i < gameState.misses ? ' filled' : '');
    missDotsEl.appendChild(dot);
  }
  missCountEl.textContent=gameState.misses;
  missMaxEl.textContent=gameState.maxMisses;
  roundEl.textContent=`${Math.min(gameState.successes+gameState.failures+1, gameState.totalRounds)}/${gameState.totalRounds}`;
  streakEl.textContent=gameState.streak;
  spamsEl.textContent=gameState.spamsThisRound;
}

// QTE - centered realistic boxes
let lastFrameTime=0;
let lastShakeTime=0;

function spawnQTE(){
  if(!gameState.playing) return;
  const diff = DIFFICULTY_MODS[config.difficulty] || DIFFICULTY_MODS.normal;

  const letter = LETTERS[Math.floor(Math.random()*LETTERS.length)];
  gameState.currentLetter=letter;
  gameState.barValue=55;
  gameState.spamsThisRound=0;
  gameState.qteActive=true;
  gameState.qteStartTime=performance.now();
  gameState.holdDuration=config.holdDuration * diff.holdMul;
  gameState.drainPerSec=config.drainSpeed * diff.drainMul;
  gameState.fillPerPress=config.fillAmount * diff.fillMul;

  qteContainer.innerHTML='';

  // Key box - realistic
  const keyBox=document.createElement('div');
  keyBox.className='qte-key-box';
  keyBox.innerHTML=`
    <div class="bolt-bl"></div><div class="bolt-br"></div>
    <div class="wear"></div>
    <div class="qte-key-label">SPAM KEY</div>
    <div class="qte-key-letter" id="qte-letter">${letter}</div>
    <div class="qte-key-hint">MASH ${letter}</div>
  `;

  // Bar box - realistic
  const barBox=document.createElement('div');
  barBox.className='qte-bar-box';
  barBox.innerHTML=`
    <div class="bolt-bl"></div><div class="bolt-br"></div>
    <div class="wear"></div>
    <div class="qte-bar-header">
      <span class="qte-bar-title">HOLD BAR</span>
      <span class="qte-bar-time" id="qte-time">${(gameState.holdDuration/1000).toFixed(1)}s</span>
    </div>
    <div class="qte-bar-track">
      <div class="qte-bar-fill" id="qte-fill" style="width:${gameState.barValue}%"></div>
      <div class="qte-bar-segments"><div></div><div></div><div></div><div></div></div>
    </div>
    <div class="qte-bar-footer"><span>EMPTY</span><span>CRITICAL</span><span>SAFE</span></div>
    <div class="qte-bar-hint" id="bar-hint">KEEP IT ALIVE - SPAM ${letter}</div>
  `;

  qteContainer.appendChild(keyBox);
  qteContainer.appendChild(barBox);

  const fillEl=barBox.querySelector('#qte-fill');
  const timeEl=barBox.querySelector('#qte-time');

  // shake setup - both boxes
  if(config.shakeEnabled){
    const shakeBase=(config.shakeIntensity/100)*10*diff.shakeMul;
    const shakeDur=Math.max(0.06, 0.16 - (config.shakeIntensity/100)*0.08);
    [keyBox, barBox].forEach(el=>{
      el.style.setProperty('--shake-x', shakeBase+'px');
      el.style.setProperty('--shake-y', (shakeBase*0.6)+'px');
      el.style.setProperty('--shake-dur', shakeDur+'s');
      el.classList.add('shake-real');
    });
  }

  lastFrameTime=performance.now();
  lastShakeTime=performance.now();
  sfxSpawn();

  function loop(now){
    if(!gameState.qteActive) return;
    const delta = now - lastFrameTime;
    lastFrameTime=now;
    gameState.qteElapsed = now - gameState.qteStartTime;
    const remaining = Math.max(0, gameState.holdDuration - gameState.qteElapsed);

    const drainAmount = (gameState.drainPerSec/1000)*delta;
    gameState.barValue = Math.max(0, gameState.barValue - drainAmount);

    gameState.avgBarSum+=gameState.barValue;
    gameState.avgBarCount++;

    fillEl.style.width=gameState.barValue+'%';
    if(gameState.barValue<25){
      fillEl.className='qte-bar-fill';
      keyBox.classList.add('critical'); barBox.classList.add('critical');
      if(now - lastShakeTime > 160){
        triggerScreenShake((config.shakeEnabled? (config.shakeIntensity/100)*12 : 4)*diff.shakeMul);
        if(Math.random()<0.7) sfxWarn();
        lastShakeTime=now;
      }
    }else if(gameState.barValue<55){
      fillEl.className='qte-bar-fill';
      keyBox.classList.remove('critical'); barBox.classList.remove('critical');
    }else if(gameState.barValue<78){
      fillEl.className='qte-bar-fill good';
      keyBox.classList.remove('critical'); barBox.classList.remove('critical');
    }else{
      fillEl.className='qte-bar-fill great';
      keyBox.classList.remove('critical'); barBox.classList.remove('critical');
    }

    timeEl.textContent=(remaining/1000).toFixed(1)+'s';
    if(remaining<1000) timeEl.classList.add('low'); else timeEl.classList.remove('low');

    if(config.shakeEnabled && now - lastShakeTime > 280 + Math.random()*300){
      const shakeAmt=(config.shakeIntensity/100)*7*diff.shakeMul;
      triggerScreenShake(shakeAmt);
      lastShakeTime=now;
    }

    if(gameState.barValue<=0){ handleFail(); return; }
    if(gameState.qteElapsed>=gameState.holdDuration){ handleSuccess(); return; }

    gameState.raf=requestAnimationFrame(loop);
  }
  gameState.raf=requestAnimationFrame(loop);
}

function showFeedback(text, success){
  feedbackEl.textContent=text;
  feedbackEl.className='feedback show '+(success?'success':'fail');
  setTimeout(()=>{ feedbackEl.className='feedback'; }, 750);
}

function handleSuccess(){
  if(!gameState.qteActive) return;
  gameState.qteActive=false;
  cancelAnimationFrame(gameState.raf);

  gameState.successes++;
  gameState.streak++;
  gameState.bestStreak=Math.max(gameState.bestStreak, gameState.streak);
  gameState.score+= 150 + Math.floor(gameState.barValue*2) + gameState.spamsThisRound*3 + gameState.streak*15;

  const keyBox=qteContainer.querySelector('.qte-key-box');
  const barBox=qteContainer.querySelector('.qte-bar-box');
  if(keyBox) keyBox.classList.add('success');
  if(barBox) barBox.classList.add('success');

  showFeedback(['HELD!','SURVIVED!','KEPT!','STRONG!'][Math.floor(Math.random()*4)], true);
  sfxSuccess();
  updateHUD();

  if(gameState.successes>=gameState.totalRounds){
    setTimeout(()=>endGame(true), 650);
  }else{
    startIntermission();
  }
}

function handleFail(){
  if(!gameState.qteActive) return;
  gameState.qteActive=false;
  cancelAnimationFrame(gameState.raf);

  gameState.failures++;
  gameState.misses++;
  gameState.streak=0;

  const keyBox=qteContainer.querySelector('.qte-key-box');
  const barBox=qteContainer.querySelector('.qte-bar-box');
  if(keyBox) keyBox.classList.add('fail');
  if(barBox) barBox.classList.add('fail');

  showFeedback('MISSED!', false);
  sfxFail();
  const diff=DIFFICULTY_MODS[config.difficulty];
  const shakeAmt=(config.shakeEnabled? (config.shakeIntensity/100)*18 : 6)*diff.shakeMul;
  triggerScreenShake(shakeAmt);
  updateHUD();

  if(gameState.misses>=gameState.maxMisses){
    setTimeout(()=>endGame(false), 650);
  }else{
    startIntermission(true);
  }
}

function startIntermission(){
  qteContainer.innerHTML='';
  intermissionEl.classList.add('show');
  let remaining=config.restTime;
  intermissionTimeEl.textContent=(remaining/1000).toFixed(1);
  const start=performance.now();
  clearInterval(gameState.intermissionTimer);
  gameState.intermissionTimer=setInterval(()=>{
    const elapsed=performance.now()-start;
    remaining=Math.max(0, config.restTime - elapsed);
    intermissionTimeEl.textContent=(remaining/1000).toFixed(1);
    if(remaining<=0){
      clearInterval(gameState.intermissionTimer);
      intermissionEl.classList.remove('show');
      gameState.round++;
      spawnQTE();
    }
  }, 50);
}

function handleKeyPress(e){
  if(!gameState.playing || !gameState.qteActive) return;
  const key=e.key.toUpperCase();
  if(key.length!==1) return;
  if(!LETTERS.includes(key)) return;
  e.preventDefault();
  const now=performance.now();
  if(now - gameState.lastPressTime < 32) return;
  gameState.lastPressTime=now;

  if(key===gameState.currentLetter){
    gameState.barValue=Math.min(100, gameState.barValue + gameState.fillPerPress);
    gameState.spamsThisRound++;
    gameState.totalSpams++;
    updateHUD();
    const letterEl=$('#qte-letter');
    if(letterEl){ letterEl.classList.remove('pulse'); void letterEl.offsetWidth; letterEl.classList.add('pulse'); }
    const fillEl=$('#qte-fill');
    if(fillEl){ fillEl.style.transform='scaleY(1.12)'; setTimeout(()=>fillEl.style.transform='',70); }
    if(gameState.barValue>72) sfxSpamGood(); else sfxSpam();
  }else{
    gameState.barValue=Math.max(0, gameState.barValue - 6);
    triggerScreenShake(4);
    showFeedback('WRONG!', false);
    playTone(100,0.09,'square',0.11);
  }
}

function bindUI(){
  $('#play-btn').addEventListener('click', startGame);
  $('#settings-btn').addEventListener('click', ()=>settingsModal.classList.add('active'));
  $('#howto-btn').addEventListener('click', ()=>howtoModal.classList.add('active'));
  $('#settings-close').addEventListener('click', ()=>{ settingsModal.classList.remove('active'); saveConfig(); });
  $('#settings-reset').addEventListener('click', ()=>{ config={...DEFAULT_CONFIG}; applyConfigToUI(); saveConfig(); });
  $('#howto-close').addEventListener('click', ()=>howtoModal.classList.remove('active'));
  $('#retry-btn').addEventListener('click', startGame);
  $('#menu-return-btn').addEventListener('click', ()=>showScreen('menu'));
  settingsModal.addEventListener('click', (e)=>{ if(e.target===settingsModal) settingsModal.classList.remove('active'); });
  howtoModal.addEventListener('click', (e)=>{ if(e.target===howtoModal) howtoModal.classList.remove('active'); });

  $('#shake-intensity').addEventListener('input', (e)=>{ config.shakeIntensity=parseInt(e.target.value); $('#shake-value').textContent=config.shakeIntensity+'%'; });
  $('#shake-enabled').addEventListener('change', (e)=>{ config.shakeEnabled=e.target.checked; });
  $('#max-misses').addEventListener('input', (e)=>{ config.maxMisses=parseInt(e.target.value); $('#maxmiss-value').textContent=config.maxMisses; $('#howto-miss').textContent=config.maxMisses; });
  $('#hold-duration').addEventListener('input', (e)=>{ config.holdDuration=parseInt(e.target.value); $('#hold-value').textContent=(config.holdDuration/1000).toFixed(1)+'s'; $('#howto-hold').textContent=(config.holdDuration/1000).toFixed(1)+'s'; });
  $('#drain-speed').addEventListener('input', (e)=>{ config.drainSpeed=parseInt(e.target.value); $('#drain-value').textContent=config.drainSpeed+'%'; });
  $('#fill-amount').addEventListener('input', (e)=>{ config.fillAmount=parseInt(e.target.value); $('#fill-value').textContent=config.fillAmount+'%'; });
  $('#difficulty').addEventListener('change', (e)=>{ config.difficulty=e.target.value; $('#diff-value').textContent=config.difficulty.toUpperCase(); });
  $('#rounds').addEventListener('input', (e)=>{ config.rounds=parseInt(e.target.value); $('#rounds-value').textContent=config.rounds; $('#howto-rounds').textContent=config.rounds; });
  $('#rest-time').addEventListener('input', (e)=>{ config.restTime=parseInt(e.target.value); $('#rest-value').textContent=(config.restTime/1000).toFixed(1)+'s'; });
  $('#sound-enabled').addEventListener('change', (e)=>{ config.soundEnabled=e.target.checked; });

  window.addEventListener('keydown', handleKeyPress);
  window.addEventListener('keydown', (e)=>{ if([' ','Spacebar'].includes(e.key) && gameState.playing) e.preventDefault(); });
}

loadConfig();
applyConfigToUI();
bindUI();
showScreen('menu');
console.log('CHAIN simplified bar QTE ready', config);
