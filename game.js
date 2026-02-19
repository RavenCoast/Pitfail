const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

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
    animals: [{ type: "snake", x: 640, y: 438, w: 52, h: 24, minX: 620, maxX: 760, speed: 1.1, dir: 1, phase: 0 }],
    ladder: { x: 760, y: 320, w: 42, h: 150 },
    underground: {
      name: "Root Cavern",
      spawn: { x: 760, y: 420 },
      groundY: 470,
      obstacles: [
        { type: "rockPit", x: 228, y: 452, w: 72, h: 18 },
        { type: "stalagmite", x: 520, y: 430, w: 60, h: 40 },
      ],
      platforms: [
        { x: 120, y: 372, w: 120, h: 18 },
        { x: 360, y: 332, w: 140, h: 18 },
      ],
      ladder: { x: 760, y: 320, w: 42, h: 150 },
      animals: [{ type: "bat", x: 430, y: 250, w: 44, h: 20, minX: 380, maxX: 610, speed: 1.5, dir: 1, phase: 0 }],
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
    ladder: null,
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
    ladder: { x: 420, y: 320, w: 42, h: 150 },
    underground: {
      name: "Rock Maze",
      spawn: { x: 420, y: 420 },
      groundY: 470,
      obstacles: [{ type: "spikes", x: 640, y: 445, w: 64, h: 25 }],
      platforms: [
        { x: 130, y: 388, w: 120, h: 18 },
        { x: 300, y: 352, w: 120, h: 18 },
        { x: 460, y: 312, w: 120, h: 18 },
      ],
      ladder: { x: 420, y: 320, w: 42, h: 150 },
      animals: [{ type: "lizard", x: 560, y: 442, w: 54, h: 18, minX: 500, maxX: 700, speed: 1.0, dir: -1, phase: 0 }],
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
    this.beep(660, 0.05, "square", 0.11);
    this.beep(820, 0.08, "triangle", 0.08);
  }

  playLand() {
    this.beep(180, 0.06, "square", 0.09);
    this.beep(140, 0.08, "triangle", 0.07);
  }

  playDeath() {
    this.noise(0.2, 0.12);
    this.beep(220, 0.12, "sawtooth", 0.12);
    this.beep(150, 0.16, "square", 0.1);
    this.beep(92, 0.24, "triangle", 0.09);
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

function resetPlayerOnScreen() {
  const screen = currentScreen();
  const p = gameState.player;
  p.x = screen.spawn.x;
  p.y = screen.spawn.y;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
}

function loseLife(reason) {
  gameState.lives = Math.max(0, gameState.lives - 1);
  gameState.deathMessage = `You were defeated by ${reason}.`;
  gameState.player.justDied = true;
  synth.playDeath();
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
  gameState.underground = false;
  resetPlayerOnScreen();
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
      fatalZone = { x: obs.x, y: obs.y + 36, w: obs.w, h: Math.max(0, obs.h - 36) };
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

  if (gameState.deathMessage && (Math.abs(p.vx) > 0 || p.climbing || keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown)) {
    gameState.deathMessage = "";
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
      for (let i = 0; i < 9; i++) {
        const x = 22 + i * 110;
        drawPixelRect(x + 16, 185, 14, 95, "#744b27");
        drawPixelRect(x, 160, 46, 36, "#21ca63");
        drawPixelRect(x - 8, 180, 62, 28, "#17a952");
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
    const mouthOpen = Math.sin(animal.phase || 0) > 0;
    const bodyColor = animal.type === "panther" ? "#2d2d3b" : animal.type === "snake" ? "#46dd72" : animal.type === "bat" ? "#6f6fa8" : animal.type === "lizard" ? "#3fcf75" : "#9bf37f";
    drawPixelRect(animal.x, animal.y, animal.w, animal.h, bodyColor);

    const headX = animal.dir === -1 ? animal.x : animal.x + animal.w - 10;
    drawPixelRect(headX, animal.y + 4, 8, 8, "#fff");
    drawPixelRect(headX + (animal.dir === -1 ? 1 : 3), animal.y + 6, 2, 2, "#000");

    if (mouthOpen) {
      const mx = animal.dir === -1 ? animal.x - 2 : animal.x + animal.w - 2;
      drawPixelRect(mx, animal.y + animal.h - 6, 4, 4, "#ff9aaa");
    }

    if (animal.type === "bat") {
      const wingY = animal.y - (mouthOpen ? 5 : 2);
      drawPixelRect(animal.x - 8, wingY, 8, 8, "#5b5b92");
      drawPixelRect(animal.x + animal.w, wingY, 8, 8, "#5b5b92");
    }
  }
}

function drawPlayer() {
  const p = gameState.player;
  const facing = p.facing;
  const runPhase = Math.sin(p.animTick);
  const running = Math.abs(p.vx) > 0.1 && p.onGround;
  const jumpPose = !p.onGround && !p.climbing;

  // torso/head
  drawPixelRect(p.x + 7, p.y, 14, 12, "#4d321d");
  drawPixelRect(p.x, p.y + 10, p.w, p.h - 10, "#f4cf9e");
  drawPixelRect(p.x + 5, p.y + 18, 18, 12, "#f25bb6");

  // eye + direction
  drawPixelRect(p.x + (facing > 0 ? 17 : 6), p.y + 3, 4, 4, "#fff");

  // arms
  const armSwing = jumpPose ? 0 : Math.round(runPhase * 4);
  drawPixelRect(p.x + (facing > 0 ? 22 : 1), p.y + 18 + armSwing, 4, 12, "#f4cf9e");
  drawPixelRect(p.x + (facing > 0 ? 2 : 22), p.y + 18 - armSwing, 4, 12, "#f4cf9e");

  // legs
  let legOffsetA = 0;
  let legOffsetB = 0;
  if (jumpPose) {
    legOffsetA = -4;
    legOffsetB = -2;
  } else if (running) {
    legOffsetA = Math.round(runPhase * 5);
    legOffsetB = -Math.round(runPhase * 5);
  }
  drawPixelRect(p.x + 6, p.y + 30 + legOffsetA, 6, 14, "#1f2a5b");
  drawPixelRect(p.x + 16, p.y + 30 + legOffsetB, 6, 14, "#1f2a5b");
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
