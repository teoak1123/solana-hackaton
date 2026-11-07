# Prompt Fight: Who Writes the Best Prompt?

Prompt Fight is a tactical fighting arena where players command fighters entirely through natural language instructions. The winner is determined by who formulates the smartest combat prompts and anticipates their opponent's tactics.

Instead of pressing buttons or memorizing combos, players type natural language combat directives in English or Spanish. The game interprets the strategic intent, extracts sequential actions and dynamic reactive triggers, and executes the fight frame-by-frame on an HTML5 canvas at 60 FPS with retro procedural audio.

## Gameplay Mechanics

### Natural Language Tactical Directives
The engine does not rely on rigid keyword matching. It understands multi-step sequences, repetitions, conditional triggers, and persistent behavioral policies:
- Reactive Triggers: Commands like "salta en cada ataque" (jump on every attack) or "block every strike" cause the fighter to react dynamically whenever the opponent launches an attack.
- Multi-Step Combos and Repetitions: Commands like "agáchate, luego pégale, después salta y pégale con una patada dos veces" are parsed into distinct sequential phases with exact repetitions.
- Continuous Pressure: Commands like "ataca sin parar" (keep attacking) sustain offensive momentum across combat phases.
- Defensive and Stoic Orders: Commands like "no hagas nada, deja que te pegue" activate damage absorption mode without misinterpreting isolated words.

### 18 Articulated Combat Actions
The kinematic engine supports 18 distinct physical moves with full joint rendering:
- Strikes: Straight Punch, Mid Leg Kick, Low Floor Sweep, Uppercut Lift, Flying Knee, Spinning Backfist, Headbutt Thrust, Aerial Kick.
- Defenses: Energy Shield Block, High Arm Guard, Deep Crouch Duck, Head Slip / Weave, Evasive Dodge.
- Positioning: Aerial Jump, Tactical Arm Feint, Adaptive Counter, Stoic Absorb, Neutral Ready Stance.

### Physical Collision Matrix
Simultaneous actions resolve using spatial priority:
- Aerial jumps and flying kicks leap cleanly over ground sweeps.
- Low crouches duck under high punches and headbutts.
- Uppercuts punish crouching and aerial opponents.
- Energy shields absorb direct impacts unless baited by feints.
- Mutual direct attacks result in clash damage trades.

## AI Architecture and Performance

### Hybrid Intelligence with LRU Policy Caching
- Primary Parser: Uses Groq Cloud LPU acceleration (Qwen 3.8 27B) with structured JSON output and a 2500ms timeout. Inferences typically complete in under 100ms.
- Memory Caching: An in-memory LRU policy cache stores normalized prompt resolutions, allowing repeated battles and rematches to run at 0ms latency with zero API token consumption.
- On-Device Resilient Fallback: If network connectivity drops or rate limits are reached, an on-device subword semantic compiler executes locally with zero external dependencies.

## Optional Solana Escrow Wagering

- Players can optionally deposit SOL into a non-custodial escrow vault before the match.
- Each round generates an HMAC SHA-256 combat hash chaining state, actions, and damage.
- Upon knockout, the verified winner receives the pot on-chain.
- The game can also be played in standalone mode with wagering disabled.

## Hackathon Categories Alignment

1. AI Track: Real-time hybrid NLU parser handling open-ended prompts, reactive policies ("jump on every attack"), multi-step sequences, typo tolerance, and in-combat adaptation memory.
2. Gaming Track: Playable 60 FPS canvas fighter with frame-by-frame joint interpolation, hit sparks, screen shake, and Web Audio API 8-bit procedural sound synthesis.
3. DeFi Track: Non-custodial Solana escrow vault with time-locked deposits, yield-staking armor mechanics, and cryptographic proof-of-combat turn validation.
4. Best Beginner Hack: Clean modular TypeScript codebase, zero configuration needed to run, and instant execution.
5. Top 3 Overall: An original concept fusing prompt engineering battles, retro arcade gaming, and Web3 wagering.

## Quickstart

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open http://localhost:3000 in your browser.
