/* CHAIN - INFINITE BAR QTE with ramp toggle */

const DEFAULT_CONFIG = {
  shakeIntensity: 65,
  shakeEnabled: true,
  maxMisses: 3,
  holdDuration: 4000,
  drainSpeed: 35,
  fillAmount: 12,
  difficulty: 'normal',
  rampEnabled: true,
  rampSpeed: 5,
  restTime: 1500,
  soundEnabled: true,
};

const DIFFICULTY_MODS = {
  easy:   { drainMul: 0.65, fillMul: 1.4, holdMul: 0.9, shakeMul: 0.6 },
  normal: { drainMul: 1.0,  fillMul: 1.0, holdMul: 1.0, shakeMul: 1.0 },
  hard:   { drainMul: 1.35, fillMul: 0.85, holdMul: 1.15, shakeMul: 1.35 },
  chain:  { drainMul: 1.9,  fillMul: 0.65, holdMul: 1.3, shakeMul: 1.9 },
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
  currentDrainMulti: 1.0,
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
const nextRoundEl = $('#next-round');

const missDotsEl = $('#miss-dots');
const missCountEl = $('#miss-count');
const missMaxEl = $('#miss-max');
const roundEl = $('#round');
const drainMultiEl = $('#drain-multi');
const streakEl = $('#streak');
const spamsEl = $('#spams');
const scoreEl = $('#score');

const settingsModal = $('#settings-modal');
const howtoModal = $('#howto-modal');

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('chain-qte-config-v5'));
    if (saved) config = { ...DEFAULT_CONFIG, ...saved };
  } catch {}
  // migrate v4
  try {
    const v4 = JSON.parse(localStorage.getItem('chain-qte-config-v4'));
    if (v4 && !localStorage.getItem('chain-qte-config-v5')) {
      config = { ...DEFAULT_CONFIG, ...v4, rampEnabled: v4.rampSpeed > 0 ? true : false };
      if (config.rampSpeed === 0) { config.rampEnabled = false; config.rampSpeed = 5; }
    }
  } catch {}
}
function saveConfig() { localStorage.setItem('chain-qte-config-v5', JSON.stringify(config)); }

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
  $('#ramp-enabled').checked = config.rampEnabled;
  $('#ramp-speed').value = config.rampSpeed;
  $('#ramp-value').textContent = config.rampEnabled ? '+'+config.rampSpeed+'%' : 'OFF';
  const rampSetting = $('#ramp-speed-setting');
  if (rampSetting) {
    rampSetting.style.opacity = config.rampEnabled ? '1' : '0.4';
    rampSetting.style.pointerEvents = config.rampEnabled ? 'auto' : 'none';
  }
  $('#rest-time').value = config.restTime;
  $('#rest-value').textContent = (config.restTime/1000).toFixed(1)+'s';
  $('#sound-enabled').checked = config.soundEnabled;
  $('#howto-hold').textContent = (config.holdDuration/1000).toFixed(1)+'s';
  $('#howto-miss').textContent = config.maxMisses;
  $('#howto-ramp').textContent = config.rampEnabled ? '+'+config.rampSpeed+'%' : 'OFF';
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
  gameState.successes=0;
  gameState.failures=0;
  gameState.totalSpams=0;
  gameState.avgBarSum=0;
  gameState.avgBarCount=0;
  gameState.currentDrainMulti=1.0;
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

function endGame(){
  gameState.playing=false;
  cancelAnimationFrame(gameState.raf);
  clearInterval(gameState.intermissionTimer);
  qteContainer.innerHTML='';
  intermissionEl.classList.remove('show');

  const desc=$('#result-desc');
  $('#final-rounds').textContent=gameState.round-1;
  $('#final-misses').textContent=`${gameState.misses}/${gameState.maxMisses}`;
  $('#best-streak').textContent=gameState.bestStreak;
  $('#total-spams').textContent=gameState.totalSpams;
  $('#final-score').textContent=gameState.score;
  $('#final-drain').textContent='x'+gameState.currentDrainMulti.toFixed(2);

  const rampInfo = config.rampEnabled ? `Ramp was ON (+${config.rampSpeed}% per round). Final drain x${gameState.currentDrainMulti.toFixed(2)}.` : `Ramp was OFF - constant difficulty.`;
  desc.textContent=`Survived ${gameState.round-1} rounds infinite. ${rampInfo} Total spams: ${gameState.totalSpams}. Misses ${gameState.misses}/${gameState.maxMisses}.`;

  sfxFail();
  showScreen('result');
}

function updateHUD(){
  missDotsEl.innerHTML='';
  for(let i=0;i<gameState.maxMisses;i++){
    const dot=document.createElement('div');
    dot.className='miss-dot'+(i < gameState.misses ? ' filled' : '');
    missDotsEl.appendChild(dot);
  }
  missCountEl.textContent=gameState.misses;
  missMaxEl.textContent=gameState.maxMisses;
  roundEl.textContent=gameState.round;
  drainMultiEl.textContent=gameState.currentDrainMulti.toFixed(2);
  streakEl.textContent=gameState.streak;
  spamsEl.textContent=gameState.spamsThisRound;
  scoreEl.textContent=gameState.score;
}

let lastFrameTime=0;
let lastShakeTime=0;

function spawnQTE(){
  if(!gameState.playing) return;
  const diff = DIFFICULTY_MODS[config.difficulty] || DIFFICULTY_MODS.normal;

  // ramping toggle logic
  let roundRamp = 1;
  let holdRamp = 1;
  if (config.rampEnabled) {
    const rampFactor = config.rampSpeed / 100;
    roundRamp = 1 + (gameState.round - 1) * rampFactor;
    holdRamp = 1 + (gameState.round - 1) * rampFactor * 0.4;
  }
  gameState.currentDrainMulti = roundRamp * diff.drainMul;

  const letter = LETTERS[Math.floor(Math.random()*LETTERS.length)];
  gameState.currentLetter=letter;
  gameState.barValue=55;
  gameState.spamsThisRound=0;
  gameState.qteActive=true;
  gameState.qteStartTime=performance.now();
  gameState.holdDuration = config.holdDuration * diff.holdMul * holdRamp;
  gameState.drainPerSec = config.drainSpeed * diff.drainMul * roundRamp;
  gameState.fillPerPress = config.fillAmount * diff.fillMul;

  qteContainer.innerHTML='';

  const keyBox=document.createElement('div');
  keyBox.className='qte-key-box';
  keyBox.innerHTML=`
    <div class="bolt-bl"></div><div class="bolt-br"></div>
    <div class="wear"></div>
    <div class="qte-key-label">SPAM KEY - ROUND ${gameState.round} ${config.rampEnabled ? '∞↗' : '∞'}</div>
    <div class="qte-key-letter" id="qte-letter">${letter}</div>
    <div class="qte-key-hint">MASH ${letter}</div>
  `;

  const barBox=document.createElement('div');
  barBox.className='qte-bar-box';
  const rampLabel = config.rampEnabled ? `HOLD BAR - x${gameState.currentDrainMulti.toFixed(2)} (+${config.rampSpeed}%)` : `HOLD BAR - x${gameState.currentDrainMulti.toFixed(2)} (NO RAMP)`;
  barBox.innerHTML=`
    <div class="bolt-bl"></div><div class="bolt-br"></div>
    <div class="wear"></div>
    <div class="qte-bar-header">
      <span class="qte-bar-title">${rampLabel}</span>
      <span class="qte-bar-time" id="qte-time">${(gameState.holdDuration/1000).toFixed(1)}s</span>
    </div>
    <div class="qte-bar-track">
      <div class="qte-bar-fill" id="qte-fill" style="width:${gameState.barValue}%"></div>
      <div class="qte-bar-segments"><div></div><div></div><div></div><div></div></div>
    </div>
    <div class="qte-bar-footer"><span>EMPTY</span><span>ROUND ${gameState.round} ${config.rampEnabled ? 'RAMP ON' : 'RAMP OFF'}</span><span>SAFE</span></div>
    <div class="qte-bar-hint" id="bar-hint">${config.rampEnabled ? `RAMP ${gameState.round===1?'STARTS NOW':'ACTIVE'} - KEEP SPAMMING!` : 'RAMP OFF - CONSTANT DIFFICULTY'}</div>
  `;

  qteContainer.appendChild(keyBox);
  qteContainer.appendChild(barBox);

  const fillEl=barBox.querySelector('#qte-fill');
  const timeEl=barBox.querySelector('#qte-time');

  if(config.shakeEnabled){
    const shakeBase=(config.shakeIntensity/100)*10*diff.shakeMul * (0.8 + (config.rampEnabled ? roundRamp*0.2 : 0));
    const shakeDur=Math.max(0.05, 0.16 - (config.shakeIntensity/100)*0.08);
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
  updateHUD();

  function loop(now){
    if(!gameState.qteActive) return;
    const delta = now - lastFrameTime;
    lastFrameTime=now;
    const elapsed = now - gameState.qteStartTime;
    const remaining = Math.max(0, gameState.holdDuration - elapsed);

    const drainAmount = (gameState.drainPerSec/1000)*delta;
    gameState.barValue = Math.max(0, gameState.barValue - drainAmount);

    gameState.avgBarSum+=gameState.barValue;
    gameState.avgBarCount++;

    fillEl.style.width=gameState.barValue+'%';
    if(gameState.barValue<25){
      fillEl.className='qte-bar-fill';
      keyBox.classList.add('critical'); barBox.classList.add('critical');
      if(now - lastShakeTime > 150){
        triggerScreenShake((config.shakeEnabled? (config.shakeIntensity/100)*12 : 4)*diff.shakeMul*(config.rampEnabled?roundRamp:1));
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

    if(config.shakeEnabled && now - lastShakeTime > 250 + Math.random()*280){
      const shakeAmt=(config.shakeIntensity/100)*7*diff.shakeMul* (0.7 + (config.rampEnabled?roundRamp*0.3:0));
      triggerScreenShake(shakeAmt);
      lastShakeTime=now;
    }

    if(gameState.barValue<=0){ handleFail(); return; }
    if(elapsed>=gameState.holdDuration){ handleSuccess(); return; }

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
  gameState.score+= Math.floor(150 + gameState.barValue*2 + gameState.spamsThisRound*3 + gameState.streak*15 + gameState.round*10 * gameState.currentDrainMulti);

  const keyBox=qteContainer.querySelector('.qte-key-box');
  const barBox=qteContainer.querySelector('.qte-bar-box');
  if(keyBox) keyBox.classList.add('success');
  if(barBox) barBox.classList.add('success');

  showFeedback(gameState.round % 5 === 0 ? `ROUND ${gameState.round} CLEARED!` : ['HELD!','KEPT!','STRONG!'][Math.floor(Math.random()*3)], true);
  sfxSuccess();
  updateHUD();
  startIntermission();
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

  showFeedback('MISSED! '+gameState.misses+'/'+gameState.maxMisses, false);
  sfxFail();
  const diff=DIFFICULTY_MODS[config.difficulty];
  const shakeAmt=(config.shakeEnabled? (config.shakeIntensity/100)*18 : 6)*diff.shakeMul*gameState.currentDrainMulti;
  triggerScreenShake(shakeAmt);
  updateHUD();

  if(gameState.misses>=gameState.maxMisses){
    setTimeout(()=>endGame(), 650);
  }else{
    startIntermission();
  }
}

function startIntermission(){
  qteContainer.innerHTML='';
  intermissionEl.classList.add('show');
  nextRoundEl.textContent=gameState.round+1;
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
  $('#ramp-enabled').addEventListener('change', (e)=>{
    config.rampEnabled=e.target.checked;
    const rampSetting=$('#ramp-speed-setting');
    if(rampSetting){ rampSetting.style.opacity=config.rampEnabled?'1':'0.4'; rampSetting.style.pointerEvents=config.rampEnabled?'auto':'none'; }
    $('#ramp-value').textContent=config.rampEnabled?'+'+config.rampSpeed+'%':'OFF';
    $('#howto-ramp').textContent=config.rampEnabled?'+'+config.rampSpeed+'%':'OFF';
  });
  $('#ramp-speed').addEventListener('input', (e)=>{
    config.rampSpeed=parseInt(e.target.value);
    $('#ramp-value').textContent=config.rampEnabled?'+'+config.rampSpeed+'%':'OFF';
    $('#howto-ramp').textContent=config.rampEnabled?'+'+config.rampSpeed+'%':'OFF';
  });
  $('#rest-time').addEventListener('input', (e)=>{ config.restTime=parseInt(e.target.value); $('#rest-value').textContent=(config.restTime/1000).toFixed(1)+'s'; });
  $('#sound-enabled').addEventListener('change', (e)=>{ config.soundEnabled=e.target.checked; });

  window.addEventListener('keydown', handleKeyPress);
  window.addEventListener('keydown', (e)=>{ if([' ','Spacebar'].includes(e.key) && gameState.playing) e.preventDefault(); });
}

loadConfig();
applyConfigToUI();
bindUI();
showScreen('menu');
console.log('CHAIN infinite ramp toggle ready', config);
