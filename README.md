# Kotoba no Kizuna

**Kotoba no Kizuna** (言葉の絆, "bonds of words") is an offline, AI-companion
desktop app for learning Japanese the way you'd actually learn it from people:
by talking. You summon a cast of companions — each a different personality with
a different teaching philosophy — and simply chat with them. They weave new
vocabulary into the conversation, the app quietly files every word into a
spaced-repetition deck, and you review those cards when they're due. Rarity
doesn't make a companion a "stronger unit"; it makes her a *better teacher*.

Everything runs on your own machine against your own local model. Nothing is
sent to a hosted API, ever.

```
        you  ──►  chat with a companion  ──►  she teaches a word in context
                                                        │
        gems / shards ◄── daily commissions            ▼
                                                        │
        you  ◄── review due cards (SM-2)  ◄──  SRS deck + vocab dictionary
                                                        │
        companions ◄── gacha / random banner ──  bond & abilities unlock
```

## Stack

**Tauri 2 (Rust)** + **React 19 + TypeScript** + **Zustand** + **SQLite**
(via `tauri-plugin-sql`) + a **local model server** (llama-server,
OpenAI-compatible) for dialogue and character generation + **`lindera`** for
Japanese morphological analysis. Optional: a local **ComfyUI** instance for
generating companion art and training per-character LoRAs.

## Quick start

```bash
npm install

# In a separate terminal, start your local model server first:
llama-server -m /path/to/model.gguf -c 8192 --host 127.0.0.1 --port 8080 -ngl 999

npm run tauri dev
```

No API key is needed by default. The SQLite database is created automatically on
first launch. If you changed llama-server's host/port or started it with
`--api-key`, see [Configuration](docs/configuration.md).

> **Want the full art + LoRA pipeline too?** The core app works without it, but
> generating companion portraits and training per-character LoRAs requires a
> local ComfyUI install. Set that up via
> [`src-tauri/comfyui/README.md`](src-tauri/comfyui/README.md). Details in
> [Character art & LoRA training](docs/art-and-lora.md).

## Using the app

The top bar is a row of tabs plus your currency (gems + shards) and an
activity **Log** toggle (top-right — it's where the art/LoRA pipeline reports
progress). Only **Rin** is owned at first; the rest are earned.

| Tab | What it is | Deep dive |
|---|---|---|
| **Chat** | Talk to your active companion; she teaches vocab in context and your bond grows. Switch between owned companions with the pill row under the nav. | [Teaching & review](docs/teaching.md) |
| **Review** | Spaced-repetition cards for everything you've been taught. Flip, then grade. | [Teaching & review](docs/teaching.md#review) |
| **Commissions** | Three daily tasks that pay gems when you claim them. | [Daily commissions](docs/commissions.md) |
| **Gacha** | The curated **Standard Summon** — weighted pulls, hard pity, duplicate refunds. | [Banners & economy](docs/banners.md) |
| **Random** | The **Random Banner** roulette — a 1-in-6 chance to *invent* a brand-new, unique companion. | [Banners & economy](docs/banners.md) |
| **Abilities** | Global passive "learning tools" unlocked by bonding with companions; toggleable. A red dot marks unseen unlocks. | [Abilities](docs/abilities.md) |
| **Sandbox** | A direct window into the Rust `lindera` tokenizer — paste Japanese, see the morphemes. | [Architecture](docs/architecture.md#japanese-nlp-sandbox) |

## Feature deep dives

Each of these documents one system in depth, including the exact numbers
(rates, thresholds, formulas) and *why* it's shaped the way it is.

- [**Companions**](docs/companions.md) — the curated roster, rarity, and how a persona drives every turn.
- [**Teaching & review**](docs/teaching.md) — the chat loop, dynamic teaching depth, the relationship system, daily routines, and the SM-2 review engine.
- [**Banners & economy**](docs/banners.md) — the Standard gacha and the Random roulette, and how gems vs. shards keep them separate.
- [**Abilities**](docs/abilities.md) — the four signature global passives and how unlocking works.
- [**Daily commissions**](docs/commissions.md) — the daily task loop that funds the gacha.
- [**Character art & LoRA training**](docs/art-and-lora.md) — the multi-stage pipeline that portraits a companion and trains a LoRA so she renders consistently. *(Work in progress — see the known-issues note.)*
- [**Architecture**](docs/architecture.md) — how it all fits together under the hood.
- [**Configuration**](docs/configuration.md) — every environment variable, where your data lives, and how to swap models.
- [**Troubleshooting**](docs/troubleshooting.md) — the errors you'll actually hit and how to fix them.

## How it works, in one paragraph

A React frontend talks to a Rust backend through Tauri commands. Dialogue and
character generation are sent to your local llama-server, but the model's output
is pinned to an exact JSON shape — and, for teaching fields, to English-only
character classes — by a **GBNF grammar**, so replies are always structured and
can't drift into Japanese where English is expected. Every word taught is written
to a vocab dictionary and a SQLite-backed SRS deck; the deck reschedules itself
with the **SM-2** algorithm. Companion personas, abilities, commissions, and the
gacha/random-banner economy all live in SQLite and survive restarts. See
[Architecture](docs/architecture.md) for the full picture.

## Development

- `npm run dev` — Vite only (frontend in a browser; Tauri commands unavailable).
- `npm run tauri dev` — the full app (spawns Vite via `beforeDevCommand`).
- `npm run lint` — `oxlint` (config in `.oxlintrc.json`).
- `npm run build` — `tsc -b && vite build` (this is the only typecheck).
- `./scripts/reset-dev-db.sh` — delete the dev SQLite db so it rebuilds from the
  current migrations (see [Troubleshooting](docs/troubleshooting.md)).

There is no test suite configured yet.

## Roadmap

1. **Rotating shop** - same procedural character pool as the Random banner,
   but a small curated selection refreshed daily (low rarity) / weekly (high
   rarity) for direct purchase instead of RNG pulls.
2. **AI-generated character art** - a Rust HTTP client analogous to the
   llama-server integration, hitting a local ComfyUI instance with the
   `visual_design_prompt` already being generated and saved per character,
   using the Hoseki LustrousMix Anima checkpoint. Not started, and can't be
   tested in the environment this was built in (no GPU, no reachable
   ComfyUI/civitai) - the Rust side can be written following the existing
   local-server pattern, but needs real testing on a machine that has
   ComfyUI running.
3. Events (seasonal banners/stories) and outfits — see the See-through /
   StretchyStudio discussion for the art pipeline plan there too.
4. Reading/listening toolkit (hover dictionary, sentence mining) — reuses
   the tokenizer that's already there.
5. A real animated companion — see the "Live2D" discussion for the current
   plan (procedural layer animation first, real rigging later).
6. Desktop assistant overlay (OCR, clipboard translation) — leverages the
   fact this is already a native Tauri app.
7. **Adventure gacha** (mid-term) - a Red Light/Green Light + dice-driven
   event run as an alternate pull mechanic, with power-ups and hazards along
   the way.
8. **Living worlds** (far future) - 3D character/environment generation with
   auto-rigging, for real-time interactive bonding.
