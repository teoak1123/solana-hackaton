import { TurnAction } from "./security";

export interface GladiatorState {
  id: "P1" | "P2";
  name: string;
  prompt: string;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  shield: number;
  stakedShieldYield: number; // Mecánica DeFi: Yield que regenera HP
}

export interface TurnOutcome {
  turnNumber: number;
  actor: "P1" | "P2";
  action: TurnAction["action"];
  damage: number;
  shieldGain: number;
  energyUsed: number;
  yieldGained: number;
  taunt: string;
  p1Hp: number;
  p2Hp: number;
  turnHash: string;
}

// Motor de reglas determinista: LA IA NO DECIDE LOS NÚMEROS. Solo decide la acción.
export function executeDeterministicTurn(
  actorState: GladiatorState,
  targetState: GladiatorState,
  action: TurnAction["action"],
  taunt: string
): {
  actorNext: GladiatorState;
  targetNext: GladiatorState;
  damage: number;
  shieldGain: number;
  energyCost: number;
  yieldGained: number;
} {
  const actor = { ...actorState };
  const target = { ...targetState };

  let damage = 0;
  let shieldGain = 0;
  let energyCost = 0;
  let yieldGained = 0;

  // Intereses de Shield Staking previo (DeFi Passive Yield)
  if (actor.stakedShieldYield > 0) {
    const passiveHeal = Math.min(10, actor.stakedShieldYield * 2);
    actor.hp = Math.min(actor.maxHp, actor.hp + passiveHeal);
  }

  switch (action) {
    case "ATTACK": {
      energyCost = 20;
      const baseDamage = 22 + Math.floor(Math.random() * 8); // 22-30 dmg
      const absorbed = Math.min(target.shield, baseDamage);
      target.shield -= absorbed;
      damage = baseDamage - absorbed;
      target.hp = Math.max(0, target.hp - damage);
      break;
    }
    case "DEFEND": {
      energyCost = 10;
      shieldGain = 25;
      actor.shield = Math.min(60, actor.shield + shieldGain);
      break;
    }
    case "STAKE_SHIELD": {
      // Mecánica DeFi: Sacrifica escudo actual para ganar rendimiento por turno
      energyCost = 15;
      if (actor.shield >= 15) {
        actor.shield -= 15;
        actor.stakedShieldYield += 5;
        yieldGained = 5;
      } else {
        // Fallback si no tiene escudo suficiente
        actor.shield += 10;
      }
      break;
    }
    case "LIQUIDATE_BURST": {
      // Mecánica DeFi: Liquidación de emergencia (alto riesgo / alto impacto)
      energyCost = 40;
      if (actor.energy >= 40) {
        const burstDamage = 38 + Math.floor(Math.random() * 12); // 38-50 dmg
        const absorbed = Math.min(target.shield, burstDamage);
        target.shield -= absorbed;
        damage = burstDamage - absorbed;
        target.hp = Math.max(0, target.hp - damage);
      } else {
        // Penalización si no tiene energía suficiente
        damage = 10;
        target.hp = Math.max(0, target.hp - 10);
      }
      break;
    }
  }

  // Descontar energía y recuperar un poco para el siguiente turno
  actor.energy = Math.max(0, actor.energy - energyCost);
  actor.energy = Math.min(actor.maxEnergy, actor.energy + 15);

  return {
    actorNext: actor,
    targetNext: target,
    damage,
    shieldGain,
    energyCost,
    yieldGained,
  };
}
