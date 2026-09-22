# CHAIN - QTE FIGHT

A web-based Quick Time Event game inspired by the final fight with **Chain himself** from the Roblox game **Chain**.

You click PLAY and survive by pressing random letters A-Z before time runs out. Features configurable **shake** and **moving** mechanics just like the original.

### Features (Main Build)

- **Menu System** with Play / Settings / How To Play
- **QTE Core Loop**: Random letter A-Z (no space, no symbols) appears with shrinking timer circle
- **Configurable Shake**: 
  - Enable/disable toggle
  - Intensity slider 0-100% → controls shake amplitude + frequency of the QTE prompt
- **Configurable Moving**:
  - Enable/disable toggle  
  - Intensity slider 0-100% → controls drifting speed + bounce randomness of prompt in arena
- **Gameplay Settings**:
  - QTE Time Window: 0.5s - 3.0s
  - Difficulty: Easy / Normal / Hard / CHAIN (insane)
  - Rounds to Win: 5-25
  - Sound toggle (WebAudio, no external assets)
- **Health System**: You vs Chain HP bars
- **Stats**: Streak, Score, Accuracy, Best Streak
- Horror aesthetic, screen shake on fail, grain + vignette

### Tech Stack

- Vanilla HTML/CSS/JS (no framework) → ultra fast for Vercel
- Vite for dev/build (optional, static also works)
- 100% client-side, deployable anywhere

### How to Play

1. Press PLAY
2. When a letter appears (e.g., **G**), press that letter on keyboard quickly
3. Success = damage Chain, build streak
4. Fail/timeout/wrong key = you take damage + screen shake
5. Survive configured rounds to win

This replicates Chain's fight where the key shakes violently and moves around to disorient you.

### Deploy to GitHub + Vercel

#### 1. Create GitHub Repo

```bash
git init
git add .
git commit -m "feat: initial chain qte build with configurable shake & moving"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/chain-qte-fight.git
git push -u origin main
```

#### 2. Deploy to Vercel

- Go to https://vercel.com/new
- Import your GitHub repo
- Framework Preset: **Vite** (or Other)
- Build Command: `npm run build` or leave empty for static
- Output Directory: `dist` (if using Vite) or `/`
- Deploy → you get a playable URL instantly

**Static deploy also works**: Vercel will serve `index.html` directly with no build step thanks to `vercel.json`.

#### Local Dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

### File Structure

```
/index.html    -> Main UI (menu, arena, modals)
/style.css     -> Horror theme, shake animations, QTE visuals
/game.js       -> All logic: config, QTE spawn, moving physics, input, HUD
/vercel.json   -> SPA rewrite for Vercel
/package.json  -> Vite dev
```

### Roadmap - Next Features (After Main Build)

You said: "once you build the main parts we will go from there to fix bugs and add new features."

Ideas ready to add:
- [ ] Combo sequences (press 3 letters in order)
- [ ] Chain jumpscare images + sounds
- [ ] Mobile on-screen keyboard
- [ ] Leaderboard (localStorage or Supabase)
- [ ] Skins for Chain
- [ ] Particle effects on hit
- [ ] Story intro cutscene
- [ ] Power-ups (slow-mo, freeze movement)

Tell me what to fix/add next and I'll update the repo.

### Config Details

- **Shake Intensity** formula: `shakePx = (intensity/100) * 12 * difficultyMul`
- **Moving Intensity** formula: `speed = (intensity/100)*3.5*difficultyMul + 0.3 px/frame`
- Both are exposed in Settings modal and persisted to localStorage (`chain-qte-config`).

Enjoy, and don't let Chain catch you.
