#!/usr/bin/env python3
"""Generate local PNG/WAV assets for Pitfail without committing binaries.

This script intentionally uses only the Python standard library so it can run on
most machines with a single command.
"""

from __future__ import annotations

import argparse
import math
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


def generate_player_filmstrip(path: Path) -> None:
    frame_w, frame_h, frames = 16, 16, 8
    width, height = frame_w * frames, frame_h
    px = bytearray(width * height * 4)

    transparent = (0, 0, 0, 0)
    green = (33, 181, 76, 255)
    dark_green = (18, 115, 48, 255)
    skin = (255, 220, 173, 255)
    eye = (12, 24, 34, 255)

    for f in range(frames):
        ox = f * frame_w
        _rect(px, width, ox, 0, frame_w, frame_h, transparent)
        _rect(px, width, ox + 6, 5, 4, 7, green)
        _rect(px, width, ox + 6, 3, 4, 2, skin)
        _rect(px, width, ox + 9, 4, 1, 1, eye)

        arm_offset = [0, 1, 0, -1][f % 4]
        _rect(px, width, ox + 5, 7 + arm_offset, 1, 3, dark_green)
        _rect(px, width, ox + 10, 7 - arm_offset, 1, 3, dark_green)

        leg_offset = [0, 1, 0, -1][f % 4]
        _rect(px, width, ox + 6, 12, 1, 3 + max(0, leg_offset), dark_green)
        _rect(px, width, ox + 9, 12, 1, 3 + max(0, -leg_offset), dark_green)

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


def generate_audio() -> None:
    synth_tone(AUDIO_DIR / "jump.wav", [(660, 0.10), (880, 0.12), (1100, 0.12)], bpm=240)
    synth_tone(AUDIO_DIR / "land.wav", [(180, 0.18), (140, 0.16)], bpm=170)
    synth_tone(AUDIO_DIR / "death.wav", [(280, 0.20), (220, 0.18), (160, 0.25), (110, 0.30)], bpm=180)
    synth_tone(AUDIO_DIR / "treasure.wav", [(900, 0.08), (1200, 0.08), (1500, 0.10)], bpm=240)

    surface_phrase = [
        (523.25, 0.5), (659.25, 0.5), (783.99, 0.5), (659.25, 0.5),
        (587.33, 0.5), (523.25, 0.5), (659.25, 0.5), (493.88, 0.5),
    ]
    cave_phrase = [
        (392.00, 0.5), (493.88, 0.5), (587.33, 0.5), (493.88, 0.5),
        (440.00, 0.5), (392.00, 0.5), (493.88, 0.5), (369.99, 0.5),
    ]
    synth_tone(AUDIO_DIR / "music_surface.wav", surface_phrase * 4, bpm=128)
    synth_tone(AUDIO_DIR / "music_cave.wav", cave_phrase * 4, bpm=116)


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
    print("- assets/audio/music_surface.wav")
    print("- assets/audio/music_cave.wav")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
