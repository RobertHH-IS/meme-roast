# meme-roast

Voice-driven roast meme overlay. Listens via the OpenAI Realtime API and fires memes from [memegen.link](https://memegen.link) when the model decides something is roastable.

## Setup

```bash
npm install
cp .env.example .env
# paste your OPENAI_API_KEY into .env
npm run dev
```

A frameless transparent window pins to the top-right of your primary display. Click **start listening** and grant mic access on first run.

## Hotkeys

| Combo | Action |
|---|---|
| `Cmd/Ctrl + Shift + K` | Kill the last meme (and cool that template down for the session) |
| `Cmd/Ctrl + Shift + M` | Mute (pauses the roast loop, keeps the connection warm) |
| `Cmd/Ctrl + Shift + Space` | Force a meme right now |

## How it works

- Renderer connects to `gpt-realtime-mini` over WebRTC with `output_modalities: ["text"]` (model never speaks).
- A 12s heartbeat fires `response.create` asking the model to scan recent audio and call `generate_meme` only if something's roastable.
- Tool args → memegen.link URL → rendered as `<img>` in `MemeStage` and stacked in `MemeFeed`.
- Killed memes go into a session cooldown set so the model stops re-picking duds.

## Curating the meme catalog

The starter catalog ships with 35 templates (`src/renderer/src/memes/catalog.json`). To expand:

```bash
npm run seed:catalog
```

This dumps all 481 memegen templates to `catalog.full.json`. Pick the funny ones, write a one-line `when` description per template (the model uses this to decide when to fire each), and merge them into `catalog.json`.

## Project layout

```
src/
├── main/              # Electron main: window, IPC, hotkeys, ephemeral key minting
├── preload/           # contextBridge: getEphemeralKey, onHotkey
└── renderer/src/
    ├── realtime/      # WebRTC client, tool defs, system prompt builder
    ├── memes/         # catalog + memegen URL builder
    ├── components/    # StatusBar, MemeStage, MemeFeed
    ├── store.ts       # zustand state
    └── App.tsx        # heartbeat + hotkey wiring
```

## Cost

`gpt-realtime-mini` runs around `$1.50/hr` of continuous listening with text-only output. Tool calls are nearly free (small JSON args). memegen.link is free.
