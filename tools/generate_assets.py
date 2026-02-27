#!/usr/bin/env python3
"""Generate local PNG/WAV assets for Pitfail without committing binaries."""

from __future__ import annotations

import argparse
import math
import random
import struct
import wave
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
AUDIO_DIR = ASSETS / "audio"
SPRITE_DIR = ASSETS / "sprites"


def _chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def write_rgba_png(path: Path, width: int, height: int, rgba: bytes) -> None:
    if len(rgba) != width * height * 4:
        raise ValueError("RGBA payload length does not match width*height*4")

    rows = []
    stride = width * 4
    for y in range(height):
        row = rgba[y * stride : (y + 1) * stride]
        rows.append(b"\x00" + row)

    compressed = zlib.compress(b"".join(rows), level=9)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)

    png = b"\x89PNG\r\n\x1a\n"
    png += _chunk(b"IHDR", ihdr)
    png += _chunk(b"IDAT", compressed)
    png += _chunk(b"IEND", b"")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def _put(px: bytearray, w: int, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    if not (0 <= x < w) or y < 0:
        return
    i = (y * w + x) * 4
    if i + 4 > len(px):
        return
    px[i : i + 4] = bytes(color)


def _rect(px: bytearray, w: int, x: int, y: int, rw: int, rh: int, color: tuple[int, int, int, int]) -> None:
    for yy in range(y, y + rh):
        for xx in range(x, x + rw):
            _put(px, w, xx, yy, color)


def _draw_frame_right(
    px: bytearray,
    canvas_w: int,
    ox: int,
    *,
    front_leg: tuple[int, int, int],
    back_leg: tuple[int, int, int],
    front_arm: tuple[int, int, int],
    back_arm: tuple[int, int, int],
) -> None:
    transparent = (0, 0, 0, 0)
    tunic = (35, 181, 77, 255)
    tunic_dark = (22, 122, 54, 255)
    skin = (255, 222, 178, 255)
    boot = (40, 34, 45, 255)
    outline = (14, 22, 32, 255)

    _rect(px, canvas_w, ox, 0, 16, 16, transparent)

    # Head/profile facing right + fedora.
    _rect(px, canvas_w, ox + 9, 2, 4, 3, skin)
    _rect(px, canvas_w, ox + 8, 0, 6, 2, (70, 44, 28, 255))
    _rect(px, canvas_w, ox + 7, 2, 8, 1, (30, 20, 14, 255))
    _put(px, canvas_w, ox + 13, 3, outline)  # eye
    _put(px, canvas_w, ox + 12, 4, outline)  # nose/chin hint

    # Torso and shoulder.
    _rect(px, canvas_w, ox + 7, 5, 4, 6, tunic)
    _rect(px, canvas_w, ox + 7, 5, 2, 6, tunic_dark)

    # Back arm (upper + forearm) bent elbow.
    bux, buy, bfx = back_arm
    _rect(px, canvas_w, ox + bux, buy, 2, 2, tunic_dark)
    _rect(px, canvas_w, ox + bfx, buy + 2, 2, 2, tunic_dark)

    # Front arm (upper + forearm) bent elbow.
    fux, fuy, ffx = front_arm
    _rect(px, canvas_w, ox + fux, fuy, 2, 2, tunic)
    _rect(px, canvas_w, ox + ffx, fuy + 2, 2, 2, tunic)

    # Back leg (thigh + shin) with knee bend.
    btx, bty, bsx = back_leg
    _rect(px, canvas_w, ox + btx, bty, 2, 2, tunic_dark)
    _rect(px, canvas_w, ox + bsx, bty + 2, 2, 2, tunic_dark)
    _rect(px, canvas_w, ox + bsx, bty + 4, 2, 1, boot)

    # Front leg (thigh + shin) with knee bend.
    ftx, fty, fsx = front_leg
    _rect(px, canvas_w, ox + ftx, fty, 2, 2, tunic)
    _rect(px, canvas_w, ox + fsx, fty + 2, 2, 2, tunic)
    _rect(px, canvas_w, ox + fsx, fty + 4, 2, 1, boot)


def generate_player_filmstrip(path: Path) -> None:
    frame_w, frame_h, frames = 16, 16, 8
    width, height = frame_w * frames, frame_h
    px = bytearray(width * height * 4)

    # Right-facing run cycle (4 frames): explicit side profile with elbow/knee bends.
    run_cycle = [
        {
            "front_leg": (10, 11, 12),
            "back_leg": (8, 11, 7),
            "front_arm": (10, 7, 12),
            "back_arm": (7, 6, 6),
        },
        {
            "front_leg": (10, 11, 11),
            "back_leg": (8, 11, 8),
            "front_arm": (10, 7, 11),
            "back_arm": (7, 6, 7),
        },
        {
            "front_leg": (9, 11, 8),
            "back_leg": (10, 11, 11),
            "front_arm": (8, 7, 7),
            "back_arm": (10, 6, 11),
        },
        {
            "front_leg": (9, 11, 9),
            "back_leg": (10, 11, 10),
            "front_arm": (8, 7, 8),
            "back_arm": (10, 6, 10),
        },
    ]

    for f in range(4):
        ox = f * frame_w
        _draw_frame_right(px, width, ox, **run_cycle[f])

    # Mirror right-walk (first 4) into left-walk (last 4)
    for f in range(4):
        src_ox = f * frame_w
        dst_ox = (f + 4) * frame_w
        for y in range(frame_h):
            for x in range(frame_w):
                si = ((y * width) + (src_ox + x)) * 4
                di = ((y * width) + (dst_ox + (frame_w - 1 - x))) * 4
                px[di : di + 4] = px[si : si + 4]

    write_rgba_png(path, width, height, bytes(px))


def _envelope(t: float, attack: float, decay: float, sustain: float, release: float, total: float) -> float:
    if t < attack:
        return t / max(attack, 1e-6)
    if t < attack + decay:
        d = (t - attack) / max(decay, 1e-6)
        return 1.0 - d * (1.0 - sustain)
    if t < total - release:
        return sustain
    r = (t - (total - release)) / max(release, 1e-6)
    return sustain * (1.0 - max(0.0, min(1.0, r)))


def synth_tone(path: Path, notes: list[tuple[float, float]], bpm: int = 120, sample_rate: int = 44100) -> None:
    beat_s = 60.0 / bpm
    frames = bytearray()

    for freq, beats in notes:
        dur = beats * beat_s
        count = int(dur * sample_rate)
        for i in range(count):
            t = i / sample_rate
            env = _envelope(t, 0.01, 0.08, 0.65, min(0.12, dur / 2), dur)
            s = (
                0.62 * math.sin(2 * math.pi * freq * t)
                + 0.28 * math.sin(2 * math.pi * freq * 2 * t)
                + 0.10 * (1.0 if math.sin(2 * math.pi * freq * t) > 0 else -1.0)
            )
            sample = int(max(-1.0, min(1.0, s * env * 0.7)) * 32767)
            frames += struct.pack("<h", sample)

    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(bytes(frames))


def _kick(phase_t: float) -> float:
    freq = 120.0 - 70.0 * min(1.0, phase_t / 0.12)
    amp = max(0.0, 1.0 - phase_t / 0.18)
    return math.sin(2 * math.pi * freq * phase_t) * amp


def _snare(phase_t: float, rng: random.Random) -> float:
    amp = max(0.0, 1.0 - phase_t / 0.16)
    noise = rng.uniform(-1.0, 1.0)
    tone = math.sin(2 * math.pi * 190 * phase_t) * 0.28
    return (noise * 0.72 + tone) * amp


def _hat(phase_t: float, rng: random.Random) -> float:
    amp = max(0.0, 1.0 - phase_t / 0.06)
    noise = rng.uniform(-1.0, 1.0)
    return noise * amp


def synth_loop_with_percussion(
    path: Path,
    melody: list[float | None],
    bass: list[float | None],
    drum_pattern: list[str],
    *,
    bpm: int,
    loops: int = 4,
    sample_rate: int = 44100,
) -> None:
    step_s = 60.0 / bpm / 2.0  # 8th-note grid
    phrase_len = len(melody)
    total_steps = phrase_len * loops
    total_samples = int(total_steps * step_s * sample_rate)
    rng = random.Random(1337)

    kick_starts: list[float] = []
    snare_starts: list[float] = []
    hat_starts: list[float] = []

    for step in range(total_steps):
        t0 = step * step_s
        drum = drum_pattern[step % len(drum_pattern)]
        if "k" in drum:
            kick_starts.append(t0)
        if "s" in drum:
            snare_starts.append(t0)
        if "h" in drum:
            hat_starts.append(t0)

    samples = bytearray()
    for i in range(total_samples):
        t = i / sample_rate
        step_index = int(t / step_s) % phrase_len
        step_t = t % step_s

        m = melody[step_index]
        b = bass[step_index]

        melodic = 0.0
        if m:
            env = _envelope(step_t, 0.005, 0.08, 0.58, 0.04, step_s)
            melodic += (0.72 * math.sin(2 * math.pi * m * t) + 0.28 * math.sin(2 * math.pi * m * 2 * t)) * env
        if b:
            envb = _envelope(step_t, 0.005, 0.05, 0.72, 0.03, step_s)
            melodic += (0.82 * math.sin(2 * math.pi * b * t) + 0.18 * math.sin(2 * math.pi * b * 0.5 * t)) * envb * 0.75

        drums = 0.0
        for st in kick_starts:
            dt = t - st
            if 0 <= dt <= 0.2:
                drums += _kick(dt) * 0.65
        for st in snare_starts:
            dt = t - st
            if 0 <= dt <= 0.17:
                drums += _snare(dt, rng) * 0.40
        for st in hat_starts:
            dt = t - st
            if 0 <= dt <= 0.07:
                drums += _hat(dt, rng) * 0.20

        s = melodic * 0.42 + drums * 0.58
        sample = int(max(-1.0, min(1.0, s)) * 32767)
        samples += struct.pack("<h", sample)

    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(bytes(samples))


def generate_audio() -> None:
    synth_tone(AUDIO_DIR / "jump.wav", [(660, 0.10), (880, 0.12), (1100, 0.12)], bpm=240)
    synth_tone(AUDIO_DIR / "land.wav", [(180, 0.18), (140, 0.16)], bpm=170)
    synth_tone(AUDIO_DIR / "death.wav", [(280, 0.20), (220, 0.18), (160, 0.25), (110, 0.30)], bpm=180)
    synth_tone(AUDIO_DIR / "treasure.wav", [(900, 0.08), (1200, 0.08), (1500, 0.10)], bpm=240)
    synth_tone(AUDIO_DIR / "whip_cast.wav", [(420, 0.05), (700, 0.06)], bpm=260)
    synth_tone(AUDIO_DIR / "whip_retract.wav", [(620, 0.04), (360, 0.06)], bpm=260)
    synth_tone(AUDIO_DIR / "whip_hit.wav", [(190, 0.05), (130, 0.05)], bpm=220)
    synth_tone(AUDIO_DIR / "ow.wav", [(330, 0.08), (260, 0.12)], bpm=180)

    surface_melody = [
        523.25, None, 659.25, 783.99, 659.25, None, 587.33, 523.25,
        659.25, None, 783.99, 880.00, 783.99, 659.25, 587.33, None,
    ]
    surface_bass = [
        130.81, None, None, 164.81, None, 196.00, None, 164.81,
        146.83, None, None, 185.00, None, 220.00, None, 185.00,
    ]
    surface_drums = ["kh", "h", "h", "sh", "kh", "h", "h", "sh", "kh", "h", "h", "sh", "kh", "h", "h", "sh"]

    cave_melody = [
        311.13, None, 369.99, 392.00, 349.23, None, 329.63, 311.13,
        293.66, None, 349.23, 392.00, 369.99, 329.63, 311.13, None,
    ]
    cave_bass = [
        77.78, None, None, 92.50, None, 98.00, None, 92.50,
        73.42, None, None, 82.41, None, 87.31, None, 82.41,
    ]
    cave_drums = ["k", "h", "", "sh", "k", "h", "", "sh", "k", "h", "", "sh", "k", "h", "", "sh"]

    synth_loop_with_percussion(
        AUDIO_DIR / "music_surface.wav",
        surface_melody,
        surface_bass,
        surface_drums,
        bpm=126,
        loops=4,
    )
    synth_loop_with_percussion(
        AUDIO_DIR / "music_cave.wav",
        cave_melody,
        cave_bass,
        cave_drums,
        bpm=102,
        loops=4,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate local Pitfail audio and sprite assets.")
    parser.parse_args()

    generate_player_filmstrip(SPRITE_DIR / "player_filmstrip.png")
    generate_audio()

    print("Generated assets:")
    print("- assets/sprites/player_filmstrip.png")
    print("- assets/audio/jump.wav")
    print("- assets/audio/land.wav")
    print("- assets/audio/death.wav")
    print("- assets/audio/treasure.wav")
    print("- assets/audio/whip_cast.wav")
    print("- assets/audio/whip_retract.wav")
    print("- assets/audio/whip_hit.wav")
    print("- assets/audio/ow.wav")
    print("- assets/audio/music_surface.wav")
    print("- assets/audio/music_cave.wav")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
