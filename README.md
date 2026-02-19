# Pitfail

Pitfail is a retro-inspired 2D browser platformer set in a bright 8-bit jungle world.

## Features

- Splash screen and PITFAIL logo on launch
- Arrow key movement and `Space` jump controls
- Ladder traversal to underground screens
- Fatal obstacles (quicksand, river hazards, pits, spikes, animals)
- Score system: +100 for each screen traversed
- Lives system: starts at 99, lose 1 on fatal failures
- 8-bit-style visuals, sound effects, and looping chiptune-like music

## Run locally

From the repository root:

```bash
python3 -m http.server 4173
```

Open in your browser:

```text
http://127.0.0.1:4173
```

Then click **Start Adventure** on the splash screen.

## Controls

- `←` / `→`: Move left/right
- `↑` / `↓`: Climb ladders
- `Space`: Jump

## Gameplay rules

- Start at **Score: 0** and **Lives: 99**
- Each time you traverse to another screen, score increases by **100**
- If you hit a fatal hazard, you respawn at the current screen spawn point and lose **1 life**

## Quick browser test checklist

1. Verify splash screen appears on launch.
2. Click **Start Adventure** and confirm movement/jump work.
3. Traverse to a new screen and verify score increases by +100.
4. Touch a fatal obstacle and verify one life is deducted and respawn occurs.

## Repository note

I can prepare and commit files in this local git repository, but I cannot directly push to your GitHub remote unless credentials/remote access are configured in this environment.

If your remote is configured, you can publish with:

```bash
git push origin <your-branch>
```
