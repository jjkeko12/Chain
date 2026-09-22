/* CHAIN - BAR QTE FIGHT
 * Spam mechanic: keep bar alive while screen shakes
 */

const DEFAULT_CONFIG = {
  shakeIntensity: 60,
  shakeEnabled: true,
  moveIntensity: 50,
  moveEnabled: true,
  holdDuration: 4000, // ms to survive per round
  drainSpeed: 35, // % per second
  fillAmount: 12, // % per correct spam
  difficulty: 'normal',
  rounds: 10,
  restTime: 1500,
  soundEnabled: true,
};

const DIFFICULTY_MODS = {
  easy:   { drainMul: 0.55, fillMul: 1.5, holdMul: 0.8, playerDmg: 10, chainDmgMul: 1.25, shakeMul: 0.6, moveMul: 0.6 },
  normal: { drainMul: 1.0,  fillMul: 1.0, holdMul: 1.0, playerDmg: 15, chainDmgMul: 1.0,  shakeMul: 1.0, moveMul: 1.0 },
  hard:   { drainMul: 1.45, fillMul: 0.8, holdMul: 1.2, playerDmg: 22, chainDmgMul: 0.85, shakeMul: 1.4, moveMul: 1.4 },
  chain:  { drainMul: 2.1,  fillMul: 0.6, holdMul: 1.45, playerDmg: 30, chainDmgMul: 0.7,  shakeMul: 2.2, moveMul: 2.0 },
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
  barValue: 50,
  qteActive: false,
  qteStartTime: 0,
  qteElapsed: 0,
  holdDuration: 4000,
  drainPerSec: 35,
  fillPerPress: 12,
  spamsThisRound: 0,
  totalSpams: 0,
  avgBarSum: 0,
  avgBarCount: 0,
  lastPressTime: 0,
  raf: null,
  moveRaf: null,
  intermissionTimer: null,
};

let audioCtx = null;

// DOM
const $ = s => document.querySelector(s);
const menuScreen = $('#menu-screen');
const gameScreen = $('#game-screen');
const resultScreen = $('#result-screen');
const arena = $('#arena');
const qteContainer = $('#qte-container');
const chainEntity = $('#chain-entity');
const feedbackEl = $('#feedback');
const intermissionEl = $('#intermission');
const intermissionTimeEl = $('#intermission-time');

const playerHpFill = $('#player-hp-fill');
const chainHpFill = $('#chain-hp-fill');
const playerHpText = $('#player-hp-text');
const chainHpText = $('#chain-hp-text');
const streakEl = $('#streak');
const scoreEl = $('#score');
const roundEl = $('#round');
const spamsEl = $('#spams');

const settingsModal = $('#settings-modal');
const howtoModal = $('#howto-modal');

// Config
function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('chain-qte-config-v2'));
    if (saved) config = { ...DEFAULT_CONFIG, ...saved };
  } catch {}
  // migrate old
  try {
    const old = JSON.parse(localStorage.getItem('chain-qte-config'));
    if (old && !localStorage.getItem('chain-qte-config-v2')) {
      config.shakeIntensity = old.shakeIntensity ?? config.shakeIntensity;
      config.shakeEnabled = old.shakeEnabled ?? config.shakeEnabled;
      config.moveIntensity = old.moveIntensity ?? config.moveIntensity;
      config.moveEnabled = old.moveEnabled ?? config.moveEnabled;
      config.difficulty = old.difficulty ?? config.difficulty;
      config.rounds = old.rounds ?? config.rounds;
    }
  } catch {}
}
function saveConfig() {
  localStorage.setItem('chain-qte-config-v2', JSON.stringify(config));
}
function applyConfigToUI() {
  $('#shake-intensity').value = config.shakeIntensity;
  $('#shake-value').textContent = config.shakeIntensity + '%';
  $('#shake-enabled').checked = config.shakeEnabled;
  $('#move-intensity').value = config.moveIntensity;
  $('#move-value').textContent = config.moveIntensity + '%';
  $('#move-enabled').checked = config.moveEnabled;
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
  renderKeysPreview();
}
function renderKeysPreview() {
  const c = $('#keys-preview');
  c.innerHTML = '';
  LETTERS.forEach(l=>{
    const s=document.createElement('span'); s.textContent=l; c.appendChild(s);
  });
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
function sfxSpam(){ playTone(600+Math.random()*200,0.08,'square',0.15); }
function sfxSpamGood(){ playTone(900,0.12,'sine',0.2); }
function sfxDrainWarn(){ playTone(120,0.2,'sawtooth',0.12); }
function sfxSuccess(){ playTone(800,0.15,'sine',0.3); setTimeout(()=>playTone(1200,0.25,'sine',0.25),80); }
function sfxFail(){ playTone(150,0.4,'sawtooth',0.3); setTimeout(()=>playTone(70,0.5,'sawtooth',0.3),120); }
function sfxSpawn(){ playTone(350,0.12,'triangle',0.2); }

// Screen shake
function triggerScreenShake(intensity=10){
  const app=$('#app');
  app.style.setProperty('--screen-shake', intensity+'px');
  app.classList.remove('shake-screen'); void app.offsetWidth; app.classList.add('shake-screen');
  setTimeout(()=>app.classList.remove('shake-screen'), 300);
}

// Screens
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  if(name==='menu') menuScreen.classList.add('active');
  if(name==='game') gameScreen.classList.add('active');
  if(name==='result') resultScreen.classList.add('active');
}

function resetGame(){
  gameState.playerHP=100;
  gameState.chainHP=100;
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
  setTimeout(spawnQTE, 600);
}

function endGame(win){
  gameState.playing=false;
  cancelAnimationFrame(gameState.raf);
  cancelAnimationFrame(gameState.moveRaf);
  clearInterval(gameState.intermissionTimer);
  qteContainer.innerHTML='';
  intermissionEl.classList.remove('show');

  const title=$('#result-title');
  const desc=$('#result-desc');
  $('#final-score').textContent=gameState.score;
  $('#best-streak').textContent=gameState.bestStreak;
  $('#total-spams').textContent=gameState.totalSpams;
  const avg = gameState.avgBarCount ? Math.round(gameState.avgBarSum/gameState.avgBarCount) : 0;
  $('#accuracy').textContent=avg+'%';

  if(win){
    title.textContent='YOU ESCAPED';
    title.className='result-title win';
    desc.textContent=`You kept the bar alive through ${gameState.successes} struggles! Total spams: ${gameState.totalSpams}. Chain couldn't hold you.`;
    sfxSuccess();
  }else{
    title.textContent='CHAINED';
    title.className='result-title lose';
    desc.textContent=`Chain drained you. Survived ${gameState.successes}/${gameState.totalRounds} rounds. ${gameState.totalSpams} desperate spams.`;
    sfxFail();
  }
  showScreen('result');
}

function updateHUD(){
  playerHpFill.style.width=Math.max(0,gameState.playerHP)+'%';
  chainHpFill.style.width=Math.max(0,gameState.chainHP)+'%';
  playerHpText.textContent=Math.max(0,Math.round(gameState.playerHP))+'%';
  chainHpText.textContent=Math.max(0,Math.round(gameState.chainHP))+'%';
  streakEl.textContent=gameState.streak;
  scoreEl.textContent=gameState.score;
  roundEl.textContent=`${Math.min(gameState.successes+gameState.failures+1, gameState.totalRounds)}/${gameState.totalRounds}`;
  spamsEl.textContent=gameState.spamsThisRound;
  if(gameState.chainHP<30) chainEntity.style.filter='brightness(1.5) hue-rotate(-20deg)'; else chainEntity.style.filter='';
}

// QTE BAR LOGIC
let moveState=null;
let lastFrameTime=0;
let lastShakeTime=0;

function spawnQTE(){
  if(!gameState.playing) return;
  const diff = DIFFICULTY_MODS[config.difficulty] || DIFFICULTY_MODS.normal;

  const letter = LETTERS[Math.floor(Math.random()*LETTERS.length)];
  gameState.currentLetter=letter;
  gameState.barValue=55; // start mid
  gameState.spamsThisRound=0;
  gameState.qteActive=true;
  gameState.qteStartTime=performance.now();
  gameState.qteElapsed=0;
  gameState.holdDuration=config.holdDuration * diff.holdMul;
  gameState.drainPerSec=config.drainSpeed * diff.drainMul;
  gameState.fillPerPress=config.fillAmount * diff.fillMul;

  // Build DOM
  qteContainer.innerHTML='';
  const wrapper=document.createElement('div');
  wrapper.className='qte-bar-wrapper';
  wrapper.innerHTML=`
    <div class="qte-header">
      <div>
        <div class="qte-spam-label">SPAM KEY</div>
        <div class="qte-letter-big" id="qte-letter">${letter}</div>
      </div>
      <div style="text-align:right">
        <div class="qte-spam-label">TIME LEFT</div>
        <div class="qte-time-left" id="qte-time">${(gameState.holdDuration/1000).toFixed(1)}s</div>
      </div>
    </div>
    <div class="qte-bar-track">
      <div class="qte-bar-fill" id="qte-fill" style="width:${gameState.barValue}%"></div>
      <div class="qte-bar-zones"><div></div><div></div><div></div><div></div></div>
    </div>
    <div class="qte-bar-labels"><span>EMPTY</span><span>DANGER</span><span>SAFE</span></div>
    <div class="qte-spam-hint" id="spam-hint">MASH ${letter} TO SURVIVE!</div>
  `;
  qteContainer.appendChild(wrapper);

  const fillEl=wrapper.querySelector('#qte-fill');
  const timeEl=wrapper.querySelector('#qte-time');
  const letterEl=wrapper.querySelector('#qte-letter');
  const hintEl=wrapper.querySelector('#spam-hint');

  // shake setup
  if(config.shakeEnabled){
    const shakeBase=(config.shakeIntensity/100)*14*diff.shakeMul;
    const shakeDur=Math.max(0.06, 0.18 - (config.shakeIntensity/100)*0.1);
    wrapper.style.setProperty('--shake-x', shakeBase+'px');
    wrapper.style.setProperty('--shake-y', (shakeBase*0.6)+'px');
    wrapper.style.setProperty('--shake-dur', shakeDur+'s');
    wrapper.classList.add('shake');
  }

  // moving setup
  const promptW=380;
  if(config.moveEnabled){
    const pad=10;
    const maxX=arena.clientWidth - promptW - pad*2;
    const maxY=arena.clientHeight - 180 - pad*2;
    const x=pad + Math.random()*Math.max(10,maxX);
    const y=pad + 80 + Math.random()*Math.max(10,maxY);
    const speedBase=(config.moveIntensity/100)*2.8*diff.moveMul + 0.4;
    const angle=Math.random()*Math.PI*2;
    moveState={ x,y, vx:Math.cos(angle)*speedBase, vy:Math.sin(angle)*speedBase, maxX: arena.clientWidth - promptW, maxY: arena.clientHeight - 180 };
    wrapper.style.left=x+'px'; wrapper.style.top=y+'px'; wrapper.style.position='absolute'; wrapper.style.transform='none';
    startMovingLoop(wrapper);
  }else{
    wrapper.style.left='50%'; wrapper.style.top='50%'; wrapper.style.transform='translate(-50%,-50%)'; wrapper.style.position='absolute';
    moveState=null;
  }

  lastFrameTime=performance.now();
  lastShakeTime=performance.now();
  chainEntity.classList.add('attack');
  setTimeout(()=>chainEntity.classList.remove('attack'),300);
  sfxSpawn();

  function loop(now){
    if(!gameState.qteActive) return;
    const delta = now - lastFrameTime;
    lastFrameTime=now;
    gameState.qteElapsed = now - gameState.qteStartTime;
    const remaining = Math.max(0, gameState.holdDuration - gameState.qteElapsed);

    // drain
    const drainAmount = (gameState.drainPerSec/1000)*delta;
    gameState.barValue = Math.max(0, gameState.barValue - drainAmount);

    // track avg
    gameState.avgBarSum+=gameState.barValue;
    gameState.avgBarCount++;

    // update UI
    fillEl.style.width=gameState.barValue+'%';
    if(gameState.barValue<25){
      fillEl.className='qte-bar-fill';
      wrapper.classList.add('critical');
      if(now - lastShakeTime > 180){
        triggerScreenShake((config.shakeEnabled? (config.shakeIntensity/100)*14 : 5) * diff.shakeMul);
        if(Math.random()<0.6) sfxDrainWarn();
        lastShakeTime=now;
      }
    }else if(gameState.barValue<55){
      fillEl.className='qte-bar-fill';
      wrapper.classList.remove('critical');
    }else if(gameState.barValue<80){
      fillEl.className='qte-bar-fill good';
      wrapper.classList.remove('critical');
    }else{
      fillEl.className='qte-bar-fill great';
      wrapper.classList.remove('critical');
    }

    timeEl.textContent=(remaining/1000).toFixed(1)+'s';
    if(remaining<1000) timeEl.style.color='#ff1a1a'; else timeEl.style.color='#fff';

    // periodic screen shake while active (Chain vibe)
    if(config.shakeEnabled && now - lastShakeTime > 250 + Math.random()*300){
      const shakeAmt=(config.shakeIntensity/100)*8*diff.shakeMul;
      triggerScreenShake(shakeAmt);
      lastShakeTime=now;
    }

    // fail?
    if(gameState.barValue<=0){
      handleFail();
      return;
    }
    // success hold complete?
    if(gameState.qteElapsed>=gameState.holdDuration){
      handleSuccess();
      return;
    }

    gameState.raf=requestAnimationFrame(loop);
  }
  gameState.raf=requestAnimationFrame(loop);
}

function startMovingLoop(el){
  cancelAnimationFrame(gameState.moveRaf);
  function move(){
    if(!gameState.qteActive || !moveState) return;
    let {x,y,vx,vy,maxX,maxY}=moveState;
    x+=vx; y+=vy;
    if(x<=0 || x>=maxX){ vx*=-1; x=Math.max(0,Math.min(maxX,x)); }
    if(y<=0 || y>=maxY){ vy*=-1; y=Math.max(0,Math.min(maxY,y)); }
    if(Math.random()<0.03){ vx+=(Math.random()-0.5)*0.6; vy+=(Math.random()-0.5)*0.6; }
    moveState.x=x; moveState.y=y; moveState.vx=vx; moveState.vy=vy;
    el.style.left=x+'px'; el.style.top=y+'px';
    gameState.moveRaf=requestAnimationFrame(move);
  }
  gameState.moveRaf=requestAnimationFrame(move);
}

function showFeedback(text, success){
  feedbackEl.textContent=text;
  feedbackEl.className='feedback show '+(success?'success':'fail');
  setTimeout(()=>{ feedbackEl.className='feedback'; }, 700);
}

function handleSuccess(){
  if(!gameState.qteActive) return;
  gameState.qteActive=false;
  cancelAnimationFrame(gameState.raf);
  cancelAnimationFrame(gameState.moveRaf);

  const diff=DIFFICULTY_MODS[config.difficulty];
  gameState.successes++;
  gameState.streak++;
  gameState.bestStreak=Math.max(gameState.bestStreak, gameState.streak);
  // score: based on avg bar + spams + time left bar
  const scoreAdd = 150 + Math.floor(gameState.barValue*2) + gameState.spamsThisRound*3 + gameState.streak*15;
  gameState.score+=scoreAdd;

  const chainDmg=(100/gameState.totalRounds)*diff.chainDmgMul;
  gameState.chainHP=Math.max(0, gameState.chainHP - chainDmg);

  const wrapper=qteContainer.querySelector('.qte-bar-wrapper');
  if(wrapper) wrapper.classList.add('success');
  showFeedback(['SURVIVED!','ESCAPED!','HELD ON!','STRONG!'][Math.floor(Math.random()*4)], true);
  chainEntity.classList.add('hit'); setTimeout(()=>chainEntity.classList.remove('hit'),250);
  sfxSuccess();
  updateHUD();

  if(gameState.chainHP<=0 || gameState.successes>=gameState.totalRounds){
    setTimeout(()=>endGame(true), 700);
  }else{
    startIntermission();
  }
}

function handleFail(){
  if(!gameState.qteActive) return;
  gameState.qteActive=false;
  cancelAnimationFrame(gameState.raf);
  cancelAnimationFrame(gameState.moveRaf);

  const diff=DIFFICULTY_MODS[config.difficulty];
  gameState.failures++;
  gameState.streak=0;
  gameState.playerHP=Math.max(0, gameState.playerHP - diff.playerDmg);

  const wrapper=qteContainer.querySelector('.qte-bar-wrapper');
  if(wrapper) wrapper.classList.add('fail');

  showFeedback('DRAINED!', false);
  sfxFail();
  const shakeAmt=(config.shakeEnabled? (config.shakeIntensity/100)*20 : 8)*diff.shakeMul;
  triggerScreenShake(shakeAmt);
  arena.style.background='rgba(255,0,0,0.12)'; setTimeout(()=>arena.style.background='',200);
  updateHUD();

  if(gameState.playerHP<=0){
    setTimeout(()=>endGame(false), 700);
  }else{
    startIntermission(true);
  }
}

function startIntermission(isFail=false){
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

// Input - spam
function handleKeyPress(e){
  if(!gameState.playing || !gameState.qteActive) return;
  const key=e.key.toUpperCase();
  if(key.length!==1) return;
  if(!LETTERS.includes(key)) return; // ignore space/symbols
  e.preventDefault();

  const now=performance.now();
  if(now - gameState.lastPressTime < 35) return; // debounce slightly to prevent insane auto-repeat, but still allow fast spam
  gameState.lastPressTime=now;

  if(key===gameState.currentLetter){
    // correct spam
    gameState.barValue=Math.min(100, gameState.barValue + gameState.fillPerPress);
    gameState.spamsThisRound++;
    gameState.totalSpams++;
    updateHUD();

    const letterEl=$('#qte-letter');
    if(letterEl){ letterEl.classList.remove('pulse'); void letterEl.offsetWidth; letterEl.classList.add('pulse'); }

    const fillEl=$('#qte-fill');
    if(fillEl){
      fillEl.style.transform='scaleY(1.15)'; setTimeout(()=>fillEl.style.transform='',80);
    }

    // sfx variant
    if(gameState.barValue>70) sfxSpamGood(); else sfxSpam();

  }else{
    // wrong key penalty
    gameState.barValue=Math.max(0, gameState.barValue - 6);
    triggerScreenShake(4);
    showFeedback('WRONG!', false);
    playTone(100,0.1,'square',0.1);
  }
}

// UI bind
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
  $('#move-intensity').addEventListener('input', (e)=>{ config.moveIntensity=parseInt(e.target.value); $('#move-value').textContent=config.moveIntensity+'%'; });
  $('#move-enabled').addEventListener('change', (e)=>{ config.moveEnabled=e.target.checked; });
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
console.log('CHAIN BAR QTE Ready', config);
