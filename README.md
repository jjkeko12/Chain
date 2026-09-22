# CHAIN - BAR QTE FIGHT (Spam Edition)

Web QTE game recreating the **real bar struggle** from Roblox **Chain** final fight with Chain himself.

Instead of single press circle, you now **spam a key to keep a draining bar alive** while screen shakes violently.

### New Mechanic - Bar QTE (Like Chain)

- **Spam Loop**: Random letter A-Z appears. Bar starts at 55% and **constantly drains**.
- Each correct spam adds fill (configurable). Wrong key = -6% penalty.
- Must survive `Hold Duration` (e.g. 4.0s) without bar hitting 0%.
- Then short intermission (`Rest Between Rounds`) → next round, new letter.
- **Shake**: Both the bar container and screen shake, intensity configurable.
- **Moving**: Bar drifts/bounces around arena, intensity configurable.

This is 1:1 to Chain: screen shaking, you mashing to keep bar up.

### Features

- Menu, HUD (You vs Chain HP), Streak, Score, Spams counter
- Configurable:
  - Shake Intensity 0-100% + toggle
  - Moving Intensity 0-100% + toggle
  - Hold Duration 2.0s-8.0s
  - Drain Speed 10-80% (%/sec)
  - Fill per Spam 5-25%
  - Difficulty: Easy/Normal/Hard/CHAIN (affects drain/fill/hold/shake/move multipliers)
  - Rounds 3-20
  - Rest time 0.5s-3.0s
- Sound (WebAudio)
- A-Z only, no space/symbols
- Result screen with total spams, avg bar

### Tech

Vanilla HTML/CSS/JS + Vite. No external assets.

### Deploy GitHub + Vercel

```bash
git init
git add .
git commit -m "feat: bar qte spam like chain"
git branch -M main
git remote add origin https://github.com/YOU/chain-qte-fight.git
git push -u origin main
```

Vercel: Import repo → Framework Vite → Build `npm run build` → Output `dist` → Deploy.

Static also works via `vercel.json`.

### Local

```bash
npm install
npm run dev
```

### How to Play

1. PLAY
2. Bar appears: e.g. SPAM G
3. **Mash G fast** to keep bar up
4. Bar drains alone; if empty you fail and take damage
5. Survive full duration → damage Chain
6. Rest, next round
7. Survive all rounds to escape

Tip: Use two fingers alternating for faster spam. On CHAIN difficulty drain is 2.1x.

### Files

- `index.html` - UI
- `style.css` - Bar visuals, shake, critical effects
- `game.js` - Spam loop, drain, moving physics, input debounce 35ms
- `vercel.json`

### Next

Tell me bugs/features: e.g. progressive drain increase per round, Chain jumpscare, mobile button, etc.
