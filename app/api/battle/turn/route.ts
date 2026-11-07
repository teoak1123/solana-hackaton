import { NextRequest, NextResponse } from "next/server";
import { sanitizePrompt, TurnActionSchema, TurnAction } from "@/lib/security";
import { executeDeterministicTurn, GladiatorState } from "@/lib/game-engine";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { p1State, p2State, turnNumber, activeActor, previousHash } = body;

    const actor = activeActor === "P1" ? (p1State as GladiatorState) : (p2State as GladiatorState);
    const target = activeActor === "P1" ? (p2State as GladiatorState) : (p1State as GladiatorState);

    // Prompt input validation
    const auditCheck = sanitizePrompt(actor.prompt);

    if (!auditCheck.valid) {
      return NextResponse.json(
        {
          error: "INVALID_PROMPT_INPUT",
          owaspViolation: auditCheck.owaspViolation,
          reason: auditCheck.reason,
          threatLevel: auditCheck.threatLevel,
        },
        { status: 403 }
      );
    }

    // Process strategy
    const strategy = auditCheck.sanitizedText.toLowerCase();
    let rawAction: TurnAction;

    if (strategy.includes("defens") || strategy.includes("protect") || strategy.includes("stake")) {
      if (actor.shield < 20) {
        rawAction = {
          action: "DEFEND",
          rationale: "Guardrail defensivo: Blindaje de escudo preventivo.",
          taunt: "Defensas impenetrables.",
          confidenceScore: 90,
        };
      } else {
        rawAction = {
          action: "STAKE_SHIELD",
          rationale: "DeFi Protocol: Staking de armadura para yield.",
          taunt: "Generando rendimiento pasivo.",
          confidenceScore: 94,
        };
      }
    } else if (strategy.includes("liquidat") || strategy.includes("agresiv") || strategy.includes("burst")) {
      if (actor.energy >= 40) {
        rawAction = {
          action: "LIQUIDATE_BURST",
          rationale: "Ejecución de liquidación forzada de alta potencia.",
          taunt: "¡Posición liquidada!",
          confidenceScore: 96,
        };
      } else {
        rawAction = {
          action: "ATTACK",
          rationale: "Presión táctica constante.",
          taunt: "No hay escape.",
          confidenceScore: 82,
        };
      }
    } else {
      // Balanced fallback
      if (target.hp <= 30 && actor.energy >= 40) {
        rawAction = {
          action: "LIQUIDATE_BURST",
          rationale: "Objetivo en rango de remate.",
          taunt: "Fin del protocolo.",
          confidenceScore: 98,
        };
      } else if (actor.hp < 40 && actor.shield < 15) {
        rawAction = {
          action: "DEFEND",
          rationale: "Protocolo de mitigación de daño.",
          taunt: "Calculando contraataque.",
          confidenceScore: 86,
        };
      } else {
        rawAction = {
          action: "ATTACK",
          rationale: "Vector de ataque estándar.",
          taunt: "Ataque coordinado.",
          confidenceScore: 80,
        };
      }
    }

    // Runtime schema validation
    const validatedAction = TurnActionSchema.parse(rawAction);

    // Resolve turn math deterministically
    const turnResult = executeDeterministicTurn(
      actor,
      target,
      validatedAction.action,
      validatedAction.taunt
    );

    const nextP1 = activeActor === "P1" ? turnResult.actorNext : turnResult.targetNext;
    const nextP2 = activeActor === "P1" ? turnResult.targetNext : turnResult.actorNext;

    // HMAC combat hash proof
    const turnPayload = `${previousHash || "GENESIS"}:${turnNumber}:${activeActor}:${validatedAction.action}:${turnResult.damage}:${nextP1.hp}:${nextP2.hp}`;
    const turnHash = crypto
      .createHmac("sha256", "SOLANA_COMBAT_CHAIN_SECRET_KEY")
      .update(turnPayload)
      .digest("hex");

    return NextResponse.json({
      success: true,
      securityStatus: "VERIFIED",
      action: validatedAction,
      turnResult,
      nextP1,
      nextP2,
      turnHash,
      winner: nextP1.hp <= 0 ? "P2" : nextP2.hp <= 0 ? "P1" : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Error";
    return NextResponse.json(
      { error: "RUNTIME_FAULT", details: message },
      { status: 500 }
    );
  }
}
