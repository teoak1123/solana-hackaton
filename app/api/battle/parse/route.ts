import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ACTIONS = new Set([
  "CROUCH_DUCK",
  "PUNCH_STRIKE",
  "LOW_LEG_SWEEP",
  "MID_LEG_KICK",
  "AERIAL_KICK",
  "HEADBUTT_THRUST",
  "SHIELD_BLOCK",
  "ARM_FEINT_WAVE",
  "AERIAL_JUMP",
  "EVASIVE_DODGE",
  "PASSIVE_ABSORB",
  "RAISE_ARM_HIGH",
  "UPPERCUT_LIFT",
  "FLYING_KNEE",
  "SPINNING_BACKFIST",
]);

export interface ParsedPolicyPayload {
  actions: string[];
  repeatPolicy: "ONCE" | "CYCLE" | "ON_EVERY_ATTACK" | "CONTINUOUS_PRESSURE";
  reactiveTrigger?: {
    whenOpponentAttacks?: string;
    whenOpponentDucks?: string;
    whenOpponentJumps?: string;
  };
}

// In-memory LRU cache to optimize multiple battles and preserve tokens
const policyCache = new Map<string, ParsedPolicyPayload>();
const MAX_CACHE_SIZE = 250;
const CACHE_VERSION = "v3:";

function getCachedPolicy(prompt: string): ParsedPolicyPayload | null {
  const key = CACHE_VERSION + prompt.trim().toLowerCase();
  if (!prompt.trim()) return null;
  return policyCache.get(key) || null;
}

function setCachedPolicy(prompt: string, policy: ParsedPolicyPayload) {
  const key = CACHE_VERSION + prompt.trim().toLowerCase();
  if (!prompt.trim()) return;
  if (policyCache.size >= MAX_CACHE_SIZE) {
    const firstKey = policyCache.keys().next().value;
    if (firstKey) policyCache.delete(firstKey);
  }
  policyCache.set(key, policy);
}

async function parsePromptWithGroq(
  prompt: string,
  apiKey: string
): Promise<ParsedPolicyPayload | null> {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  const cached = getCachedPolicy(trimmed);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages: [
          {
            role: "system",
            content:
              'You are the combat intelligence parser for Prompt Fight, a 2D fighting game. Given any directive in Spanish or English, analyze its tactical intent and output JSON: ' +
              '{"actions": ["ACTION", ...], "repeatPolicy": "ONCE" | "CYCLE" | "ON_EVERY_ATTACK" | "CONTINUOUS_PRESSURE", "reactiveTrigger": null | {"whenOpponentAttacks": "ACTION"}}. ' +
              'Allowed actions: ["CROUCH_DUCK", "PUNCH_STRIKE", "LOW_LEG_SWEEP", "MID_LEG_KICK", "AERIAL_KICK", "HEADBUTT_THRUST", "SHIELD_BLOCK", "ARM_FEINT_WAVE", "AERIAL_JUMP", "EVASIVE_DODGE", "PASSIVE_ABSORB", "RAISE_ARM_HIGH", "UPPERCUT_LIFT", "FLYING_KNEE", "SPINNING_BACKFIST"]. ' +
              'CRITICAL RULES: ' +
              '1. ONLY include reactiveTrigger if the user explicitly specifies a condition or reactive rule (e.g. "en cada ataque", "en todos los ataques", "on every attack", "bloquea todo", "defiéndete de todo"). If no reactive condition was requested, reactiveTrigger MUST be null. ' +
              '2. "salta en cada ataque" or "jump on every attack": actions=["AERIAL_JUMP"], repeatPolicy="ON_EVERY_ATTACK", reactiveTrigger={"whenOpponentAttacks": "AERIAL_JUMP"}. ' +
              '3. "agáchate en todos los ataques" or "crouch on every attack": actions=["CROUCH_DUCK"], repeatPolicy="ON_EVERY_ATTACK", reactiveTrigger={"whenOpponentAttacks": "CROUCH_DUCK"}. ' +
              '4. "defiéndete de todos los ataques" or "block everything": actions=["SHIELD_BLOCK"], repeatPolicy="ON_EVERY_ATTACK", reactiveTrigger={"whenOpponentAttacks": "SHIELD_BLOCK"}. ' +
              '5. "esquiva todo" or "dodge all": actions=["EVASIVE_DODGE"], repeatPolicy="ON_EVERY_ATTACK", reactiveTrigger={"whenOpponentAttacks": "EVASIVE_DODGE"}. ' +
              '6. "agáchate" or "crouch": actions=["CROUCH_DUCK"], repeatPolicy="ONCE", reactiveTrigger=null. ' +
              '7. "salta" or "jump": actions=["AERIAL_JUMP"], repeatPolicy="ONCE", reactiveTrigger=null. ' +
              '8. "haz esto" or generic non-specific phrases without naming moves: actions=["PUNCH_STRIKE", "MID_LEG_KICK"], repeatPolicy="ONCE", reactiveTrigger=null. ' +
              '9. Sequential directives (e.g. "agáchate, luego pégale, después salta, luego patada dos veces"): map each step in order, respect repetitions ("dos veces" -> 2 occurrences), repeatPolicy="ONCE", reactiveTrigger=null. ' +
              '10. "ataca sin parar" or "keep attacking": repeatPolicy="CONTINUOUS_PRESSURE", reactiveTrigger=null. ' +
              'Output ONLY valid JSON.',
          },
          {
            role: "user",
            content: trimmed,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return null;

    const parsed = JSON.parse(rawContent);
    const actionsRaw = Array.isArray(parsed.actions) ? parsed.actions : [];
    const validActions = actionsRaw.filter((a: string) => ALLOWED_ACTIONS.has(a));

    const repeatPolicy = ["ONCE", "CYCLE", "ON_EVERY_ATTACK", "CONTINUOUS_PRESSURE"].includes(parsed.repeatPolicy)
      ? parsed.repeatPolicy
      : "ONCE";

    const reactiveTrigger: Record<string, string> = {};
    if (parsed.reactiveTrigger && typeof parsed.reactiveTrigger === "object") {
      if (ALLOWED_ACTIONS.has(parsed.reactiveTrigger.whenOpponentAttacks)) {
        reactiveTrigger.whenOpponentAttacks = parsed.reactiveTrigger.whenOpponentAttacks;
      }
      if (ALLOWED_ACTIONS.has(parsed.reactiveTrigger.whenOpponentDucks)) {
        reactiveTrigger.whenOpponentDucks = parsed.reactiveTrigger.whenOpponentDucks;
      }
      if (ALLOWED_ACTIONS.has(parsed.reactiveTrigger.whenOpponentJumps)) {
        reactiveTrigger.whenOpponentJumps = parsed.reactiveTrigger.whenOpponentJumps;
      }
    }

    const result: ParsedPolicyPayload = {
      actions: validActions.length > 0 ? validActions : ["NEUTRAL_GUARD"],
      repeatPolicy,
      reactiveTrigger: Object.keys(reactiveTrigger).length > 0 ? reactiveTrigger : undefined,
    };

    setCachedPolicy(trimmed, result);
    return result;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { p1Prompt, p2Prompt } = body;

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        p1Policy: null,
        p2Policy: null,
        source: "local",
      });
    }

    const [p1Policy, p2Policy] = await Promise.all([
      parsePromptWithGroq(p1Prompt || "", apiKey),
      parsePromptWithGroq(p2Prompt || "", apiKey),
    ]);

    return NextResponse.json({
      success: true,
      p1Policy,
      p2Policy,
      p1Actions: p1Policy?.actions || null,
      p2Actions: p2Policy?.actions || null,
      source: p1Policy || p2Policy ? "groq" : "local",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Parse error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
