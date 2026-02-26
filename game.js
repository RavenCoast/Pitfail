const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const screenNameEl = document.getElementById("screen-name");
const splash = document.getElementById("splash");
const startButton = document.getElementById("start-button");

const WORLD = { width: canvas.width, height: canvas.height, gravity: 0.62 };
const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, Space: false };

const gameState = {
  score: 0,
  lives: 99,
  screenIndex: 0,
  underground: false,
  started: false,
  musicStarted: false,
  deathMessage: "",
  deathMessageUntil: 0,
  treasureBursts: [],
  player: {
    x: 95,
    y: 420,
    w: 28,
    h: 44,
    vx: 0,
    vy: 0,
    speed: 4.1,
    jumpPower: 13.5,
    onGround: false,
    climbing: false,
    facing: 1,
    animTick: 0,
    justDied: false,
  },
};

const screens = [
  {
    name: "Jungle Trail",
    spawn: { x: 90, y: 420 },
    groundY: 470,
    foliage: true,
    obstacles: [{ type: "quicksand", x: 336, y: 450, w: 72, h: 20 }],
    treasure: { type: "silver", x: 620, y: 434, w: 26, h: 22, value: 50, collected: false },
    animals: [{ type: "snake", x: 640, y: 438, w: 52, h: 24, minX: 620, maxX: 760, speed: 1.1, dir: 1, phase: 0 }],
    ladder: { x: 760, y: 250, w: 42, h: 290 },
    underground: {
      name: "Root Cavern",
      spawn: { x: 760, y: 420 },
      groundY: 470,
      obstacles: [
        { type: "rockPit", x: 228, y: 452, w: 72, h: 18 },
        { type: "stalagmite", x: 520, y: 430, w: 60, h: 40 },
        { type: "spikes", x: 320, y: 445, w: 70, h: 25 },
      ],
      platforms: [
        { x: 120, y: 372, w: 120, h: 18 },
        { x: 360, y: 332, w: 140, h: 18 },
      ],
      ladder: { x: 760, y: 250, w: 42, h: 290 },
      animals: [{ type: "bat", x: 430, y: 250, w: 44, h: 20, minX: 380, maxX: 610, speed: 1.5, dir: 1, phase: 0 }],
      treasure: { type: "gold", x: 370, y: 304, w: 28, h: 24, value: 100, collected: false },
    },
  },
  {
    name: "Log River",
    spawn: { x: 72, y: 386 },
    groundY: 470,
    foliage: true,
    obstacles: [{ type: "river", x: 180, y: 420, w: 560, h: 84 }],
    movingLogs: [
      { x: 230, y: 440, w: 140, h: 20, speed: 1.15 },
      { x: 430, y: 450, w: 150, h: 20, speed: -1.15 },
      { x: 620, y: 432, w: 150, h: 20, speed: 1.35 },
    ],
    animals: [{ type: "frog", x: 770, y: 444, w: 28, h: 22, minX: 760, maxX: 860, speed: 0.8, dir: 1, phase: 0 }],
    ladder: { x: 70, y: 250, w: 42, h: 290 },
    underground: {
      name: "Flooded Grotto",
      spawn: { x: 88, y: 420 },
      groundY: 470,
      obstacles: [
        { type: "spikes", x: 200, y: 445, w: 85, h: 25 },
        { type: "rockPit", x: 420, y: 452, w: 90, h: 18 },
      ],
      platforms: [
        { x: 90, y: 360, w: 96, h: 18 },
        { x: 320, y: 330, w: 110, h: 18 },
        { x: 560, y: 300, w: 140, h: 18 },
      ],
      ladder: { x: 70, y: 250, w: 42, h: 290 },
      animals: [{ type: "lizard", x: 640, y: 440, w: 56, h: 20, minX: 560, maxX: 820, speed: 1.4, dir: 1, phase: 0 }],
      treasure: { type: "gold", x: 594, y: 282, w: 28, h: 24, value: 100, collected: false },
    },
    treasure: { type: "gold", x: 770, y: 446, w: 28, h: 24, value: 100, collected: false },
  },
  {
    name: "Fallen Timber",
    spawn: { x: 84, y: 420 },
    groundY: 470,
    foliage: true,
    obstacles: [
      { type: "gap", x: 292, y: 470, w: 72, h: 70 },
      { type: "fallenTree", x: 540, y: 430, w: 170, h: 35 },
    ],
    platforms: [{ x: 560, y: 392, w: 130, h: 18 }],
    animals: [{ type: "panther", x: 740, y: 432, w: 70, h: 30, minX: 700, maxX: 850, speed: 1.4, dir: 1, phase: 0 }],
    ladder: { x: 420, y: 250, w: 42, h: 290 },
    treasure: null,
    underground: {
      name: "Rock Maze",
      spawn: { x: 420, y: 420 },
      groundY: 470,
      obstacles: [
        { type: "spikes", x: 250, y: 445, w: 100, h: 25 },
        { type: "spikes", x: 640, y: 445, w: 72, h: 25 },
        { type: "rockPit", x: 470, y: 452, w: 80, h: 18 },
      ],
      platforms: [
        { x: 130, y: 388, w: 120, h: 18 },
        { x: 300, y: 352, w: 120, h: 18 },
        { x: 460, y: 312, w: 120, h: 18 },
      ],
      ladder: { x: 420, y: 250, w: 42, h: 290 },
      animals: [{ type: "lizard", x: 560, y: 442, w: 54, h: 18, minX: 500, maxX: 700, speed: 1.0, dir: -1, phase: 0 }],
      treasure: { type: "silver", x: 142, y: 370, w: 26, h: 22, value: 50, collected: false },
    },
  },
];

class TinySynth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.currentTheme = null;
    this.noteIndex = 0;
    this.themes = {
      0: { tempo: 220, melody: [262, 330, 392, 523, 392, 330, 294, 349], bass: [131, 147, 165, 196] },
      1: { tempo: 200, melody: [294, 370, 440, 587, 440, 370, 330, 392], bass: [147, 165, 185, 220] },
      2: { tempo: 210, melody: [247, 311, 370, 494, 370, 311, 277, 330], bass: [123, 139, 155, 185] },
      cave: { tempo: 240, melody: [220, 262, 294, 330, 294, 262, 247, 196], bass: [110, 123, 131, 147] },
    };
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }
  }

  beep(freq = 440, duration = 0.12, type = "square", volume = 0.22) {
    this.ensure();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise(duration = 0.08, volume = 0.08) {
    this.ensure();
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  playJump() {
    this.beep(560, 0.06, "square", 0.12);
    this.beep(720, 0.08, "triangle", 0.09);
    this.beep(920, 0.09, "square", 0.06);
  }

  playLand() {
    this.noise(0.05, 0.04);
    this.beep(180, 0.08, "square", 0.11);
    this.beep(120, 0.1, "triangle", 0.08);
  }

  playTreasureStinger(type = "gold") {
    const bright = type === "gold" ? [880, 1175, 1480] : [740, 988, 1318];
    bright.forEach((f, i) => this.beep(f, 0.08 + i * 0.02, "square", 0.11 - i * 0.01));
    this.beep(bright[2] * 1.25, 0.18, "triangle", 0.09);
  }

  playDeath() {
    this.noise(0.2, 0.12);
    this.beep(240, 0.14, "sawtooth", 0.12);
    this.beep(170, 0.2, "square", 0.1);
    this.beep(104, 0.26, "triangle", 0.1);
  }

  playSadPhraseThenResume(themeKey) {
    this.ensure();
    const notes = [262, 220, 196, 165];
    notes.forEach((n, i) => {
      this.beep(n, 0.17 + i * 0.005, "triangle", 0.07);
      this.beep(n / 2, 0.2, "square", 0.05);
    });
    setTimeout(() => this.setTheme(themeKey), 900);
  }

  startMusic(themeKey) {
    this.ensure();
    this.setTheme(themeKey);
  }

  setTheme(themeKey) {
    this.ensure();
    if (this.currentTheme === themeKey && this.musicTimer) return;
    this.currentTheme = themeKey;
    const theme = this.themes[themeKey] || this.themes[0];
    const now = this.ctx.currentTime;

    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.07, now + 0.12);
    this.master.gain.linearRampToValueAtTime(0.18, now + 0.38);

    if (this.musicTimer) clearInterval(this.musicTimer);
    this.noteIndex = 0;
    this.musicTimer = setInterval(() => {
      const i = this.noteIndex;
      const m = theme.melody[i % theme.melody.length];
      const b = theme.bass[i % theme.bass.length];
      this.beep(m, 0.11, "square", 0.065);
      this.beep(b, 0.16, "triangle", 0.04);
      this.noteIndex++;
    }, theme.tempo);
  }
}

const synth = new TinySynth();

function currentScreen() {
  const base = screens[gameState.screenIndex];
  return gameState.underground && base.underground ? { ...base.underground, baseName: base.name } : { ...base, baseName: base.name };
}

function obstacleLabel(type) {
  const labels = {
    quicksand: "quicksand",
    river: "the river",
    gap: "a jungle pit",
    rockPit: "a rock pit",
    spikes: "spikes",
    stalagmite: "stalagmites",
    fallenTree: "a fallen tree",
  };
  return labels[type] || type;
}

function animalLabel(type) {
  const labels = { snake: "a snake", frog: "a frog", panther: "a panther", bat: "a cave bat", lizard: "a lizard" };
  return labels[type] || "a jungle beast";
}

function themeKeyForCurrentScreen() {
  if (gameState.underground) return "cave";
  return gameState.screenIndex;
}

function resetPlayerOnScreen(entryDirection = 0) {
  const screen = currentScreen();
  const p = gameState.player;
  p.x = screen.spawn.x;
  p.y = screen.spawn.y;
  if (entryDirection > 0) p.x = 10;
  if (entryDirection < 0) p.x = WORLD.width - p.w - 10;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
}

function loseLife(reason) {
  gameState.lives = Math.max(0, gameState.lives - 1);
  gameState.deathMessage = `You were defeated by ${reason}.`;
  gameState.deathMessageUntil = performance.now() + 5000;
  gameState.player.justDied = true;
  synth.playDeath();
  synth.playSadPhraseThenResume(themeKeyForCurrentScreen());
  resetPlayerOnScreen();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = `Score: ${gameState.score}`;
  livesEl.textContent = `Lives: ${gameState.lives}`;
  const screen = currentScreen();
  const name = gameState.underground ? `${screen.baseName} / ${screen.name}` : screen.name;
  screenNameEl.textContent = `Screen: ${name}`;
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveToScreen(direction) {
  if (direction > 0) gameState.screenIndex = (gameState.screenIndex + 1) % screens.length;
  else gameState.screenIndex = (gameState.screenIndex - 1 + screens.length) % screens.length;
  gameState.score += 100;

  const targetBase = screens[gameState.screenIndex];
  if (gameState.underground && !targetBase.underground) gameState.underground = false;

  resetPlayerOnScreen(direction);
  synth.beep(640, 0.1, "square", 0.11);
  synth.beep(820, 0.08, "triangle", 0.08);
  synth.setTheme(themeKeyForCurrentScreen());
  updateHud();
}

function handleLadder(screen) {
  const ladder = screen.ladder;
  if (!ladder) return;
  const p = gameState.player;
  if (!intersects({ x: p.x + 6, y: p.y, w: p.w - 12, h: p.h }, ladder)) {
    if (p.climbing) p.climbing = false;
    return;
  }
  if (keys.ArrowUp || keys.ArrowDown) {
    p.climbing = true;
    p.vy = 0;
    if (keys.ArrowUp) p.y -= 3;
    if (keys.ArrowDown) p.y += 3;
    p.x = ladder.x + ladder.w / 2 - p.w / 2;

    if (!gameState.underground && p.y + p.h >= screen.groundY + 2 && keys.ArrowDown && screens[gameState.screenIndex].underground) {
      gameState.underground = true;
      resetPlayerOnScreen();
      synth.beep(210, 0.14, "square", 0.09);
      synth.setTheme(themeKeyForCurrentScreen());
      updateHud();
    }
    if (gameState.underground && p.y <= 310 && keys.ArrowUp) {
      gameState.underground = false;
      resetPlayerOnScreen();
      synth.beep(420, 0.12, "square", 0.09);
      synth.setTheme(themeKeyForCurrentScreen());
      updateHud();
    }
  }
}

function updateMovingLogs(screen) {
  if (!screen.movingLogs) return;
  for (const log of screen.movingLogs) {
    log.x += log.speed;
    if (log.x < 170) log.speed = Math.abs(log.speed);
    if (log.x + log.w > 770) log.speed = -Math.abs(log.speed);
  }
}

function updateAnimals(screen) {
  for (const animal of screen.animals || []) {
    animal.phase = (animal.phase || 0) + 0.14;
    if (animal.minX !== undefined && animal.maxX !== undefined && animal.speed) {
      animal.x += animal.speed * (animal.dir || 1);
      if (animal.x < animal.minX) {
        animal.x = animal.minX;
        animal.dir = 1;
      }
      if (animal.x + animal.w > animal.maxX) {
        animal.x = animal.maxX - animal.w;
        animal.dir = -1;
      }
    }
  }
}

function resolvePlatforms(screen) {
  const p = gameState.player;
  const wasOnGround = p.onGround;
  p.onGround = false;

  if (!p.climbing) p.vy += WORLD.gravity;
  p.x += p.vx;
  p.y += p.vy;

  const solids = [];
  const floorParts = [{ x: 0, y: screen.groundY, w: WORLD.width, h: WORLD.height - screen.groundY }];

  for (const obs of screen.obstacles || []) {
    if (obs.type === "gap" || obs.type === "quicksand" || obs.type === "river" || obs.type === "rockPit") {
      floorParts.push({ x: 0, y: screen.groundY, w: obs.x, h: WORLD.height - screen.groundY });
      floorParts.push({ x: obs.x + obs.w, y: screen.groundY, w: WORLD.width - (obs.x + obs.w), h: WORLD.height - screen.groundY });
    }
    if (obs.type === "fallenTree" || obs.type === "stalagmite" || obs.type === "spikes") solids.push({ x: obs.x, y: obs.y, w: obs.w, h: obs.h });
  }

  for (const part of floorParts) solids.push(part);
  for (const platform of screen.platforms || []) solids.push(platform);
  for (const log of screen.movingLogs || []) solids.push(log);

  let landed = false;
  for (const solid of solids) {
    if (intersects(p, solid)) {
      const prevBottom = p.y - p.vy + p.h;
      const prevTop = p.y - p.vy;
      const prevRight = p.x - p.vx + p.w;
      const prevLeft = p.x - p.vx;

      if (prevBottom <= solid.y + 6 && p.vy >= 0) {
        p.y = solid.y - p.h;
        p.vy = 0;
        landed = true;
        if (screen.movingLogs && screen.movingLogs.includes(solid)) p.x += solid.speed;
      } else if (prevTop >= solid.y + solid.h - 6 && p.vy < 0) {
        p.y = solid.y + solid.h;
        p.vy = 0;
      } else if (prevRight <= solid.x + 6 && p.vx > 0) {
        p.x = solid.x - p.w;
      } else if (prevLeft >= solid.x + solid.w - 6 && p.vx < 0) {
        p.x = solid.x + solid.w;
      }
    }
  }

  p.onGround = landed;
  if (!wasOnGround && landed && !p.justDied) synth.playLand();
  p.justDied = false;

  if (p.y > WORLD.height + 40) loseLife("a bottomless fall");

  for (const obs of screen.obstacles || []) {
    let fatalZone = obs;
    if (obs.type === "river") {
      // Deeper-only fatal region so all log landings are safely possible.
      fatalZone = { x: obs.x, y: obs.y + 46, w: obs.w, h: Math.max(0, obs.h - 46) };
    }
    if (["quicksand", "river", "gap", "rockPit", "spikes", "stalagmite"].includes(obs.type) && intersects(p, fatalZone)) {
      loseLife(obstacleLabel(obs.type));
      return;
    }
  }

  for (const animal of screen.animals || []) {
    if (intersects(p, animal)) {
      loseLife(animalLabel(animal.type));
      return;
    }
  }

  if (p.x + p.w < 0) moveToScreen(-1);
  if (p.x > WORLD.width) moveToScreen(1);
  p.x = Math.max(-20, Math.min(WORLD.width + 20, p.x));
}


function drawTreasure(treasure) {
  if (!treasure || treasure.collected) return;
  const color = treasure.type === "gold" ? "#f7cc33" : "#c4d4ef";
  const shadow = treasure.type === "gold" ? "#c19418" : "#8ea0bf";
  drawPixelRect(treasure.x, treasure.y + 6, treasure.w, treasure.h - 6, color);
  drawPixelRect(treasure.x + 2, treasure.y + 2, treasure.w - 4, 6, shadow);
  drawPixelRect(treasure.x + 4, treasure.y + 10, treasure.w - 8, 3, shadow);
}

function collectTreasure(screen) {
  const t = screen.treasure;
  if (!t || t.collected) return;
  if (intersects(gameState.player, t)) {
    t.collected = true;
    gameState.score += t.value;
    const sparkleColor = t.type === "gold" ? "#ffe166" : "#d8e6ff";
    gameState.treasureBursts.push({ x: t.x + t.w / 2, y: t.y + t.h / 2, color: sparkleColor, life: 34, type: t.type });
    synth.playTreasureStinger(t.type);
    updateHud();
  }
}

function updateTreasureBursts() {
  for (let i = gameState.treasureBursts.length - 1; i >= 0; i--) {
    const burst = gameState.treasureBursts[i];
    burst.life -= 1;
    if (burst.life <= 0) gameState.treasureBursts.splice(i, 1);
  }
}

function drawTreasureBursts() {
  for (const burst of gameState.treasureBursts) {
    const t = 1 - burst.life / 34;
    const radius = 8 + t * 18;
    const arms = burst.type === "gold" ? 10 : 8;
    ctx.fillStyle = burst.color;
    for (let i = 0; i < arms; i++) {
      const a = (Math.PI * 2 * i) / arms + t * 0.8;
      const px = burst.x + Math.cos(a) * radius;
      const py = burst.y + Math.sin(a) * (radius * 0.7);
      drawPixelRect(px - 2, py - 2, 4, 4, burst.color);
    }
  }
}

function update() {
  const p = gameState.player;
  const screen = currentScreen();

  updateMovingLogs(screen);
  updateAnimals(screen);

  p.vx = 0;
  if (keys.ArrowLeft) {
    p.vx = -p.speed;
    p.facing = -1;
  }
  if (keys.ArrowRight) {
    p.vx = p.speed;
    p.facing = 1;
  }


  handleLadder(screen);

  if (!p.climbing && keys.Space && p.onGround) {
    p.vy = -p.jumpPower;
    p.onGround = false;
    synth.playJump();
  }

  if (p.climbing && !keys.ArrowUp && !keys.ArrowDown) p.climbing = false;
  p.animTick += Math.abs(p.vx) > 0 ? 0.35 : 0.08;

  resolvePlatforms(screen);
  collectTreasure(screen);
  updateTreasureBursts();

  if (gameState.deathMessage && performance.now() > gameState.deathMessageUntil) gameState.deathMessage = "";
}

function drawPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawBackground(screen) {
  if (gameState.underground) {
    drawPixelRect(0, 0, WORLD.width, WORLD.height, "#1c1630");
    for (let i = 0; i < 30; i++) drawPixelRect(i * 40, 0, 20, WORLD.height, i % 2 ? "#2f2550" : "#261f43");
  } else {
    drawPixelRect(0, 0, WORLD.width, 280, "#4cc4ff");
    drawPixelRect(0, 280, WORLD.width, WORLD.height - 280, "#2f9853");

    if (screen.foliage) {
      for (let i = 0; i < 7; i++) {
        const x = 10 + i * 145;
        drawPixelRect(x + 28, 150, 20, 130, "#744b27");
        drawPixelRect(x, 102, 78, 62, "#21ca63");
        drawPixelRect(x - 16, 132, 108, 52, "#17a952");
      }
    }
  }
}

function drawObstacles(screen) {
  for (const obs of screen.obstacles || []) {
    switch (obs.type) {
      case "quicksand":
        drawPixelRect(obs.x, obs.y, obs.w, obs.h, "#d0a25f");
        for (let i = 0; i < obs.w; i += 22) drawPixelRect(obs.x + i, obs.y + 10, 10, 4, "#b47a3d");
        break;
      case "river":
        drawPixelRect(obs.x, obs.y, obs.w, obs.h, "#2b79ee");
        for (let i = 0; i < obs.w; i += 34) drawPixelRect(obs.x + i, obs.y + 15 + (i % 2 ? 8 : 0), 18, 3, "#7fc0ff");
        break;
      case "gap":
      case "rockPit":
        drawPixelRect(obs.x, obs.y, obs.w, obs.h, "#111");
        break;
      case "fallenTree":
        drawPixelRect(obs.x, obs.y, obs.w, obs.h, "#8f5f2b");
        drawPixelRect(obs.x + 20, obs.y + 8, obs.w - 40, 8, "#a26d34");
        break;
      case "spikes":
        drawPixelRect(obs.x, obs.y + obs.h - 8, obs.w, 8, "#838ca8");
        for (let i = 0; i < obs.w; i += 20) {
          ctx.fillStyle = "#c6ccdd";
          ctx.beginPath();
          ctx.moveTo(obs.x + i + 10, obs.y);
          ctx.lineTo(obs.x + i + 20, obs.y + obs.h - 8);
          ctx.lineTo(obs.x + i, obs.y + obs.h - 8);
          ctx.fill();
        }
        break;
      case "stalagmite":
        ctx.fillStyle = "#9b85c9";
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w / 2, obs.y);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.lineTo(obs.x, obs.y + obs.h);
        ctx.fill();
        break;
      default:
        break;
    }
  }

  for (const platform of screen.platforms || []) drawPixelRect(platform.x, platform.y, platform.w, platform.h, "#70532d");
  for (const log of screen.movingLogs || []) {
    drawPixelRect(log.x, log.y, log.w, log.h, "#986738");
    drawPixelRect(log.x + 10, log.y + 6, log.w - 20, 4, "#b07a44");
  }

  if (screen.ladder) {
    drawPixelRect(screen.ladder.x, screen.ladder.y, screen.ladder.w, screen.ladder.h, "#c58f4f");
    for (let y = screen.ladder.y + 8; y < screen.ladder.y + screen.ladder.h; y += 18) drawPixelRect(screen.ladder.x, y, screen.ladder.w, 4, "#83582e");
  }

  for (const animal of screen.animals || []) {
    const phase = animal.phase || 0;
    const mouthOpen = Math.sin(phase) > 0;
    const bodyColor = animal.type === "panther" ? "#2d2d3b" : animal.type === "snake" ? "#46dd72" : animal.type === "bat" ? "#6f6fa8" : animal.type === "lizard" ? "#3fcf75" : "#9bf37f";
    const faceLeft = animal.dir === -1;
    drawPixelRect(animal.x, animal.y, animal.w, animal.h, bodyColor);

    const headW = 12;
    const headX = faceLeft ? animal.x : animal.x + animal.w - headW;
    drawPixelRect(headX, animal.y + 3, headW, 10, "#f5f5f5");
    drawPixelRect(headX + (faceLeft ? 2 : headW - 4), animal.y + 6, 2, 2, "#000");

    const jawHeight = mouthOpen ? 8 : 3;
    const jawX = faceLeft ? headX - 8 : headX + headW;
    drawPixelRect(jawX, animal.y + animal.h - jawHeight - 2, 10, jawHeight, "#ff9aaa");

    if (animal.type !== "snake" && animal.type !== "bat") {
      const legSwing = Math.round(Math.sin(phase) * 2);
      drawPixelRect(animal.x + 8, animal.y + animal.h - 2, 5, 10 + legSwing, "#1f2a5b");
      drawPixelRect(animal.x + animal.w - 13, animal.y + animal.h - 2, 5, 10 - legSwing, "#1f2a5b");
    }

    if (animal.type === "bat") {
      const wingY = animal.y - (mouthOpen ? 7 : 3);
      drawPixelRect(animal.x - 12, wingY, 12, 10, "#5b5b92");
      drawPixelRect(animal.x + animal.w, wingY, 12, 10, "#5b5b92");
    }
  }
}

const PLAYER_SPRITE_PALETTE = {
  P: "#f04ca8", // cap/hair accent
  S: "#f6c26a", // skin
  G: "#20b54c", // body
  D: "#0d7d2a", // shadow green
  B: "#2648a8", // boot
  K: "#0f0f16", // outline
};

const PLAYER_SPRITE_FRAMES = {
  idle: [
    "................",
    "....PPPP........",
    "...PPSSP........",
    "....PSSK........",
    "....GGG.........",
    "...GGDGG........",
    "...GGDGG........",
    "..GGGGGG........",
    "..GGGGGD........",
    "..GGDGGD........",
    "...G..G.........",
    "..GB..GB........",
    "..GB..GB........",
    "..BK..BK........",
    "................",
    "................",
  ],
  jump: [
    "................",
    "....PPPP........",
    "...PPSSP........",
    "....PSSK........",
    "....GGG.........",
    "...GGDGG........",
    "...GGDGG........",
    "..GGGGGG........",
    "..GGGGGD........",
    "...GGGG.........",
    "..GB..G.........",
    ".GB....GB.......",
    ".BK....BK.......",
    "................",
    "................",
    "................",
  ],
  walk: [
    [
      "................",
      "....PPPP........",
      "...PPSSP........",
      "....PSSK........",
      "....GGG.........",
      "...GGDGG........",
      "...GGDGG........",
      "..GGGGGG........",
      "..GGGGGD........",
      "..GGDGGD........",
      "...G..G.........",
      "..GB..G.........",
      "..GB...GB.......",
      ".BK.....BK......",
      "................",
      "................",
    ],
    [
      "................",
      "....PPPP........",
      "...PPSSP........",
      "....PSSK........",
      "....GGG.........",
      "...GGDGG........",
      "...GGDGG........",
      "..GGGGGG........",
      "..GGGGGD........",
      "..GGDGGD........",
      "...G..G.........",
      "..G...GB........",
      ".GB..GB.........",
      ".BK..BK.........",
      "................",
      "................",
    ],
    [
      "................",
      "....PPPP........",
      "...PPSSP........",
      "....PSSK........",
      "....GGG.........",
      "...GGDGG........",
      "...GGDGG........",
      "..GGGGGG........",
      "..GGGGGD........",
      "..GGDGGD........",
      "...G..G.........",
      "...GB..G........",
      "..GB...GB.......",
      "..BK....BK......",
      "................",
      "................",
    ],
    [
      "................",
      "....PPPP........",
      "...PPSSP........",
      "....PSSK........",
      "....GGG.........",
      "...GGDGG........",
      "...GGDGG........",
      "..GGGGGG........",
      "..GGGGGD........",
      "..GGDGGD........",
      "...G..G.........",
      "..GB...G........",
      "..GB..GB........",
      "...BK..BK.......",
      "................",
      "................",
    ],
  ],
};

function renderSpriteFrame(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const bmp = document.createElement("canvas");
  bmp.width = w;
  bmp.height = h;
  const bctx = bmp.getContext("2d");
  bctx.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const key = row[x];
      if (key === ".") continue;
      const color = PLAYER_SPRITE_PALETTE[key];
      if (!color) continue;
      bctx.fillStyle = color;
      bctx.fillRect(x, y, 1, 1);
    }
  }
  return bmp;
}

const PLAYER_BITMAPS = {
  idle: renderSpriteFrame(PLAYER_SPRITE_FRAMES.idle),
  jump: renderSpriteFrame(PLAYER_SPRITE_FRAMES.jump),
  walk: PLAYER_SPRITE_FRAMES.walk.map(renderSpriteFrame),
};

function drawPlayer() {
  const p = gameState.player;
  const running = Math.abs(p.vx) > 0.1 && p.onGround;
  const jumpPose = !p.onGround && !p.climbing;

  let frame = PLAYER_BITMAPS.idle;
  if (jumpPose) {
    frame = PLAYER_BITMAPS.jump;
  } else if (running) {
    const walkIndex = Math.floor(p.animTick) % PLAYER_BITMAPS.walk.length;
    frame = PLAYER_BITMAPS.walk[walkIndex];
  }

  const scale = 6;
  const spriteW = frame.width * scale;
  const spriteH = frame.height * scale;
  const drawX = Math.round(p.x + (p.w - spriteW) / 2);
  const drawY = Math.round(p.y + p.h - spriteH);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (p.facing < 0) {
    ctx.translate(drawX + spriteW, drawY);
    ctx.scale(-1, 1);
    ctx.drawImage(frame, 0, 0, spriteW, spriteH);
  } else {
    ctx.drawImage(frame, drawX, drawY, spriteW, spriteH);
  }
  ctx.restore();
}
function drawDeathMessage() {
  if (!gameState.deathMessage) return;
  const text = gameState.deathMessage;
  ctx.fillStyle = "rgba(6, 8, 22, 0.78)";
  ctx.fillRect(180, 22, 600, 42);
  ctx.fillStyle = "#ffe28e";
  ctx.font = "20px Courier New";
  ctx.textAlign = "center";
  ctx.fillText(text, WORLD.width / 2, 49);
}

function draw() {
  const screen = currentScreen();
  drawBackground(screen);
  drawObstacles(screen);
  drawTreasure(screen.treasure);
  drawTreasureBursts();
  drawPlayer();
  drawDeathMessage();

  if (!gameState.started) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
}

function loop() {
  if (gameState.started) update();
  draw();
  requestAnimationFrame(loop);
}

function startGame() {
  gameState.started = true;
  splash.classList.remove("active");
  resetPlayerOnScreen();
  updateHud();
  if (!gameState.musicStarted) {
    synth.startMusic(themeKeyForCurrentScreen());
    gameState.musicStarted = true;
  } else {
    synth.setTheme(themeKeyForCurrentScreen());
  }
  synth.beep(520, 0.1, "square", 0.1);
}

window.addEventListener("keydown", (event) => {
  if (event.code in keys) {
    keys[event.code] = true;
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code in keys) {
    keys[event.code] = false;
    event.preventDefault();
  }
});

startButton.addEventListener("click", startGame);

updateHud();
loop();
