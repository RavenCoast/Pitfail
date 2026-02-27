const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const screenNameEl = document.getElementById("screen-name");
const splash = document.getElementById("splash");
const startButton = document.getElementById("start-button");
const buildMetaEl = document.getElementById("build-meta");

const BUILD_INFO = {
  number: "B-2026.02.26-02",
  timestampUtc: "2026-02-26T23:10:00Z",
};


class FileAudioManager {
  constructor() {
    this.enabled = false;
    this.currentTheme = null;
    this.sfx = {
      jump: new Audio("assets/audio/jump.wav"),
      land: new Audio("assets/audio/land.wav"),
      death: new Audio("assets/audio/death.wav"),
      treasure: new Audio("assets/audio/treasure.wav"),
    };
    this.music = {
      surface: new Audio("assets/audio/music_surface.wav"),
      cave: new Audio("assets/audio/music_cave.wav"),
    };
    Object.values(this.sfx).forEach((a) => { a.preload = "auto"; a.volume = 0.55; });
    Object.values(this.music).forEach((a) => { a.preload = "auto"; a.loop = true; a.volume = 0.38; });
  }

  async unlock() {
    if (this.enabled) return true;
    try {
      const first = this.music.surface;
      first.currentTime = 0;
      await first.play();
      first.pause();
      first.currentTime = 0;
      this.enabled = true;
      return true;
    } catch (_) {
      this.enabled = false;
      return false;
    }
  }

  playSfx(name) {
    if (!this.enabled || !this.sfx[name]) return false;
    const a = this.sfx[name];
    a.currentTime = 0;
    a.play().catch(() => {});
    return true;
  }

  setTheme(themeKey) {
    if (!this.enabled) return false;
    const target = themeKey === "cave" ? "cave" : "surface";
    if (this.currentTheme === target) return true;
    this.currentTheme = target;

    for (const [name, track] of Object.entries(this.music)) {
      if (name === target) {
        track.currentTime = 0;
        track.play().catch(() => {});
      } else {
        track.pause();
        track.currentTime = 0;
      }
    }
    return true;
  }
}

const fileAudio = new FileAudioManager();

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
  screenTransitionLockUntil: 0,
  respawnPending: false,
  respawnAt: 0,
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
      { x: 230, y: 440, w: 140, h: 20, speed: 1.15, minX: 220, maxX: 500 },
      { x: 430, y: 450, w: 150, h: 20, speed: -1.15, minX: 360, maxX: 620 },
      { x: 620, y: 432, w: 150, h: 20, speed: 1.35, minX: 500, maxX: 700 },
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
    this.percussionTimer = null;
    this.currentTheme = null;
    this.noteIndex = 0;
    this.themes = {
      0: {
        stepMs: 150,
        melody: [523, null, 659, 698, 784, null, 659, 587, 523, null, 659, 784, 880, 784, 698, null],
        bass: [131, null, null, 165, null, 196, null, 165, 147, null, null, 185, null, 220, null, 185],
        percussion: [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 4],
      },
      1: {
        stepMs: 144,
        melody: [554, null, 698, 740, 831, null, 740, 698, 622, null, 740, 831, 932, 831, 740, null],
        bass: [147, null, null, 185, null, 220, null, 185, 165, null, null, 208, null, 247, null, 208],
        percussion: [1, 0, 3, 0, 2, 0, 3, 4, 1, 0, 3, 0, 2, 0, 3, 0],
      },
      2: {
        stepMs: 148,
        melody: [494, null, 622, 659, 740, null, 659, 622, 554, null, 659, 740, 831, 740, 659, null],
        bass: [123, null, null, 156, null, 185, null, 156, 139, null, null, 175, null, 208, null, 175],
        percussion: [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 4, 2, 0, 3, 0],
      },
      cave: {
        stepMs: 158,
        melody: [392, null, 494, 523, 587, null, 523, 494, 440, null, 523, 587, 659, 587, 523, null],
        bass: [110, null, null, 123, null, 147, null, 123, 131, null, null, 147, null, 165, null, 147],
        percussion: [1, 0, 0, 3, 2, 0, 3, 0, 1, 0, 0, 3, 2, 0, 3, 4],
      },
    };
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
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

  playDrum(volume = 0.085) {
    this.ensure();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(105, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.14);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  playSnare(volume = 0.06) {
    this.noise(0.09, volume);
  }

  playHat(volume = 0.04) {
    this.noise(0.03, volume);
  }

  playJump() {
    if (fileAudio.playSfx("jump")) return;
    this.beep(560, 0.06, "square", 0.12);
    this.beep(720, 0.08, "triangle", 0.09);
    this.beep(920, 0.09, "square", 0.06);
  }

  playLand() {
    if (fileAudio.playSfx("land")) return;
    this.noise(0.05, 0.04);
    this.beep(180, 0.08, "square", 0.11);
    this.beep(120, 0.1, "triangle", 0.08);
  }

  playTreasureStinger(type = "gold") {
    if (fileAudio.playSfx("treasure")) return;
    const bright = type === "gold" ? [880, 1175, 1480] : [740, 988, 1318];
    bright.forEach((f, i) => this.beep(f, 0.08 + i * 0.02, "square", 0.11 - i * 0.01));
    this.beep(bright[2] * 1.25, 0.18, "triangle", 0.09);
  }

  playDeath() {
    if (fileAudio.playSfx("death")) return;
    this.noise(0.2, 0.12);
    this.beep(240, 0.14, "sawtooth", 0.12);
    this.beep(170, 0.2, "square", 0.1);
    this.beep(104, 0.26, "triangle", 0.1);
  }

  playSadPhraseThenResume(themeKey, durationMs = 2000) {
    this.ensure();
    const notes = [294, 262, 220, 196, 175, 165, 147, 131];
    const spacing = durationMs / notes.length;
    notes.forEach((n, i) => {
      setTimeout(() => {
        this.beep(n, 0.2, "triangle", 0.075);
        this.beep(n / 2, 0.22, "square", 0.05);
      }, i * spacing);
    });
    setTimeout(() => this.setTheme(themeKey), durationMs);
  }

  startMusic(themeKey) {
    this.ensure();
    this.setTheme(themeKey);
  }

  setTheme(themeKey) {
    if (fileAudio.setTheme(themeKey)) return;
    this.ensure();
    if (this.currentTheme === themeKey && this.musicTimer && this.percussionTimer) return;
    this.currentTheme = themeKey;
    const theme = this.themes[themeKey] || this.themes[0];
    const now = this.ctx.currentTime;

    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.07, now + 0.12);
    this.master.gain.linearRampToValueAtTime(0.22, now + 0.38);

    if (this.musicTimer) clearInterval(this.musicTimer);
    if (this.percussionTimer) clearInterval(this.percussionTimer);

    this.noteIndex = 0;

    this.musicTimer = setInterval(() => {
      const i = this.noteIndex % theme.melody.length;
      const m = theme.melody[i];
      const b = theme.bass[i];
      if (m) this.beep(m, 0.16, "square", 0.092);
      if (b) this.beep(b, 0.22, "triangle", 0.055);
      this.noteIndex++;
    }, theme.stepMs);

    let percIndex = 0;
    this.percussionTimer = setInterval(() => {
      const hit = theme.percussion[percIndex % theme.percussion.length];
      if (hit === 1) this.playDrum(0.09);
      if (hit === 2) this.playSnare(0.065);
      if (hit === 3) {
        this.playDrum(0.085);
        this.playHat(0.035);
      }
      if (hit === 4) {
        this.playSnare(0.06);
        this.playHat(0.04);
      }
      percIndex++;
    }, Math.floor(theme.stepMs / 2));
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
  if (entryDirection > 0) p.x = 20;
  if (entryDirection < 0) p.x = WORLD.width - p.w - 20;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
}

function loseLife(reason) {
  if (gameState.respawnPending) return;
  gameState.lives = Math.max(0, gameState.lives - 1);
  gameState.deathMessage = `You were defeated by ${reason}.`;
  gameState.deathMessageUntil = performance.now() + 5000;
  gameState.player.justDied = true;
  gameState.respawnPending = true;
  gameState.respawnAt = performance.now() + 2000;
  synth.playDeath();
  synth.playSadPhraseThenResume(themeKeyForCurrentScreen(), 2000);
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


function obstacleFatalZone(obs) {
  if (obs.type === "river") return { x: obs.x, y: obs.y + 46, w: obs.w, h: Math.max(0, obs.h - 46) };
  if (["quicksand", "gap", "rockPit", "spikes", "stalagmite"].includes(obs.type)) return obs;
  return null;
}

function animalBlockedByObstacle(screen, animal, nextX) {
  const footY = animal.y + animal.h + 2;
  const centerX = nextX + animal.w / 2;

  if (centerX < 0 || centerX > WORLD.width) return true;
  for (const obs of screen.obstacles || []) {
    if (footY >= screen.groundY - 2 && (obs.type === "gap" || obs.type === "quicksand" || obs.type === "river" || obs.type === "rockPit")) {
      if (centerX >= obs.x && centerX <= obs.x + obs.w) return true;
    }
    if (obs.type === "spikes" || obs.type === "stalagmite") {
      if (centerX >= obs.x - animal.w * 0.2 && centerX <= obs.x + obs.w + animal.w * 0.2 && footY >= obs.y - 2) return true;
    }
  }
  return false;
}

function moveToScreen(direction) {
  if (direction > 0) gameState.screenIndex = (gameState.screenIndex + 1) % screens.length;
  else gameState.screenIndex = (gameState.screenIndex - 1 + screens.length) % screens.length;
  gameState.score += 100;

  const targetBase = screens[gameState.screenIndex];
  if (gameState.underground && !targetBase.underground) gameState.underground = false;

  resetPlayerOnScreen(direction);
  gameState.screenTransitionLockUntil = performance.now() + 350;
  synth.beep(640, 0.1, "square", 0.11);
  synth.beep(820, 0.08, "triangle", 0.08);
  synth.beep(980, 0.09, "square", 0.07);
  synth.setTheme(themeKeyForCurrentScreen());
  updateHud();
}

function activeLadderRect(screen) {
  if (!screen.ladder) return null;
  const p = gameState.player;
  if (gameState.underground) {
    const bottom = Math.min(WORLD.height, screen.spawn.y + p.h);
    return { x: screen.ladder.x, y: 0, w: screen.ladder.w, h: bottom };
  }
  const top = Math.max(0, screen.spawn.y);
  return { x: screen.ladder.x, y: top, w: screen.ladder.w, h: WORLD.height - top };
}

function handleLadder(screen) {
  const ladder = activeLadderRect(screen);
  const p = gameState.player;
  if (!ladder) {
    p.climbing = false;
    return;
  }

  const ladderHitbox = { x: p.x + 6, y: p.y, w: p.w - 12, h: p.h };
  const touchingLadder = intersects(ladderHitbox, ladder);

  if (p.climbing && (keys.ArrowLeft || keys.ArrowRight)) {
    if (keys.Space) {
      p.climbing = false;
      p.vy = -p.jumpPower;
      p.vx = keys.ArrowLeft ? -p.speed : p.speed;
      p.onGround = false;
      synth.playJump();
    } else {
      p.climbing = false;
    }
    return;
  }

  if (!touchingLadder && !p.climbing) return;
  if (!touchingLadder && p.climbing) {
    p.climbing = false;
    return;
  }

  if (keys.ArrowUp || keys.ArrowDown || p.climbing) {
    p.climbing = true;
    p.vy = 0;
    p.x = ladder.x + ladder.w / 2 - p.w / 2;

    if (keys.ArrowUp) p.y -= 3;
    if (!gameState.underground && keys.ArrowDown) p.y += 3;

    if (!gameState.underground) {
      const topStop = ladder.y;
      const bottomStop = WORLD.height - p.h;
      p.y = Math.max(topStop, Math.min(bottomStop, p.y));

      if (keys.ArrowDown && p.y + p.h >= WORLD.height - 1 && screens[gameState.screenIndex].underground) {
        gameState.underground = true;
        resetPlayerOnScreen();
        synth.beep(210, 0.14, "square", 0.09);
        synth.setTheme(themeKeyForCurrentScreen());
        updateHud();
      }
    } else {
      const bottomStop = ladder.y + ladder.h - p.h;
      p.y = Math.min(bottomStop, p.y);

      if (keys.ArrowUp && p.y <= 0) {
        gameState.underground = false;
        resetPlayerOnScreen();
        synth.beep(420, 0.12, "square", 0.09);
        synth.setTheme(themeKeyForCurrentScreen());
        updateHud();
      }
    }
  }
}

function updateMovingLogs(screen) {
  if (!screen.movingLogs) return;
  for (const [idx, log] of screen.movingLogs.entries()) {
    if (log.baseY === undefined) {
      log.baseY = log.y;
      log.sinkPhase = idx * 1.7;
      log.sinkRate = 0.032 + idx * 0.008;
      log.sinkDepth = 26 + idx * 4;
    }

    log.x += log.speed;
    const minX = log.minX ?? 190;
    const maxX = log.maxX ?? 740;
    if (log.x < minX) log.speed = Math.abs(log.speed);
    if (log.x > maxX) log.speed = -Math.abs(log.speed);

    log.sinkPhase += log.sinkRate;
    const sinkWave = Math.sin(log.sinkPhase);
    const sinkAmount = sinkWave < -0.2 ? ((-0.2 - sinkWave) / 0.8) * log.sinkDepth : 0;
    log.y = log.baseY + sinkAmount;
    log.isSurfaced = sinkAmount < log.sinkDepth * 0.45;
  }
}

function updateAnimals(screen) {
  for (const animal of screen.animals || []) {
    animal.phase = (animal.phase || 0) + 0.14;
    if (animal.minX !== undefined && animal.maxX !== undefined && animal.speed) {
      const step = animal.speed * (animal.dir || 1);
      const nextX = animal.x + step;

      if (animalBlockedByObstacle(screen, animal, nextX)) {
        animal.dir = -(animal.dir || 1);
        continue;
      }

      animal.x = nextX;

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

  if (performance.now() >= gameState.screenTransitionLockUntil) {
    if (p.x <= -p.w * 0.55) {
      moveToScreen(-1);
      return;
    }
    if (p.x + p.w >= WORLD.width + p.w * 0.55) {
      moveToScreen(1);
      return;
    }
  }

  const solids = [];

  if (!p.climbing) {
    let segments = [{ start: 0, end: WORLD.width }];

    for (const obs of screen.obstacles || []) {
      if (obs.type === "gap" || obs.type === "quicksand" || obs.type === "river" || obs.type === "rockPit") {
        const next = [];
        for (const seg of segments) {
          if (obs.x >= seg.end || obs.x + obs.w <= seg.start) {
            next.push(seg);
            continue;
          }
          if (obs.x > seg.start) next.push({ start: seg.start, end: obs.x });
          if (obs.x + obs.w < seg.end) next.push({ start: obs.x + obs.w, end: seg.end });
        }
        segments = next;
      }
      if (obs.type === "fallenTree" || obs.type === "stalagmite" || obs.type === "spikes") solids.push({ x: obs.x, y: obs.y, w: obs.w, h: obs.h });
    }

    for (const seg of segments) solids.push({ x: seg.start, y: screen.groundY, w: seg.end - seg.start, h: WORLD.height - screen.groundY });
    for (const platform of screen.platforms || []) solids.push({ ...platform, oneWay: true });
    for (const log of screen.movingLogs || []) {
      if (log.isSurfaced !== false) solids.push({ ...log, oneWay: true, speed: log.speed });
    }
  }

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
        if (solid.speed) p.x += solid.speed;
      } else if (!solid.oneWay && prevTop >= solid.y + solid.h - 6 && p.vy < 0) {
        p.y = solid.y + solid.h;
        p.vy = 0;
      } else if (!solid.oneWay && prevRight <= solid.x + 6 && p.vx > 0) {
        p.x = solid.x - p.w;
      } else if (!solid.oneWay && prevLeft >= solid.x + solid.w - 6 && p.vx < 0) {
        p.x = solid.x + solid.w;
      }
    }
  }

  p.onGround = landed;
  if (!wasOnGround && landed && !p.justDied) synth.playLand();
  p.justDied = false;

  if (p.y > WORLD.height + 40) {
    loseLife("a bottomless fall");
    return;
  }

  const hazardHitbox = { x: p.x + p.w * 0.32, y: p.y + 4, w: p.w * 0.36, h: p.h - 4 };

  for (const obs of screen.obstacles || []) {
    const fatalZone = obstacleFatalZone(obs);
    if (fatalZone && intersects(hazardHitbox, fatalZone)) {
      loseLife(obstacleLabel(obs.type));
      return;
    }
  }

  for (const animal of screen.animals || []) {
    const animalHitbox = animal.type === "bat"
      ? { x: animal.x - 10, y: animal.y - 8, w: animal.w + 20, h: animal.h + 16 }
      : animal;
    if (intersects(p, animalHitbox)) {
      loseLife(animalLabel(animal.type));
      return;
    }
  }

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

  if (gameState.respawnPending) {
    if (performance.now() >= gameState.respawnAt) {
      resetPlayerOnScreen();
      gameState.respawnPending = false;
      gameState.deathMessageUntil = Math.max(gameState.deathMessageUntil, performance.now() + 3000);
    } else {
      updateTreasureBursts();
      return;
    }
  }

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

  if (!gameState.respawnPending && gameState.deathMessage && performance.now() > gameState.deathMessageUntil) gameState.deathMessage = "";
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
    const tone = log.isSurfaced === false ? "#6d4b27" : "#986738";
    drawPixelRect(log.x, log.y, log.w, log.h, tone);
    if (log.isSurfaced !== false) drawPixelRect(log.x + 10, log.y + 6, log.w - 20, 4, "#b07a44");
  }

  const ladder = activeLadderRect(screen);
  if (ladder) {
    drawPixelRect(ladder.x, ladder.y, ladder.w, ladder.h, "#c58f4f");
    for (let y = ladder.y + 8; y < ladder.y + ladder.h; y += 18) drawPixelRect(ladder.x, y, ladder.w, 4, "#83582e");
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

const playerFilmstrip = new Image();
playerFilmstrip.src = "assets/sprites/player_filmstrip.png";

const PLAYER_FILM = {
  frameW: 16,
  frameH: 16,
  rightWalk: [0, 1, 2, 3],
  leftWalk: [4, 5, 6, 7],
};

function drawPlayer() {
  const p = gameState.player;
  const running = Math.abs(p.vx) > 0.1 && p.onGround;
  const jumpPose = !p.onGround && !p.climbing;

  let frameIndex = p.facing < 0 ? PLAYER_FILM.leftWalk[0] : PLAYER_FILM.rightWalk[0];
  if (running) {
    const cycle = Math.floor(p.animTick) % PLAYER_FILM.rightWalk.length;
    frameIndex = p.facing < 0 ? PLAYER_FILM.leftWalk[cycle] : PLAYER_FILM.rightWalk[cycle];
  } else if (jumpPose) {
    frameIndex = p.facing < 0 ? PLAYER_FILM.leftWalk[2] : PLAYER_FILM.rightWalk[2];
  }

  const scale = 6;
  const spriteW = PLAYER_FILM.frameW * scale;
  const spriteH = PLAYER_FILM.frameH * scale;
  const drawX = Math.round(p.x + (p.w - spriteW) / 2);
  const drawY = Math.round(p.y + p.h - spriteH + 10);

  if (playerFilmstrip.complete && playerFilmstrip.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      playerFilmstrip,
      frameIndex * PLAYER_FILM.frameW,
      0,
      PLAYER_FILM.frameW,
      PLAYER_FILM.frameH,
      drawX,
      drawY,
      spriteW,
      spriteH,
    );
    return;
  }

  // fallback silhouette if image failed
  drawPixelRect(drawX + 10, drawY + 8, spriteW - 20, spriteH - 8, "#20b54c");
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

async function startGame() {
  await fileAudio.unlock();
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

if (buildMetaEl) buildMetaEl.textContent = `Build ${BUILD_INFO.number} • ${BUILD_INFO.timestampUtc}`;

updateHud();
loop();
