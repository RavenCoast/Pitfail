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

## GitHub Desktop merge workflow (recommended for each new build)

When you receive a new build branch/PR, use this exact order to reduce conflicts:

1. Open **GitHub Desktop** and select your `Pitfail` repository.
2. Click **Fetch origin**.
3. Switch to your working build branch (for example `work`).
4. Click **Branch → Update from main** (or merge `main` into your branch).
5. If prompted about conflicts, use the conflict editor and choose the incoming build changes where appropriate, then mark files resolved and **Commit merge**.
6. Click **Push origin** for your branch.
7. Open the PR on GitHub and use **Squash and merge** into `main`.
8. Back in GitHub Desktop, switch to `main` and click **Pull origin** so your local `main` matches GitHub.

This flow is the one to repeat each time so you do not need to resolve the same conflicts repeatedly.

## GitHub Pages (play without local server)

After your changes are merged into `main`, play Pitfail at:

```text
https://ravencoast.github.io/Pitfail/
```

If the latest build is not visible yet, wait 1-3 minutes and refresh (GitHub Pages redeploy can take a moment).

## Build refresh note

If you ever hit a merge mistake, ask for a **depot refresh build** and I can publish a fresh commit/PR so you have a clean new merge target.

