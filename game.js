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
      whipCast: new Audio("assets/audio/whip_cast.wav"),
      whipRetract: new Audio("assets/audio/whip_retract.wav"),
      whipHit: new Audio("assets/audio/whip_hit.wav"),
      ow: new Audio("assets/audio/ow.wav"),
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
const ELEMENT_BUFFER = 42;
const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, Space: false, KeyX: false };

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
  lastEntrySide: 1,
  whip: { active: false, phase: 0, cooldownUntil: 0, hitApplied: false, playedRetract: false },
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

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6D2B79F5;
    let v = Math.imul(t ^ (t >>> 15), 1 | t);
    v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, list) { return list[Math.floor(rand() * list.length)]; }

function generateName(rand, theme, content) {
  const a = pick(rand, ["Sun", "Moss", "Howler", "Ember", "Jade", "Thorn", "Gloom", "Echo"]);
  const b = pick(rand, ["Run", "Reach", "Hollow", "Span", "Pass", "Crest", "Drop", "Basin"]);
  const c = content.includes("river") ? "Tide" : content.includes("spikes") ? "Fang" : theme === "cave" ? "Depth" : "Trail";
  return `${a} ${b} ${c}`;
}

function makePlatforms(rand, count, yPattern, water = null) {
  const platforms = [];
  const maxY = 426; // never lower than top of player head on ground plane
  const yCandidates = yPattern.filter((y) => y <= maxY);
  const usedY = new Set();

  for (let i = 0; i < count; i++) {
    let y = yCandidates[i % yCandidates.length] ?? (300 + i * 28);
    while (usedY.has(y)) y -= 28;
    y = Math.max(280, Math.min(maxY, y));
    usedY.add(y);

    const w = 98 + Math.floor(rand() * 48);
    let x = 90 + i * 220 + Math.floor(rand() * 40);

    if (water && i % 2 === 1) {
      const overWaterMin = water.x + 14;
      const overWaterMax = water.x + water.w - w - 14;
      if (overWaterMax > overWaterMin) x = Math.floor(overWaterMin + rand() * (overWaterMax - overWaterMin));
    }

    platforms.push({ x, y, w, h: 18 });
  }

  platforms.sort((a, b) => a.x - b.x);
  for (let i = 1; i < platforms.length; i++) {
    const prev = platforms[i - 1];
    const cur = platforms[i];
    if (cur.x < prev.x + prev.w + 32) cur.x = prev.x + prev.w + 32;
  }

  return platforms.filter((p) => p.x + p.w < WORLD.width - 25);
}

function overlapsWater(rect, water) {
  if (!water || !rect) return false;
  return rect.x < water.x + water.w && rect.x + rect.w > water.x && rect.y < water.y + water.h && rect.y + rect.h > water.y;
}

function pickSafeX(rand, w, water = null, min = 40, max = WORLD.width - 40, gap = ELEMENT_BUFFER) {
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(min + rand() * (Math.max(min + 1, max - w - min)));
    if (!water || (x + w <= water.x - gap) || (x >= water.x + water.w + gap)) return x;
  }
  return water && water.x > WORLD.width / 2 ? 60 : WORLD.width - w - 60;
}

function rectGapSeparated(a, b, gap = ELEMENT_BUFFER) {
  return (a.x + a.w + gap <= b.x) || (b.x + b.w + gap <= a.x);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function rectsNear(a, b, gap = ELEMENT_BUFFER) {
  const expanded = { x: b.x - gap, y: b.y - gap, w: b.w + gap * 2, h: b.h + gap * 2 };
  return rectsOverlap(a, expanded);
}

function overlapsBlockingElements(rect, obstacles, platforms = [], ladder = null, extra = [], gap = 0) {
  const blocking = new Set(["gap", "rockPit", "quicksand", "river", "spikes", "stalagmite", "fallenTree"]);
  for (const o of obstacles || []) {
    if (!blocking.has(o.type)) continue;
    if ((gap > 0 && rectsNear(rect, o, gap)) || rectsOverlap(rect, o)) return true;
  }
  for (const p of platforms || []) {
    if ((gap > 0 && rectsNear(rect, p, gap)) || rectsOverlap(rect, p)) return true;
  }
  if (ladder && ((gap > 0 && rectsNear(rect, ladder, gap)) || rectsOverlap(rect, ladder))) return true;
  for (const e of extra || []) {
    if (e && ((gap > 0 && rectsNear(rect, e, gap)) || rectsOverlap(rect, e))) return true;
  }
  return false;
}


function generateScreens(seed = 1337, count = 8) {
  const rand = mulberry32(seed);
  const surface = [];

  for (let i = 0; i < count; i++) {
    const ladderX = rand() < 0.5 ? 56 : 862;
    const hasLadder = rand() > 0.2;
    const hasAnimal = rand() > 0.2;
    const hasTreasure = rand() > 0.33;
    const forceRiver = rand() > 0.25;
    const waterHasLogs = forceRiver ? rand() > 0.32 : false;

    const obstacles = [];
    const hazardChoices = ["quicksand", "gap"];
    if (forceRiver) {
      const riverW = Math.max(Math.floor(WORLD.width * 0.42), Math.floor(WORLD.width / 3));
      const riverX = Math.floor(90 + rand() * Math.max(1, WORLD.width - riverW - 180));
      const riverTopW = Math.max(130, Math.floor(riverW * 0.46));
      obstacles.push({ type: "river", x: riverX, y: 280, w: riverW, h: WORLD.height - 280, topW: riverTopW });
    }
    const water = obstacles.find((o) => o.type === "river") || null;

    const ladder = hasLadder ? { x: ladderX, y: 250, w: 42, h: 290 } : null;
    const ladderSafe = ladder && water && overlapsWater(ladder, water) ? { ...ladder, x: water.x < WORLD.width / 2 ? 862 : 56 } : ladder;

    const extraCount = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < extraCount; k++) {
      const type = pick(rand, hazardChoices);
      const w = type === "fallenTree" ? 150 : 72 + Math.floor(rand() * 40);
      const h = type === "fallenTree" ? 35 : type === "gap" ? 70 : 20;
      const y = type === "fallenTree" ? 430 : 450;
      const x = pickSafeX(rand, w, water, 80, WORLD.width - 80, ELEMENT_BUFFER);
      const hazard = { type, x, y, w, h };
      const tooClose = obstacles.some((o) => o.type !== "river" && !rectGapSeparated(hazard, o, ELEMENT_BUFFER));
      const nearLadder = ladderSafe && rectsNear(hazard, ladderSafe, ELEMENT_BUFFER);
      if ((!water || !overlapsWater(hazard, water)) && !tooClose && !nearLadder) obstacles.push(hazard);
    }

    // Final guardrail: no non-log element may overlap water bounds.
    if (water) {
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        if (o.type !== "river" && overlapsWater(o, water)) obstacles.splice(i, 1);
      }
    }

    const movingLogs = (water && waterHasLogs) ? [0,1,2].map((idx) => {
      const w = 118 + Math.floor(rand() * 26);
      const laneY = [390, 432, 470][idx];
      const minX = water.x + 10;
      const maxX = water.x + water.w - w - 10;
      const startX = Math.floor(minX + rand() * Math.max(1, (maxX - minX)));
      const speedBase = 1.0 + rand() * 0.5;
      return { x: startX, y: laneY, w, h: 20, speed: idx % 2 ? -speedBase : speedBase, minX, maxX };
    }) : undefined;

    let platforms = makePlatforms(rand, 3 + Math.floor(rand() * 2), [338, 300, 338, 376, 312], water);
    // If water has logs, remove any platform above/over water to keep water-log hazards primary.
    if (water && movingLogs) platforms = platforms.filter((pl) => (pl.x + pl.w <= water.x) || (pl.x >= water.x + water.w));
    // Water-only encounter (no logs) can use platforms over water, but ensure left/right anchors are jumpable.
    if (water && !movingLogs && platforms.length >= 2) {
      const sorted = [...platforms].sort((a, b) => a.x - b.x);
      const minJumpableY = 360;
      sorted[0].y = Math.max(sorted[0].y, minJumpableY);
      sorted[sorted.length - 1].y = Math.max(sorted[sorted.length - 1].y, minJumpableY);
    }

    let treasure = null;
    if (hasTreasure) {
      const tw = 28; const th = 24;
      for (let attempt = 0; attempt < 24; attempt++) {
        const tx = pickSafeX(rand, tw, water, 70, WORLD.width - 70, ELEMENT_BUFFER);
        const candidate = { type: rand() > 0.5 ? "gold" : "silver", x: tx, y: 430, w: tw, h: th, value: rand() > 0.5 ? 100 : 50, collected: false };
        if (!overlapsBlockingElements(candidate, obstacles, platforms, ladderSafe, [], ELEMENT_BUFFER)) {
          treasure = candidate;
          break;
        }
      }
    }

    const animals = [];
    if (hasAnimal) {
      const template = pick(rand, [
        { type: "snake", y: 438, w: 52, h: 24, speed: 1.1 },
        { type: "frog", y: 444, w: 28, h: 22, speed: 0.8 },
        { type: "panther", y: 432, w: 70, h: 30, speed: 1.25, hp: 2 },
      ]);
      const minX = water ? Math.max(ELEMENT_BUFFER, (water.x + water.w + ELEMENT_BUFFER < WORLD.width - 140 ? water.x + water.w + ELEMENT_BUFFER : ELEMENT_BUFFER)) : ELEMENT_BUFFER;
      const maxX = water ? Math.min(WORLD.width - ELEMENT_BUFFER, (water.x - ELEMENT_BUFFER > 180 ? water.x - ELEMENT_BUFFER : WORLD.width - ELEMENT_BUFFER)) : WORLD.width - ELEMENT_BUFFER;
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = pickSafeX(rand, template.w, water, minX, maxX, ELEMENT_BUFFER);
        const candidate = { x, y: template.y, w: template.w, h: template.h };
        if (!overlapsBlockingElements(candidate, obstacles, platforms, ladderSafe, treasure ? [treasure] : [], ELEMENT_BUFFER)) {
          animals.push({ x, minX: Math.max(20, minX), maxX: Math.min(WORLD.width - 20, maxX), dir: 1, phase: 0, ...template });
          break;
        }
      }
    }

    const content = obstacles.map((o) => o.type);
    const caveObs = [pick(rand, [
      { type: "rockPit", x: 250, y: 452, w: 86, h: 18 },
      { type: "spikes", x: 300, y: 445, w: 84, h: 25 },
      { type: "stalagmite", x: 520, y: 430, w: 60, h: 40 },
    ]), pick(rand, [{ type: "spikes", x: 620, y: 445, w: 82, h: 25 }, { type: "rockPit", x: 450, y: 452, w: 80, h: 18 }])];

    const surfaceScreen = {
      name: generateName(rand, "surface", content),
      spawn: { x: ladderX < WORLD.width / 2 ? 80 : 820, y: 420 },
      groundY: 470,
      foliage: true,
      obstacles,
      platforms,
      movingLogs,
      animals,
      ladder: ladderSafe,
      treasure,
      underground: {
        name: generateName(rand, "cave", caveObs.map((o) => o.type)),
        spawn: { x: ladderX < WORLD.width / 2 ? 80 : 820, y: 420 },
        groundY: 470,
        obstacles: caveObs,
        platforms: makePlatforms(rand, 3, [360, 330, 360, 300]),
        ladder: ladderSafe ? { x: ladderSafe.x, y: 250, w: 42, h: 290 } : null,
        animals: (() => {
          if (rand() <= 0.45) return [];
          const t = pick(rand, [
            { type: "bat", x: 430, y: 250, w: 44, h: 20, minX: 300, maxX: 700, speed: 1.5, dir: 1, phase: 0 },
            { type: "lizard", x: 640, y: 440, w: 56, h: 20, minX: 540, maxX: 820, speed: 1.3, dir: 1, phase: 0 },
          ]);
          const probe = { x: t.x, y: t.y, w: t.w, h: t.h };
          return overlapsBlockingElements(probe, caveObs, [], ladderSafe ? { x: ladderSafe.x, y: 250, w: 42, h: 290 } : null, [], ELEMENT_BUFFER) ? [] : [t];
        })(),
        treasure: (() => {
          if (rand() <= 0.5) return null;
          const t = { type: "gold", x: 590, y: 300, w: 28, h: 24, value: 100, collected: false };
          return overlapsBlockingElements(t, caveObs, [], null, [], ELEMENT_BUFFER) ? null : t;
        })(),
      },
    };

    surface.push(surfaceScreen);
  }

  return surface;
}

const screens = generateScreens();

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

  playWhipCast() {
    if (fileAudio.playSfx("whipCast")) return;
    this.beep(420, 0.05, "square", 0.11);
    this.beep(700, 0.06, "triangle", 0.08);
  }

  playWhipRetract() {
    if (fileAudio.playSfx("whipRetract")) return;
    this.beep(620, 0.04, "square", 0.09);
    this.beep(360, 0.06, "triangle", 0.07);
  }

  playWhipHit() {
    if (fileAudio.playSfx("whipHit")) return;
    this.noise(0.04, 0.09);
    this.beep(180, 0.05, "square", 0.09);
  }

  playOw() {
    if (fileAudio.playSfx("ow")) return;
    this.beep(330, 0.08, "sawtooth", 0.1);
    this.beep(260, 0.12, "triangle", 0.08);
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
  p.y = screen.spawn.y;
  const side = entryDirection || gameState.lastEntrySide || 1;
  if (side > 0) p.x = 20;
  else p.x = WORLD.width - p.w - 20;
  gameState.lastEntrySide = side;
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


function riverSliceAtY(obs, y) {
  const topW = obs.topW || Math.floor(obs.w * 0.46);
  const t = Math.max(0, Math.min(1, (y - obs.y) / Math.max(1, obs.h)));
  const width = topW + (obs.w - topW) * t;
  const left = obs.x + (obs.w - width) / 2;
  return { left, width };
}

function riverFatalAtPoint(obs, x, y) {
  // Only lethal close to the ground plane where the player can wade in too far.
  if (y < obs.y + obs.h - 88) return false;
  const slice = riverSliceAtY(obs, y);
  const inset = 20;
  return x >= slice.left + inset && x <= slice.left + slice.width - inset;
}

function obstacleGroundCutout(obs) {
  if (obs.type !== "river") return { x: obs.x, w: obs.w };
  const inset = 24;
  return { x: obs.x + inset, w: Math.max(0, obs.w - inset * 2) };
}

function obstacleFatalZone(obs) {
  if (obs.type === "river") return null;
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

  gameState.lastEntrySide = direction > 0 ? 1 : -1;
  resetPlayerOnScreen(gameState.lastEntrySide);
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
        gameState.lastEntrySide = ladder.x < WORLD.width / 2 ? 1 : -1;
        resetPlayerOnScreen(gameState.lastEntrySide);
        synth.beep(210, 0.14, "square", 0.09);
        synth.setTheme(themeKeyForCurrentScreen());
        updateHud();
      }
    } else {
      const bottomStop = ladder.y + ladder.h - p.h;
      p.y = Math.min(bottomStop, p.y);

      if (keys.ArrowUp && p.y <= 0) {
        gameState.underground = false;
        gameState.lastEntrySide = ladder.x < WORLD.width / 2 ? 1 : -1;
        resetPlayerOnScreen(gameState.lastEntrySide);
        synth.beep(420, 0.12, "square", 0.09);
        synth.setTheme(themeKeyForCurrentScreen());
        updateHud();
      }
    }
  }
}

function updateMovingLogs(screen) {
  if (!screen.movingLogs) return;
  let surfacedCount = 0;
  const now = performance.now();

  for (const [idx, log] of screen.movingLogs.entries()) {
    if (log.baseY === undefined) {
      log.baseY = log.y;
      log.sinkCycleMs = 4400 + idx * 550;
      log.sinkWindowMs = 1200;
      log.phaseOffsetMs = idx * 900;
      log.sinkDepth = 24 + idx * 4;
      log.warnWobble = 0;
    }

    log.x += log.speed;
    const minX = log.minX ?? 190;
    const maxX = log.maxX ?? 740;
    if (log.x < minX) log.speed = Math.abs(log.speed);
    if (log.x > maxX) log.speed = -Math.abs(log.speed);

    const cyclePos = (now + log.phaseOffsetMs) % log.sinkCycleMs;
    const subStart = log.sinkCycleMs - log.sinkWindowMs;
    const warnStart = Math.max(0, subStart - 2000);
    let sinkAmount = 0;
    log.warnWobble = 0;

    if (cyclePos >= warnStart && cyclePos < subStart) {
      const t = (cyclePos - warnStart) / 2000;
      log.warnWobble = Math.sin(t * Math.PI * 6) * 2.5;
    }
    if (cyclePos >= subStart) {
      const t = (cyclePos - subStart) / log.sinkWindowMs;
      sinkAmount = Math.sin(Math.min(1, t) * Math.PI) * log.sinkDepth;
    }

    log.y = log.baseY + sinkAmount + log.warnWobble;
    log.isSurfaced = sinkAmount < log.sinkDepth * 0.52;
    if (log.isSurfaced) surfacedCount++;
  }

  if (surfacedCount === 0 && screen.movingLogs.length) {
    const rescue = screen.movingLogs[0];
    rescue.y = rescue.baseY;
    rescue.isSurfaced = true;
    rescue.warnWobble = 0;
  }
}

function updateAnimals(screen) {
  for (let i = (screen.animals || []).length - 1; i >= 0; i--) {
    const animal = screen.animals[i];
    animal.phase = (animal.phase || 0) + 0.14;
    if (animal.hp === undefined) animal.hp = animal.type === "panther" ? 2 : 1;

    if (animal.charging) {
      const p = gameState.player;
      animal.dir = p.x >= animal.x ? 1 : -1;
      animal.speed = Math.max(animal.speed || 1.2, 2.6);
    }

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

    if (animal.hp <= 0) screen.animals.splice(i, 1);
  }
}

function applyWhipHit(screen) {
  const p = gameState.player;
  const range = 88;
  const hit = p.facing > 0
    ? { x: p.x + p.w - 2, y: p.y + 8, w: range, h: p.h - 10 }
    : { x: p.x - range, y: p.y + 8, w: range, h: p.h - 10 };

  for (const animal of screen.animals || []) {
    const box = animal.type === "bat"
      ? { x: animal.x - 10, y: animal.y - 8, w: animal.w + 20, h: animal.h + 16 }
      : animal;
    if (intersects(hit, box)) {
      animal.hp = (animal.hp === undefined ? (animal.type === "panther" ? 2 : 1) : animal.hp) - 1;
      if (animal.type === "panther" && animal.hp === 1) animal.charging = true;
      synth.playWhipHit();
      if (animal.hp <= 0) synth.playOw();
      return true;
    }
  }
  return false;
}

function resolvePlatforms(screen) {
  const p = gameState.player;
  const wasOnGround = p.onGround;
  p.onGround = false;

  if (!p.climbing) {
    if (wasOnGround && p.vy >= 0 && !keys.Space) p.vy = 0;
    else p.vy += WORLD.gravity;
  }
  const impactVy = p.vy;
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
        const cut = obstacleGroundCutout(obs);
        const next = [];
        for (const seg of segments) {
          if (cut.x >= seg.end || cut.x + cut.w <= seg.start) {
            next.push(seg);
            continue;
          }
          if (cut.x > seg.start) next.push({ start: seg.start, end: cut.x });
          if (cut.x + cut.w < seg.end) next.push({ start: cut.x + cut.w, end: seg.end });
        }
        segments = next;
      }
      if (obs.type === "fallenTree" || obs.type === "stalagmite" || obs.type === "spikes") solids.push({ x: obs.x, y: obs.y, w: obs.w, h: obs.h });
    }

    for (const seg of segments) solids.push({ x: seg.start, y: screen.groundY, w: seg.end - seg.start, h: WORLD.height - screen.groundY });
    for (const platform of screen.platforms || []) solids.push({ x: platform.x, y: platform.y + (platform.wobbleY || 0), w: platform.w, h: platform.h, oneWay: true, source: platform, sourceType: "platform" });
    for (const log of screen.movingLogs || []) {
      if (log.isSurfaced !== false) solids.push({ x: log.x, y: log.y, w: log.w, h: log.h, oneWay: true, speed: log.speed, source: log, sourceType: "log" });
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
        if (!wasOnGround && impactVy > 1.2 && solid.sourceType === "platform" && solid.source) {
          solid.source.wobbleTimeLeft = 1.0;
          solid.source.wobblePhase = 0;
        }
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
    if (obs.type === "river") {
      const footX = p.x + p.w * 0.5;
      const footY = p.y + p.h - 2;
      if (riverFatalAtPoint(obs, footX, footY)) {
        loseLife(obstacleLabel(obs.type));
        return;
      }
      continue;
    }
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

function updatePlatformWobbles(screen) {
  const dt = 1 / 60;
  for (const platform of screen.platforms || []) {
    platform.wobbleY = platform.wobbleY || 0;
    platform.wobbleTimeLeft = platform.wobbleTimeLeft || 0;
    platform.wobblePhase = platform.wobblePhase || 0;

    if (platform.wobbleTimeLeft > 0) {
      platform.wobbleTimeLeft = Math.max(0, platform.wobbleTimeLeft - dt);
      platform.wobblePhase += 0.72;
      const t = platform.wobbleTimeLeft / 1.0;
      const amp = 3.2 * t;
      platform.wobbleY = Math.sin(platform.wobblePhase) * amp;
    } else {
      platform.wobbleY = 0;
    }
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
      resetPlayerOnScreen(gameState.lastEntrySide);
      gameState.respawnPending = false;
      gameState.deathMessageUntil = Math.max(gameState.deathMessageUntil, performance.now() + 3000);
    } else {
      updateTreasureBursts();
      return;
    }
  }

  updateMovingLogs(screen);
  updatePlatformWobbles(screen);
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

  const now = performance.now();
  if (keys.KeyX && !gameState.whip.active && now >= gameState.whip.cooldownUntil && !gameState.respawnPending) {
    gameState.whip.active = true;
    gameState.whip.phase = 0;
    gameState.whip.hitApplied = false;
    gameState.whip.playedRetract = false;
    gameState.whip.cooldownUntil = now + 520;
    synth.playWhipCast();
  }
  if (gameState.whip.active) {
    gameState.whip.phase += 0.24;
    if (!gameState.whip.hitApplied && gameState.whip.phase >= 0.38) {
      applyWhipHit(screen);
      gameState.whip.hitApplied = true;
    }
    if (gameState.whip.phase >= 1) {
      if (!gameState.whip.playedRetract) {
        synth.playWhipRetract();
        gameState.whip.playedRetract = true;
      }
      gameState.whip.active = false;
    }
  }

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
    drawPixelRect(0, screen.groundY, WORLD.width, WORLD.height - screen.groundY, "#3b2b22");
    drawPixelRect(0, screen.groundY - 6, WORLD.width, 6, "#5a4233");
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
      case "river": {
        const topW = obs.topW || Math.floor(obs.w * 0.46);
        const topX = obs.x + Math.floor((obs.w - topW) / 2);
        ctx.fillStyle = "#2b79ee";
        ctx.beginPath();
        ctx.moveTo(topX, obs.y);
        ctx.lineTo(topX + topW, obs.y);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.lineTo(obs.x, obs.y + obs.h);
        ctx.closePath();
        ctx.fill();
        for (let i = 0; i < topW; i += 26) drawPixelRect(topX + i, obs.y + 12 + (i % 2 ? 4 : 0), 14, 3, "#7fc0ff");
        for (let i = 0; i < obs.w; i += 34) drawPixelRect(obs.x + i, obs.y + obs.h - 36 + (i % 2 ? 6 : 0), 18, 3, "#7fc0ff");
        break;
      }
      case "gap":
      case "rockPit": {
        const depth = (obs.type === "rockPit" && gameState.underground)
          ? (WORLD.height - obs.y)
          : obs.h;
        const topW = Math.max(18, Math.floor(obs.w * 0.72));
        const topX = obs.x + Math.floor((obs.w - topW) / 2);
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.moveTo(topX, obs.y);
        ctx.lineTo(topX + topW, obs.y);
        ctx.lineTo(obs.x + obs.w, obs.y + depth);
        ctx.lineTo(obs.x, obs.y + depth);
        ctx.closePath();
        ctx.fill();
        break;
      }
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

  for (const platform of screen.platforms || []) drawPixelRect(platform.x, platform.y + (platform.wobbleY || 0), platform.w, platform.h, "#70532d");
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

  const scale = 4.8;
  const spriteW = PLAYER_FILM.frameW * scale;
  const spriteH = PLAYER_FILM.frameH * scale;
  let drawX = Math.round(p.x + (p.w - spriteW) / 2);
  let drawY = Math.round(p.y + p.h - spriteH + 10);

  if (gameState.respawnPending) {
    const lieFrame = p.facing < 0 ? PLAYER_FILM.leftWalk[0] : PLAYER_FILM.rightWalk[0];
    const centerX = Math.round(p.x + p.w / 2);
    const centerY = Math.round(currentScreen().groundY - 20);

    if (playerFilmstrip.complete && playerFilmstrip.naturalWidth > 0) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(
        playerFilmstrip,
        lieFrame * PLAYER_FILM.frameW,
        0,
        PLAYER_FILM.frameW,
        PLAYER_FILM.frameH,
        -Math.round(spriteW / 2),
        -Math.round(spriteH / 2),
        spriteW,
        spriteH,
      );
      ctx.restore();
    } else {
      drawPixelRect(centerX - 34, centerY - 10, 68, 20, "#f2f2f2");
      drawPixelRect(centerX - 6, centerY - 11, 20, 12, "#b98d63");
    }

    drawPixelRect(centerX - 10, centerY - 4, 20, 6, "#3c2415");
    drawPixelRect(centerX - 14, centerY + 1, 28, 3, "#1a120d");
    return;
  }

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
  } else {
    drawPixelRect(drawX + 10, drawY + 8, spriteW - 20, spriteH - 8, "#20b54c");
  }

  // Fedora fallback/accent to guarantee hat appears even if source art differs.
  const headCx = drawX + (p.facing > 0 ? 57 : 39);
  drawPixelRect(headCx - 7, drawY + 10, 14, 6, "#3c2415");
  drawPixelRect(headCx - 11, drawY + 15, 22, 3, "#1a120d");

  if (gameState.whip.active) {
    const t = gameState.whip.phase;
    const ext = t < 0.5 ? t / 0.5 : (1 - t) / 0.5;
    const whipLen = 20 + ext * 92;
    const startX = p.facing > 0 ? p.x + p.w + 2 : p.x - 2;
    const startY = p.y + 22;
    const dir = p.facing > 0 ? 1 : -1;
    const thickness = ext > 0.85 ? 2 : 3;
    drawPixelRect(startX, startY, dir * whipLen, thickness, "#2b1a0f");
    const tipX = startX + dir * whipLen;
    drawPixelRect(tipX - (dir > 0 ? 0 : 2), startY - 1, 3, 5, "#1a110a");
  }
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
