// fighter action and kinematic resolution

import { compileNaturalActionPlan, NeuralActionClass } from "./neural-combat-nlp";

export type LimbActionType =
  | "RAISE_ARM_HIGH"     // Alza el brazo, mueve la mano arriba
  | "PUNCH_STRIKE"      // Pégale, puño directo, quítale daño, golpéalo tú
  | "LOW_LEG_SWEEP"      // Baja la patada, métele por debajo, barrida al suelo
  | "MID_LEG_KICK"       // Patada normal, patea, patéalo
  | "AERIAL_KICK"        // Patada en el aire, patada voladora, dropkick
  | "HEADBUTT_THRUST"    // Pégale con la cabeza, cabezazo
  | "HEAD_DUCK_WEAVE"    // Mueve la cabeza, sube la cabeza
  | "CROUCH_DUCK"        // Agáchate, flexión profunda, cuerpo bajo
  | "SHIELD_BLOCK"       // Defiéndete, solo defiéndete, evita que te peguen mucho
  | "ARM_FEINT_WAVE"     // Mueve el brazo, finta, amaga
  | "AERIAL_JUMP"        // Salta, brinca, sube, aéreo
  | "EVASIVE_DODGE"      // Esquívalo, esquiva todo el pele, paso atrás
  | "UPPERCUT_LIFT"      // Gancho ascendente, uppercut
  | "FLYING_KNEE"        // Rodillazo volador en salto
  | "SPINNING_BACKFIST"  // Golpe con giro de puño
  | "PASSIVE_ABSORB"     // Deja que te pegue, no hagas nada, quédate quieto
  | "ADAPTIVE_COUNTER"   // Anticipa, adpátate a lo que hace, contragolpea
  | "NEUTRAL_GUARD";     // Guardia equilibrada

export interface KinematicPoseState {
  headOffsetY: number;        // Head vertical shift (-6 to +8)
  headOffsetX: number;        // Head horizontal shift (-4 to +14)
  torsoOffsetY: number;       // Torso elevation (0 = standing, +12 = ground, -36 = jump)
  armAngleDeg: number;        // Arm angle: 45 = guard, 90 = punch, 140 = high arm to sky
  armExtensionPx: number;     // Arm length extension (0 to 24px)
  legAngleDeg: number;        // Leg angle: 0 = standing, 45 = kick, -5 = low sweep
  legExtensionPx: number;     // Leg extension along floor (0 to 32px)
  isShieldActive: boolean;    // Energy barrier active
  isAirborne: boolean;        // In mid-air
}

// 10-Dimensional Semantic Vector Tensor
// [Elevation, Force, Reach, Defense, Evasion, Deception, LimbArm, LimbLeg, LimbHead, Adaptivity]
export type SemanticVector = [
  number, // 0: Elevation (-1.0 to +1.0)
  number, // 1: Force (0.0 to 1.0)
  number, // 2: Reach (0.0 to 1.0)
  number, // 3: Defense (0.0 to 1.0)
  number, // 4: Evasion (0.0 to 1.0)
  number, // 5: Deception (0.0 to 1.0)
  number, // 6: LimbArm (0.0 to 1.0)
  number, // 7: LimbLeg (0.0 to 1.0)
  number, // 8: LimbHead (0.0 to 1.0)
  number  // 9: Adaptivity (0.0 to 1.0)
];

export interface CognitiveTelemetry {
  aggressionGauge: number;    // 0 to 100
  defenseGauge: number;       // 0 to 100
  agilityGauge: number;       // 0 to 100
  tacticalIQ: number;         // 0 to 100
  semanticTensor: SemanticVector;
  thoughtStream: string[];    // Step-by-step cognitive reasoning logs
  bioTags?: Array<{ token: string; tag: string }>;
  actionPlanNodes?: Array<{
    sequenceIndex: number;
    actionClass: string;
    label: string;
    limb: string;
    plane: string;
    confidence: number;
    triggerEvent: string;
    baseDamage: number;
  }>;
  isConditionalPlan?: boolean;
  conditionalDescription?: string;
}

export interface TacticalProfile {
  defenseMultiplier: number;  // 0.2 = blocks 80% damage ("evita que te peguen mucho")
  damageMultiplier: number;   // 1.35 = +35% damage ("quítale mucho daño")
  evasionPriority: boolean;   // Auto-dodge ("esquiva todo el pele")
  isPacifist: boolean;        // Surrender / absorb ("deja que él te pegue")
  isAdaptive: boolean;        // In-fight learning counter-mode
}

export interface AnatomicalCommand {
  phase: number;
  action: LimbActionType;
  label: string;
  bodyPart: "ARM" | "LEG" | "HEAD" | "TORSO" | "FULL_BODY";
  spatialPlane: "HIGH" | "MID" | "LOW" | "UNDER" | "AERIAL";
  baseDamage: number;
  pose: KinematicPoseState;
  narrativeText: string;
}

export interface CombatPolicy {
  actions: LimbActionType[];
  repeatPolicy: "ONCE" | "CYCLE" | "ON_EVERY_ATTACK" | "CONTINUOUS_PRESSURE";
  reactiveTrigger?: {
    whenOpponentAttacks?: LimbActionType;
    whenOpponentDucks?: LimbActionType;
    whenOpponentJumps?: LimbActionType;
  };
  tactics?: {
    isPacifist?: boolean;
    defensePriority?: boolean;
    aggressionPriority?: boolean;
  };
}

export interface CompiledCombatMind {
  commands: AnatomicalCommand[];
  tactics: TacticalProfile;
  policy: CombatPolicy;
  telemetry: CognitiveTelemetry;
  summary: string[];
  rawPrompt: string;
}

export interface InteractionResolution {
  p1Action: LimbActionType;
  p2Action: LimbActionType;
  p1Pose: KinematicPoseState;
  p2Pose: KinematicPoseState;
  p1Damage: number;
  p2Damage: number;
  outcomeType:
    | "UNDER_SWEEP_PUNISH"
    | "HIGH_DUCK_EVASION"
    | "SHIELD_ABSORB"
    | "CLASH_TRADE"
    | "CLEAN_HIT"
    | "AERIAL_OVER_SWEEP"
    | "FEINT_TRICK"
    | "STOIC_ABSORB"
    | "ADAPTIVE_COUNTER_HIT"
    | "WHIFF_RECOVERY_PUNISH"
    | "NEUTRAL_REPOSITION";
  narrative: string;
}

// kinematic poses for animation
export const KINEMATIC_POSES: Record<LimbActionType, KinematicPoseState> = {
  RAISE_ARM_HIGH: {
    headOffsetY: -2,
    headOffsetX: 0,
    torsoOffsetY: 0,
    armAngleDeg: 140, // High arm to sky above head
    armExtensionPx: 16,
    legAngleDeg: 0,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  LOW_LEG_SWEEP: {
    headOffsetY: 6,
    headOffsetX: 4,
    torsoOffsetY: 12, // Drops flat against the ground
    armAngleDeg: 25,
    armExtensionPx: 6,
    legAngleDeg: -5, // Flat horizontal sweep along floor
    legExtensionPx: 28, // 28px forward extension!
    isShieldActive: false,
    isAirborne: false,
  },
  PUNCH_STRIKE: {
    headOffsetY: 0,
    headOffsetX: 4,
    torsoOffsetY: 0,
    armAngleDeg: 88, // Straight punch
    armExtensionPx: 22,
    legAngleDeg: 0,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  MID_LEG_KICK: {
    headOffsetY: 0,
    headOffsetX: 0,
    torsoOffsetY: 0,
    armAngleDeg: 45,
    armExtensionPx: 0,
    legAngleDeg: 40,
    legExtensionPx: 20,
    isShieldActive: false,
    isAirborne: false,
  },
  HEADBUTT_THRUST: {
    headOffsetY: 2,
    headOffsetX: 14,
    torsoOffsetY: 2,
    armAngleDeg: -20,
    armExtensionPx: 0,
    legAngleDeg: 0,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  HEAD_DUCK_WEAVE: {
    headOffsetY: 8,
    headOffsetX: -2,
    torsoOffsetY: 4,
    armAngleDeg: 60,
    armExtensionPx: 0,
    legAngleDeg: 0,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  CROUCH_DUCK: {
    headOffsetY: 10,
    headOffsetX: -2,
    torsoOffsetY: 14, // Deep low crouch to ground
    armAngleDeg: 50,
    armExtensionPx: 0,
    legAngleDeg: -20,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  AERIAL_KICK: {
    headOffsetY: -4,
    headOffsetX: 4,
    torsoOffsetY: -36, // Airborne elevation
    armAngleDeg: -30,
    armExtensionPx: 0,
    legAngleDeg: 65,
    legExtensionPx: 26, // Leg extended diagonally forward in flight
    isShieldActive: false,
    isAirborne: true,
  },
  SHIELD_BLOCK: {
    headOffsetY: 0,
    headOffsetX: -2,
    torsoOffsetY: 0,
    armAngleDeg: 75,
    armExtensionPx: 8,
    legAngleDeg: 0,
    legExtensionPx: 0,
    isShieldActive: true,
    isAirborne: false,
  },
  ARM_FEINT_WAVE: {
    headOffsetY: 0,
    headOffsetX: 0,
    torsoOffsetY: 0,
    armAngleDeg: 110,
    armExtensionPx: 12,
    legAngleDeg: 0,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  AERIAL_JUMP: {
    headOffsetY: -4,
    headOffsetX: 0,
    torsoOffsetY: -36,
    armAngleDeg: 60,
    armExtensionPx: 0,
    legAngleDeg: 30,
    legExtensionPx: 8,
    isShieldActive: false,
    isAirborne: true,
  },
  EVASIVE_DODGE: {
    headOffsetY: 0,
    headOffsetX: -10,
    torsoOffsetY: 0,
    armAngleDeg: 45,
    armExtensionPx: 0,
    legAngleDeg: -10,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  PASSIVE_ABSORB: {
    headOffsetY: -2,
    headOffsetX: 0,
    torsoOffsetY: 0,
    armAngleDeg: 15,
    armExtensionPx: 0,
    legAngleDeg: 0,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  ADAPTIVE_COUNTER: {
    headOffsetY: 0,
    headOffsetX: 6,
    torsoOffsetY: 0,
    armAngleDeg: 95,
    armExtensionPx: 20,
    legAngleDeg: 25,
    legExtensionPx: 16,
    isShieldActive: false,
    isAirborne: false,
  },
  UPPERCUT_LIFT: {
    headOffsetY: -4,
    headOffsetX: 4,
    torsoOffsetY: -6,
    armAngleDeg: 125,
    armExtensionPx: 22,
    legAngleDeg: 25,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  FLYING_KNEE: {
    headOffsetY: -8,
    headOffsetX: 10,
    torsoOffsetY: -26,
    armAngleDeg: 40,
    armExtensionPx: 0,
    legAngleDeg: 75,
    legExtensionPx: 20,
    isShieldActive: false,
    isAirborne: true,
  },
  SPINNING_BACKFIST: {
    headOffsetY: 0,
    headOffsetX: 6,
    torsoOffsetY: 0,
    armAngleDeg: 110,
    armExtensionPx: 24,
    legAngleDeg: 15,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
  NEUTRAL_GUARD: {
    headOffsetY: 0,
    headOffsetX: 0,
    torsoOffsetY: 0,
    armAngleDeg: 45,
    armExtensionPx: 0,
    legAngleDeg: 0,
    legExtensionPx: 0,
    isShieldActive: false,
    isAirborne: false,
  },
};

// helper to normalize text
function stripDiacritics(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function stripEnclitic(word: string): string {
  const norm = stripDiacritics(word);
  return norm.replace(/(?:lo|la|los|las|le|les|te|me|se|nos)$/i, "");
}

type SemanticCategory =
  | "DEFEND"
  | "STRIKE_PUNCH"
  | "STRIKE_KICK"
  | "STRIKE_HEAD"
  | "LOW_SWEEP"
  | "HIGH_ARM"
  | "HEAD_WEAVE"
  | "CROUCH"
  | "EVADE"
  | "JUMP"
  | "FEINT"
  | "PASSIVE"
  | "ADAPTIVE";

interface RootMapping {
  roots: string[];
  category: SemanticCategory;
  defaultAction: LimbActionType;
  label: string;
  damage: number;
}

const ROOT_MAPPINGS: RootMapping[] = [
  {
    roots: ["defiend", "cubre", "cubr", "bloque", "escudo", "resist", "aguant", "guard", "shield", "protect", "esper"],
    category: "DEFEND",
    defaultAction: "SHIELD_BLOCK",
    label: "DEFENSIVE SHIELD",
    damage: 0,
  },
  {
    roots: [
      "golpe", "pega", "puno", "puño", "jab", "cross", "gancho", "directo", "remat", "punch", "strike", "hit",
      "revient", "romp", "destruy", "atac", "acab", "machac", "castig", "impact", "smash", "crush", "destroy"
    ],
    category: "STRIKE_PUNCH",
    defaultAction: "PUNCH_STRIKE",
    label: "PUNCH STRIKE",
    damage: 24,
  },
  {
    roots: ["barrid", "barrer", "barre", "tobillo", "debajo", "bajo", "suelo", "piso", "pies", "sweep"],
    category: "LOW_SWEEP",
    defaultAction: "LOW_LEG_SWEEP",
    label: "LOW SWEEP UNDER",
    damage: 26,
  },
  {
    roots: ["pate", "patad", "piern", "kick", "zancad", "patadon"],
    category: "STRIKE_KICK",
    defaultAction: "MID_LEG_KICK",
    label: "KICK STRIKE",
    damage: 22,
  },
  {
    roots: ["cabez", "testar", "crane", "frente", "headbutt", "skull"],
    category: "STRIKE_HEAD",
    defaultAction: "HEADBUTT_THRUST",
    label: "HEADBUTT THRUST",
    damage: 28,
  },
  {
    roots: ["esquiv", "evad", "zaf", "quit", "alej", "retroced", "dodge", "slip", "retreat", "weav"],
    category: "EVADE",
    defaultAction: "EVASIVE_DODGE",
    label: "EVASIVE DODGE",
    damage: 0,
  },
  {
    roots: ["agach", "crouch", "duck", "inclin", "dobla", "baja"],
    category: "CROUCH",
    defaultAction: "CROUCH_DUCK",
    label: "CROUCH DUCK",
    damage: 0,
  },
  {
    roots: ["salt", "brinc", "elev", "vuel", "jump", "leap", "aerial", "arrib"],
    category: "JUMP",
    defaultAction: "AERIAL_JUMP",
    label: "AERIAL JUMP",
    damage: 0,
  },
  {
    roots: ["fint", "amag", "distra", "feint", "bait", "provoc"],
    category: "FEINT",
    defaultAction: "ARM_FEINT_WAVE",
    label: "ARM FEINT",
    damage: 6,
  },
  {
    roots: ["anticip", "adapt", "aprend", "contragolpe", "analiz", "counter"],
    category: "ADAPTIVE",
    defaultAction: "ADAPTIVE_COUNTER",
    label: "ADAPTIVE COUNTER",
    damage: 24,
  },
];

// track moves for counter tactics
class HistoricalFightMemory {
  private opponentMoves: LimbActionType[] = [];

  recordOpponentMove(move: LimbActionType) {
    this.opponentMoves.push(move);
    if (this.opponentMoves.length > 20) this.opponentMoves.shift();
  }

  predictNextOpponentTendency(): "SWEEPER" | "HIGH_STRIKER" | "TURTLE_BLOCKER" | "BALANCED" {
    if (this.opponentMoves.length === 0) return "BALANCED";

    let sweeps = 0;
    let highStrikes = 0;
    let blocks = 0;

    for (const m of this.opponentMoves) {
      if (m === "LOW_LEG_SWEEP") sweeps++;
      else if (m === "PUNCH_STRIKE" || m === "HEADBUTT_THRUST" || m === "RAISE_ARM_HIGH") highStrikes++;
      else if (m === "SHIELD_BLOCK") blocks++;
    }

    if (sweeps >= highStrikes && sweeps >= blocks && sweeps > 0) return "SWEEPER";
    if (highStrikes >= sweeps && highStrikes >= blocks && highStrikes > 0) return "HIGH_STRIKER";
    if (blocks > sweeps && blocks > highStrikes) return "TURTLE_BLOCKER";
    return "BALANCED";
  }

  reset() {
    this.opponentMoves = [];
  }
}

export const fightMemory = new HistoricalFightMemory();

// discourse and sequence resolver

function matchWordToSemantic(word: string): RootMapping | null {
  const base = stripDiacritics(word);
  const stem = stripEnclitic(word);

  for (const m of ROOT_MAPPINGS) {
    for (const root of m.roots) {
      if (base.startsWith(root) || stem.startsWith(root)) {
        return m;
      }
    }
  }
  return null;
}

/**
 * Resolves an action for a single clause using morphological root matching.
 */
function resolveClauseAction(clause: string): { action: LimbActionType; label: string; baseDamage: number } | null {
  const norm = stripDiacritics(clause);

  // 1. High Arm phrase check
  if (
    norm.includes("alza el brazo") ||
    norm.includes("mueve la mano arriba") ||
    norm.includes("sube la mano") ||
    norm.includes("mano arriba") ||
    norm.includes("brazo arriba") ||
    norm.includes("raise arm")
  ) {
    return { action: "RAISE_ARM_HIGH", label: "RAISE ARM HIGH", baseDamage: 12 };
  }

  // 2. Low Sweep phrase check
  if (
    norm.includes("baja la patada") ||
    norm.includes("metele por debajo") ||
    norm.includes("por debajo") ||
    norm.includes("patada baja") ||
    norm.includes("al tobillo") ||
    norm.includes("low sweep")
  ) {
    return { action: "LOW_LEG_SWEEP", label: "LOW SWEEP UNDER", baseDamage: 26 };
  }

  // 3. Head Duck phrase check
  if (
    norm.includes("mueve la cabeza") ||
    norm.includes("sube la cabeza") ||
    norm.includes("agacha la cabeza") ||
    norm.includes("duck head")
  ) {
    return { action: "HEAD_DUCK_WEAVE", label: "HEAD DUCK / WEAVE", baseDamage: 0 };
  }

  // 4. Token-by-token root analysis with clitic resolution
  const words = norm.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);

  for (const w of words) {
    const matched = matchWordToSemantic(w);
    if (matched) {
      return {
        action: matched.defaultAction,
        label: matched.label,
        baseDamage: matched.damage,
      };
    }
  }

  return null;
}

function mapNeuralClassToLimbAction(ac: NeuralActionClass): LimbActionType {
  switch (ac) {
    case "CROUCH_DUCK":
      return "CROUCH_DUCK";
    case "EVASIVE_DODGE":
      return "EVASIVE_DODGE";
    case "AERIAL_JUMP":
      return "AERIAL_JUMP";
    case "RAISE_ARM_HIGH":
      return "RAISE_ARM_HIGH";
    case "PUNCH_STRIKE":
      return "PUNCH_STRIKE";
    case "LOW_LEG_SWEEP":
      return "LOW_LEG_SWEEP";
    case "MID_LEG_KICK":
      return "MID_LEG_KICK";
    case "AERIAL_KICK":
      return "AERIAL_KICK";
    case "HEADBUTT_THRUST":
      return "HEADBUTT_THRUST";
    case "SHIELD_GUARD":
      return "SHIELD_BLOCK";
    case "FEINT_DECEIVE":
      return "ARM_FEINT_WAVE";
    case "PASSIVE_ABSORB":
      return "PASSIVE_ABSORB";
    case "ADAPTIVE_COUNTER":
      return "ADAPTIVE_COUNTER";
    case "UPPERCUT_LIFT":
      return "UPPERCUT_LIFT";
    case "FLYING_KNEE":
      return "FLYING_KNEE";
    case "SPINNING_BACKFIST":
      return "SPINNING_BACKFIST";
    case "NEUTRAL_STANCE":
      return "NEUTRAL_GUARD";
    default:
      return "NEUTRAL_GUARD";
  }
}

// compile fighter mind from prompt
export function compileFighterMind(prompt: string): CompiledCombatMind {
  const plan = compileNaturalActionPlan(prompt);

  const finalCommands: AnatomicalCommand[] = plan.nodes.map((node) => {
    const action = mapNeuralClassToLimbAction(node.actionClass);
    return {
      phase: node.sequenceIndex,
      action,
      label: node.label,
      bodyPart: node.limb,
      spatialPlane: node.plane,
      baseDamage: node.baseDamage,
      pose: KINEMATIC_POSES[action] || KINEMATIC_POSES.NEUTRAL_GUARD,
      narrativeText: node.explanation,
    };
  });

  const tactics: TacticalProfile = {
    defenseMultiplier: plan.tactics.defenseMultiplier,
    damageMultiplier: plan.tactics.damageMultiplier,
    evasionPriority: plan.tactics.evasionPriority,
    isPacifist: plan.tactics.pacifist,
    isAdaptive: plan.tactics.tacticalIQ > 90,
  };

  const aggTensor: SemanticVector = [
    plan.nodes.some((n) => n.plane === "AERIAL")
      ? 1.0
      : plan.nodes.some((n) => n.plane === "LOW" || n.plane === "UNDER")
      ? -1.0
      : 0.0,
    plan.tactics.aggression / 100,
    plan.nodes.some((n) => n.actionClass === "AERIAL_KICK" || n.actionClass === "LOW_LEG_SWEEP") ? 0.9 : 0.5,
    plan.tactics.defense / 100,
    plan.tactics.agility / 100,
    plan.nodes.some((n) => n.actionClass === "FEINT_DECEIVE") ? 0.8 : 0.1,
    plan.nodes.some((n) => n.limb === "ARM") ? 0.9 : 0.2,
    plan.nodes.some((n) => n.limb === "LEG") ? 0.9 : 0.2,
    plan.nodes.some((n) => n.limb === "HEAD") ? 0.9 : 0.2,
    plan.tactics.tacticalIQ / 100,
  ];

  const normPrompt = stripDiacritics(prompt.toLowerCase());
  const isJumpOnAttack =
    normPrompt.includes("salta en cada ataque") ||
    normPrompt.includes("salta cada ataque") ||
    normPrompt.includes("salta cuando ataque") ||
    normPrompt.includes("jump on every attack");
  const isCrouchOnAttack =
    normPrompt.includes("agachate en cada") ||
    normPrompt.includes("agachate en todos") ||
    normPrompt.includes("agachate cada") ||
    normPrompt.includes("agachate de todos") ||
    normPrompt.includes("crouch on every attack") ||
    normPrompt.includes("duck every attack");
  const isBlockAll =
    normPrompt.includes("defiendete de todos") ||
    normPrompt.includes("defiendete de todo") ||
    normPrompt.includes("bloquea todo") ||
    normPrompt.includes("block all") ||
    normPrompt.includes("defiendete en cada");
  const isDodgeAll =
    normPrompt.includes("esquiva todo") ||
    normPrompt.includes("esquiva cada") ||
    normPrompt.includes("dodge all");
  const isContinuous =
    normPrompt.includes("sin parar") ||
    normPrompt.includes("continuo") ||
    normPrompt.includes("no pares de atacar") ||
    normPrompt.includes("keep attacking");

  const isReactive = isJumpOnAttack || isCrouchOnAttack || isBlockAll || isDodgeAll;
  const policy: CombatPolicy = {
    actions: finalCommands.map((c) => c.action),
    repeatPolicy: isReactive
      ? "ON_EVERY_ATTACK"
      : isContinuous
      ? "CONTINUOUS_PRESSURE"
      : "ONCE",
    reactiveTrigger: isJumpOnAttack
      ? { whenOpponentAttacks: "AERIAL_JUMP" }
      : isCrouchOnAttack
      ? { whenOpponentAttacks: "CROUCH_DUCK" }
      : isBlockAll
      ? { whenOpponentAttacks: "SHIELD_BLOCK" }
      : isDodgeAll
      ? { whenOpponentAttacks: "EVASIVE_DODGE" }
      : undefined,
  };

  return {
    commands: finalCommands,
    tactics,
    policy,
    telemetry: {
      aggressionGauge: plan.tactics.aggression,
      defenseGauge: plan.tactics.defense,
      agilityGauge: plan.tactics.agility,
      tacticalIQ: plan.tactics.tacticalIQ,
      semanticTensor: aggTensor,
      thoughtStream: plan.thoughtLog,
      bioTags: plan.bioTags,
      actionPlanNodes: finalCommands.map((c) => ({
        sequenceIndex: c.phase,
        actionClass: c.action as any,
        label: c.label,
        limb: c.bodyPart,
        plane: c.spatialPlane,
        confidence: 0.95,
        triggerEvent: "IMMEDIATE",
        baseDamage: c.baseDamage,
      })),
      isConditionalPlan: plan.isConditional,
      conditionalDescription: plan.conditionalTriggerDescription,
    },
    summary: finalCommands.map((c) => `${c.phase}. ${c.label}`),
    rawPrompt: prompt,
  };
}

// compile mind from action list
export function compileMindFromActionList(
  actions: LimbActionType[],
  prompt: string,
  customPolicy?: CombatPolicy
): CompiledCombatMind {
  if (actions.length === 0) {
    actions = ["NEUTRAL_GUARD"];
  }

  const norm = stripDiacritics(prompt.toLowerCase());
  const avoidDamage =
    norm.includes("evita que te peguen") ||
    norm.includes("evita dano") ||
    norm.includes("defiendete de todos") ||
    norm.includes("defiendete de todo") ||
    norm.includes("bloquea todo") ||
    norm.includes("solo defiendete");
  const highDamage =
    norm.includes("quitale mucho dano") ||
    norm.includes("mucho dano") ||
    norm.includes("pega fuerte") ||
    norm.includes("revientalo");

  const actionMeta: Record<
    LimbActionType,
    { label: string; limb: "ARM" | "LEG" | "HEAD" | "TORSO" | "FULL_BODY"; plane: "HIGH" | "MID" | "LOW" | "UNDER" | "AERIAL"; baseDamage: number }
  > = {
    CROUCH_DUCK: { label: "CROUCH", limb: "TORSO", plane: "LOW", baseDamage: 0 },
    PUNCH_STRIKE: { label: "PUNCH", limb: "ARM", plane: "MID", baseDamage: 24 },
    LOW_LEG_SWEEP: { label: "LOW SWEEP", limb: "LEG", plane: "UNDER", baseDamage: 26 },
    MID_LEG_KICK: { label: "MID KICK", limb: "LEG", plane: "MID", baseDamage: 22 },
    AERIAL_KICK: { label: "AERIAL KICK", limb: "LEG", plane: "AERIAL", baseDamage: 34 },
    HEADBUTT_THRUST: { label: "HEADBUTT", limb: "HEAD", plane: "HIGH", baseDamage: 28 },
    SHIELD_BLOCK: { label: "BLOCK", limb: "ARM", plane: "HIGH", baseDamage: 0 },
    ARM_FEINT_WAVE: { label: "FEINT", limb: "ARM", plane: "HIGH", baseDamage: 6 },
    AERIAL_JUMP: { label: "JUMP", limb: "FULL_BODY", plane: "AERIAL", baseDamage: 0 },
    EVASIVE_DODGE: { label: "DODGE", limb: "FULL_BODY", plane: "MID", baseDamage: 0 },
    PASSIVE_ABSORB: { label: "ABSORB", limb: "FULL_BODY", plane: "MID", baseDamage: 0 },
    RAISE_ARM_HIGH: { label: "HIGH GUARD", limb: "ARM", plane: "HIGH", baseDamage: 0 },
    HEAD_DUCK_WEAVE: { label: "DUCK", limb: "HEAD", plane: "LOW", baseDamage: 0 },
    ADAPTIVE_COUNTER: { label: "COUNTER", limb: "FULL_BODY", plane: "MID", baseDamage: 24 },
    UPPERCUT_LIFT: { label: "UPPERCUT", limb: "ARM", plane: "HIGH", baseDamage: 30 },
    FLYING_KNEE: { label: "FLYING KNEE", limb: "LEG", plane: "AERIAL", baseDamage: 32 },
    SPINNING_BACKFIST: { label: "SPINNING FIST", limb: "ARM", plane: "HIGH", baseDamage: 28 },
    NEUTRAL_GUARD: { label: "NEUTRAL", limb: "FULL_BODY", plane: "MID", baseDamage: 0 },
  };

  const finalCommands: AnatomicalCommand[] = actions.map((act, index) => {
    const meta = actionMeta[act] || actionMeta.NEUTRAL_GUARD;
    return {
      phase: index + 1,
      action: act,
      label: meta.label,
      bodyPart: meta.limb,
      spatialPlane: meta.plane,
      baseDamage: meta.baseDamage,
      pose: KINEMATIC_POSES[act] || KINEMATIC_POSES.NEUTRAL_GUARD,
      narrativeText: `Execute ${meta.label}`,
    };
  });

  const tactics: TacticalProfile = {
    defenseMultiplier: avoidDamage ? 0.2 : actions.some((a) => a === "SHIELD_BLOCK") ? 0.4 : 1.0,
    damageMultiplier: highDamage ? 1.35 : 1.0,
    evasionPriority: actions.some((a) => a === "EVASIVE_DODGE"),
    isPacifist: actions.every((a) => a === "PASSIVE_ABSORB") || norm.includes("no hagas nada"),
    isAdaptive: actions.some((a) => a === "ADAPTIVE_COUNTER"),
  };

  const isJumpOnAttack =
    norm.includes("salta en cada ataque") ||
    norm.includes("salta cada ataque") ||
    norm.includes("salta cuando ataque") ||
    norm.includes("jump on every attack");
  const isCrouchOnAttack =
    norm.includes("agachate en cada") ||
    norm.includes("agachate en todos") ||
    norm.includes("agachate cada") ||
    norm.includes("agachate de todos") ||
    norm.includes("crouch on every attack") ||
    norm.includes("duck every attack");
  const isBlockAll =
    norm.includes("defiendete de todos") ||
    norm.includes("defiendete de todo") ||
    norm.includes("bloquea todo") ||
    norm.includes("block all");
  const isDodgeAll =
    norm.includes("esquiva todo") ||
    norm.includes("esquiva cada") ||
    norm.includes("dodge all");
  const isContinuous =
    norm.includes("sin parar") ||
    norm.includes("continuo") ||
    norm.includes("no pares de atacar") ||
    norm.includes("keep attacking");

  const isReactive = isJumpOnAttack || isCrouchOnAttack || isBlockAll || isDodgeAll;
  const policy: CombatPolicy = customPolicy || {
    actions,
    repeatPolicy: isReactive
      ? "ON_EVERY_ATTACK"
      : isContinuous
      ? "CONTINUOUS_PRESSURE"
      : "ONCE",
    reactiveTrigger: isJumpOnAttack
      ? { whenOpponentAttacks: "AERIAL_JUMP" }
      : isCrouchOnAttack
      ? { whenOpponentAttacks: "CROUCH_DUCK" }
      : isBlockAll
      ? { whenOpponentAttacks: "SHIELD_BLOCK" }
      : isDodgeAll
      ? { whenOpponentAttacks: "EVASIVE_DODGE" }
      : undefined,
  };

  const aggTensor: SemanticVector = [
    actions.some((a) => a === "AERIAL_JUMP" || a === "AERIAL_KICK" || a === "FLYING_KNEE") ? 1.0 : actions.some((a) => a === "LOW_LEG_SWEEP" || a === "CROUCH_DUCK") ? -1.0 : 0.0,
    0.7,
    0.6,
    tactics.defenseMultiplier < 1.0 ? 0.8 : 0.3,
    tactics.evasionPriority ? 0.8 : 0.3,
    actions.some((a) => a === "ARM_FEINT_WAVE") ? 0.8 : 0.1,
    actions.some((a) => ["PUNCH_STRIKE", "SHIELD_BLOCK", "ARM_FEINT_WAVE", "RAISE_ARM_HIGH", "UPPERCUT_LIFT", "SPINNING_BACKFIST"].includes(a)) ? 0.8 : 0.2,
    actions.some((a) => ["LOW_LEG_SWEEP", "MID_LEG_KICK", "AERIAL_KICK", "FLYING_KNEE"].includes(a)) ? 0.8 : 0.2,
    actions.some((a) => a === "HEADBUTT_THRUST") ? 0.9 : 0.2,
    tactics.isAdaptive ? 0.9 : 0.5,
  ];

  return {
    commands: finalCommands,
    tactics,
    policy,
    telemetry: {
      aggressionGauge: Math.round(aggTensor[1] * 100),
      defenseGauge: Math.round(aggTensor[3] * 100),
      agilityGauge: Math.round(aggTensor[4] * 100),
      tacticalIQ: Math.min(100, 75 + actions.length * 6),
      semanticTensor: aggTensor,
      thoughtStream: [`Action sequence: ${actions.join(", ")}`],
      bioTags: [],
      actionPlanNodes: finalCommands.map((c) => ({
        sequenceIndex: c.phase,
        actionClass: c.action as any,
        label: c.label,
        limb: c.bodyPart,
        plane: c.spatialPlane,
        confidence: 0.95,
        triggerEvent: "IMMEDIATE",
        baseDamage: c.baseDamage,
      })),
      isConditionalPlan: false,
    },
    summary: finalCommands.map((c) => `${c.phase}. ${c.label}`),
    rawPrompt: prompt,
  };
}

export function isAttackingAction(action: LimbActionType): boolean {
  return [
    "PUNCH_STRIKE",
    "LOW_LEG_SWEEP",
    "MID_LEG_KICK",
    "AERIAL_KICK",
    "HEADBUTT_THRUST",
    "UPPERCUT_LIFT",
    "FLYING_KNEE",
    "SPINNING_BACKFIST",
    "ADAPTIVE_COUNTER",
  ].includes(action);
}

export function createCommandFromAction(
  action: LimbActionType,
  phase: number
): AnatomicalCommand {
  const meta: Record<
    LimbActionType,
    { label: string; limb: "ARM" | "LEG" | "HEAD" | "TORSO" | "FULL_BODY"; plane: "HIGH" | "MID" | "LOW" | "UNDER" | "AERIAL"; baseDamage: number }
  > = {
    CROUCH_DUCK: { label: "CROUCH", limb: "TORSO", plane: "LOW", baseDamage: 0 },
    PUNCH_STRIKE: { label: "PUNCH", limb: "ARM", plane: "MID", baseDamage: 24 },
    LOW_LEG_SWEEP: { label: "LOW SWEEP", limb: "LEG", plane: "UNDER", baseDamage: 26 },
    MID_LEG_KICK: { label: "MID KICK", limb: "LEG", plane: "MID", baseDamage: 22 },
    AERIAL_KICK: { label: "AERIAL KICK", limb: "LEG", plane: "AERIAL", baseDamage: 34 },
    HEADBUTT_THRUST: { label: "HEADBUTT", limb: "HEAD", plane: "HIGH", baseDamage: 28 },
    SHIELD_BLOCK: { label: "BLOCK", limb: "ARM", plane: "HIGH", baseDamage: 0 },
    ARM_FEINT_WAVE: { label: "FEINT", limb: "ARM", plane: "HIGH", baseDamage: 6 },
    AERIAL_JUMP: { label: "JUMP", limb: "FULL_BODY", plane: "AERIAL", baseDamage: 0 },
    EVASIVE_DODGE: { label: "DODGE", limb: "FULL_BODY", plane: "MID", baseDamage: 0 },
    PASSIVE_ABSORB: { label: "ABSORB", limb: "FULL_BODY", plane: "MID", baseDamage: 0 },
    RAISE_ARM_HIGH: { label: "HIGH GUARD", limb: "ARM", plane: "HIGH", baseDamage: 0 },
    HEAD_DUCK_WEAVE: { label: "DUCK", limb: "HEAD", plane: "LOW", baseDamage: 0 },
    UPPERCUT_LIFT: { label: "UPPERCUT", limb: "ARM", plane: "HIGH", baseDamage: 30 },
    FLYING_KNEE: { label: "FLYING KNEE", limb: "LEG", plane: "AERIAL", baseDamage: 32 },
    SPINNING_BACKFIST: { label: "SPINNING FIST", limb: "ARM", plane: "HIGH", baseDamage: 28 },
    ADAPTIVE_COUNTER: { label: "COUNTER", limb: "FULL_BODY", plane: "MID", baseDamage: 24 },
    NEUTRAL_GUARD: { label: "NEUTRAL", limb: "FULL_BODY", plane: "MID", baseDamage: 0 },
  };

  const m = meta[action] || meta.NEUTRAL_GUARD;
  return {
    phase,
    action,
    label: m.label,
    bodyPart: m.limb,
    spatialPlane: m.plane,
    baseDamage: m.baseDamage,
    pose: KINEMATIC_POSES[action] || KINEMATIC_POSES.NEUTRAL_GUARD,
    narrativeText: `Execute ${m.label}`,
  };
}

export function determineFighterActionForStep(
  mind: CompiledCombatMind,
  stepIndex: number,
  opponentIntendedAction?: LimbActionType
): AnatomicalCommand {
  const policy = mind.policy;
  const oppIsAttacking = opponentIntendedAction ? isAttackingAction(opponentIntendedAction) : false;
  const oppIsAirborne =
    opponentIntendedAction === "AERIAL_JUMP" ||
    opponentIntendedAction === "AERIAL_KICK" ||
    opponentIntendedAction === "FLYING_KNEE";
  const oppIsDucking =
    opponentIntendedAction === "CROUCH_DUCK" ||
    opponentIntendedAction === "HEAD_DUCK_WEAVE";

  // Reactive trigger evaluation
  if (oppIsAttacking && policy?.reactiveTrigger?.whenOpponentAttacks) {
    return createCommandFromAction(policy.reactiveTrigger.whenOpponentAttacks, stepIndex + 1);
  }

  if (oppIsAirborne && policy?.reactiveTrigger?.whenOpponentJumps) {
    return createCommandFromAction(policy.reactiveTrigger.whenOpponentJumps, stepIndex + 1);
  }

  if (oppIsDucking && policy?.reactiveTrigger?.whenOpponentDucks) {
    return createCommandFromAction(policy.reactiveTrigger.whenOpponentDucks, stepIndex + 1);
  }

  // Sequential command execution
  if (mind.commands && mind.commands.length > 0) {
    if (stepIndex < mind.commands.length) {
      return mind.commands[stepIndex];
    }

    if (policy?.repeatPolicy === "CYCLE") {
      return mind.commands[stepIndex % mind.commands.length];
    }

    if (policy?.repeatPolicy === "CONTINUOUS_PRESSURE") {
      const strikeCommands = mind.commands.filter((c) => isAttackingAction(c.action));
      if (strikeCommands.length > 0) {
        return strikeCommands[stepIndex % strikeCommands.length];
      }
      return createCommandFromAction("PUNCH_STRIKE", stepIndex + 1);
    }

    if (policy?.repeatPolicy === "ON_EVERY_ATTACK") {
      if (oppIsAttacking && policy.reactiveTrigger?.whenOpponentAttacks) {
        return createCommandFromAction(policy.reactiveTrigger.whenOpponentAttacks, stepIndex + 1);
      }
      if (stepIndex === 0 && policy.reactiveTrigger?.whenOpponentAttacks) {
        return createCommandFromAction(policy.reactiveTrigger.whenOpponentAttacks, 1);
      }
      return createCommandFromAction("NEUTRAL_GUARD", stepIndex + 1);
    }
  }

  const fallbackAction = mind.tactics.isPacifist ? "PASSIVE_ABSORB" : "NEUTRAL_GUARD";
  return createCommandFromAction(fallbackAction, stepIndex + 1);
}

// resolve action interactions and collision
export function resolveKinematicCollision(
  cmd1: AnatomicalCommand,
  cmd2: AnatomicalCommand,
  tactics1: TacticalProfile,
  tactics2: TacticalProfile
): InteractionResolution {
  const a1 = cmd1.action;
  const a2 = cmd2.action;

  fightMemory.recordOpponentMove(a2);

  // 1. Mutual Passive
  if (a1 === "PASSIVE_ABSORB" && a2 === "PASSIVE_ABSORB") {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "NEUTRAL_REPOSITION",
      narrative: "NO ACTION.",
    };
  }

  // 2. Single Passive Absorb
  if (a1 === "PASSIVE_ABSORB") {
    const rawDmg = cmd2.baseDamage || 20;
    const mitigated = Math.round(rawDmg * 0.8);
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: mitigated,
      p2Damage: 0,
      outcomeType: "STOIC_ABSORB",
      narrative: `P1 ABSORBS ATTACK (-${mitigated} HP).`,
    };
  }

  if (a2 === "PASSIVE_ABSORB") {
    const rawDmg = cmd1.baseDamage || 20;
    const mitigated = Math.round(rawDmg * 0.8);
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: mitigated,
      outcomeType: "STOIC_ABSORB",
      narrative: `P2 ABSORBS ATTACK (-${mitigated} HP).`,
    };
  }

  // 3. Low Sweep Under High Attacks
  if (a1 === "LOW_LEG_SWEEP" && (a2 === "RAISE_ARM_HIGH" || a2 === "PUNCH_STRIKE" || a2 === "HEADBUTT_THRUST")) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: cmd1.baseDamage,
      outcomeType: "UNDER_SWEEP_PUNISH",
      narrative: `P1 LOW SWEEP UNDER ATTACK (-${cmd1.baseDamage} HP).`,
    };
  }

  if (a2 === "LOW_LEG_SWEEP" && (a1 === "RAISE_ARM_HIGH" || a1 === "PUNCH_STRIKE" || a1 === "HEADBUTT_THRUST")) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: cmd2.baseDamage,
      p2Damage: 0,
      outcomeType: "UNDER_SWEEP_PUNISH",
      narrative: `P2 LOW SWEEP UNDER ATTACK (-${cmd2.baseDamage} HP).`,
    };
  }

  // 4. Aerial Jump or Aerial Kick over Ground Sweep
  if ((a1 === "AERIAL_JUMP" || a1 === "AERIAL_KICK") && a2 === "LOW_LEG_SWEEP") {
    const dmg = a1 === "AERIAL_KICK" ? (cmd1.baseDamage || 34) : 24;
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: dmg,
      outcomeType: "AERIAL_OVER_SWEEP",
      narrative: `P1 LEAPS OVER LOW SWEEP (-${dmg} HP).`,
    };
  }

  if ((a2 === "AERIAL_JUMP" || a2 === "AERIAL_KICK") && a1 === "LOW_LEG_SWEEP") {
    const dmg = a2 === "AERIAL_KICK" ? (cmd2.baseDamage || 34) : 24;
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: dmg,
      p2Damage: 0,
      outcomeType: "AERIAL_OVER_SWEEP",
      narrative: `P2 LEAPS OVER LOW SWEEP (-${dmg} HP).`,
    };
  }

  // 4b. Aerial Jump Evades Ground Attacks
  const jumpEvadedAttacks: LimbActionType[] = [
    "PUNCH_STRIKE",
    "MID_LEG_KICK",
    "HEADBUTT_THRUST",
    "LOW_LEG_SWEEP",
    "SPINNING_BACKFIST",
  ];

  if (a1 === "AERIAL_JUMP" && jumpEvadedAttacks.includes(a2)) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "HIGH_DUCK_EVASION",
      narrative: `P1 LEAPS HIGH. P2 ${cmd2.label} WHIFFS!`,
    };
  }

  if (a2 === "AERIAL_JUMP" && jumpEvadedAttacks.includes(a1)) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "HIGH_DUCK_EVASION",
      narrative: `P2 LEAPS HIGH. P1 ${cmd1.label} WHIFFS!`,
    };
  }

  // 4c. Uppercut hits crouching or aerial opponents
  if (a1 === "UPPERCUT_LIFT" && (a2 === "CROUCH_DUCK" || a2 === "AERIAL_JUMP")) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: cmd1.baseDamage,
      outcomeType: "CLEAN_HIT",
      narrative: `P1 UPPERCUT PUNISHES POSITION (-${cmd1.baseDamage} HP).`,
    };
  }

  if (a2 === "UPPERCUT_LIFT" && (a1 === "CROUCH_DUCK" || a1 === "AERIAL_JUMP")) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: cmd2.baseDamage,
      p2Damage: 0,
      outcomeType: "CLEAN_HIT",
      narrative: `P2 UPPERCUT PUNISHES POSITION (-${cmd2.baseDamage} HP).`,
    };
  }

  // 5. Head Duck / Crouch Weave under High Punches
  const duckEvadedAttacks: LimbActionType[] = [
    "RAISE_ARM_HIGH",
    "PUNCH_STRIKE",
    "HEADBUTT_THRUST",
    "SPINNING_BACKFIST",
  ];

  if (
    (a1 === "HEAD_DUCK_WEAVE" || a1 === "CROUCH_DUCK") &&
    duckEvadedAttacks.includes(a2)
  ) {
    const counterDmg = cmd1.baseDamage > 0 ? cmd1.baseDamage : 0;
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: counterDmg,
      outcomeType: "HIGH_DUCK_EVASION",
      narrative: counterDmg > 0
        ? `P1 DUCKS UNDER ATTACK & COUNTERS (-${counterDmg} HP).`
        : `P1 DUCKS UNDER ATTACK. P2 ${cmd2.label} WHIFFS!`,
    };
  }

  if (
    (a2 === "HEAD_DUCK_WEAVE" || a2 === "CROUCH_DUCK") &&
    duckEvadedAttacks.includes(a1)
  ) {
    const counterDmg = cmd2.baseDamage > 0 ? cmd2.baseDamage : 0;
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: counterDmg,
      p2Damage: 0,
      outcomeType: "HIGH_DUCK_EVASION",
      narrative: counterDmg > 0
        ? `P2 DUCKS UNDER ATTACK & COUNTERS (-${counterDmg} HP).`
        : `P2 DUCKS UNDER ATTACK. P1 ${cmd1.label} WHIFFS!`,
    };
  }

  // 5b. Reactive Counter Strike
  if (cmd1.label.includes("COUNTER") && a2 !== "SHIELD_BLOCK" && a2 !== "EVASIVE_DODGE") {
    const dmg = Math.round((cmd1.baseDamage || 26) * 1.35);
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: dmg,
      outcomeType: "ADAPTIVE_COUNTER_HIT",
      narrative: `P1 COUNTERS RECOVERY (-${dmg} HP).`,
    };
  }

  if (cmd2.label.includes("COUNTER") && a1 !== "SHIELD_BLOCK" && a1 !== "EVASIVE_DODGE") {
    const dmg = Math.round((cmd2.baseDamage || 26) * 1.35);
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: dmg,
      p2Damage: 0,
      outcomeType: "ADAPTIVE_COUNTER_HIT",
      narrative: `P2 COUNTERS RECOVERY (-${dmg} HP).`,
    };
  }

  // 6. Feint vs Shield Block
  if ((a1 === "ARM_FEINT_WAVE" || a1 === "RAISE_ARM_HIGH") && a2 === "SHIELD_BLOCK") {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 14,
      outcomeType: "FEINT_TRICK",
      narrative: "P1 FEINT OPENS GUARD (-14 HP).",
    };
  }

  if ((a2 === "ARM_FEINT_WAVE" || a2 === "RAISE_ARM_HIGH") && a1 === "SHIELD_BLOCK") {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 14,
      p2Damage: 0,
      outcomeType: "FEINT_TRICK",
      narrative: "P2 FEINT OPENS GUARD (-14 HP).",
    };
  }

  // 7. Defensive Shield Block (absorbs 100% of strike damage)
  if (a1 === "SHIELD_BLOCK") {
    if (cmd2.baseDamage === 0) {
      return {
        p1Action: a1,
        p2Action: a2,
        p1Pose: cmd1.pose,
        p2Pose: cmd2.pose,
        p1Damage: 0,
        p2Damage: 0,
        outcomeType: "NEUTRAL_REPOSITION",
        narrative: "P1 RAISES DEFENSIVE ENERGY SHIELD.",
      };
    }
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "SHIELD_ABSORB",
      narrative: `P1 DEFENSIVE SHIELD BLOCKS ATTACK (0 DMG).`,
    };
  }

  if (a2 === "SHIELD_BLOCK") {
    if (cmd1.baseDamage === 0) {
      return {
        p1Action: a1,
        p2Action: a2,
        p1Pose: cmd1.pose,
        p2Pose: cmd2.pose,
        p1Damage: 0,
        p2Damage: 0,
        outcomeType: "NEUTRAL_REPOSITION",
        narrative: "P2 RAISES DEFENSIVE ENERGY SHIELD.",
      };
    }
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "SHIELD_ABSORB",
      narrative: `P2 DEFENSIVE SHIELD BLOCKS ATTACK (0 DMG).`,
    };
  }

  // 8. Evasive Dodge
  if (a1 === "EVASIVE_DODGE" || tactics1.evasionPriority) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "NEUTRAL_REPOSITION",
      narrative: "P1 EVADES. ATTACK WHIFFS.",
    };
  }

  if (a2 === "EVASIVE_DODGE" || tactics2.evasionPriority) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "NEUTRAL_REPOSITION",
      narrative: "P2 EVADES. ATTACK WHIFFS.",
    };
  }

  // 9. Mutual Direct Strikes (Clash)
  const p1IsAttacking = cmd1.baseDamage > 0;
  const p2IsAttacking = cmd2.baseDamage > 0;

  if (p1IsAttacking && p2IsAttacking) {
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 14,
      p2Damage: 14,
      outcomeType: "CLASH_TRADE",
      narrative: "TRADE: -14 HP EACH.",
    };
  }

  // 10. Clean Strike / Whiff Punish Counter
  if (p1IsAttacking) {
    const isWhiffPunish = cmd1.label.includes("COUNTER");
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: cmd1.baseDamage,
      outcomeType: isWhiffPunish ? "WHIFF_RECOVERY_PUNISH" : "CLEAN_HIT",
      narrative: isWhiffPunish
        ? `P1 COUNTER-ATTACKS RECOVERY (-${cmd1.baseDamage} HP).`
        : `P1 CONNECTS ${cmd1.label} (-${cmd1.baseDamage} HP).`,
    };
  }

  if (p2IsAttacking) {
    const isWhiffPunish = cmd2.label.includes("COUNTER");
    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: cmd2.baseDamage,
      p2Damage: 0,
      outcomeType: isWhiffPunish ? "WHIFF_RECOVERY_PUNISH" : "CLEAN_HIT",
      narrative: isWhiffPunish
        ? `P2 COUNTER-ATTACKS RECOVERY (-${cmd2.baseDamage} HP).`
        : `P2 CONNECTS ${cmd2.label} (-${cmd2.baseDamage} HP).`,
    };
  }

  // 11. Solo execution against neutral opponent
  if (a1 !== "NEUTRAL_GUARD" && a2 === "NEUTRAL_GUARD") {
    let desc = `P1 EXECUTES ${cmd1.label}.`;
    if (a1 === "CROUCH_DUCK") desc = "P1 CROUCHES LOW TO THE GROUND.";
    else if (a1 === "AERIAL_JUMP") desc = "P1 LEAPS HIGH INTO AIR (AERIAL JUMP).";
    else if (a1 === "RAISE_ARM_HIGH") desc = "P1 RAISES ARM HIGH TO THE SKY.";
    else if (a1 === "ARM_FEINT_WAVE") desc = "P1 EXECUTES FEINT WAVE.";

    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "NEUTRAL_REPOSITION",
      narrative: desc,
    };
  }

  if (a2 !== "NEUTRAL_GUARD" && a1 === "NEUTRAL_GUARD") {
    let desc = `P2 EXECUTES ${cmd2.label}.`;
    if (a2 === "CROUCH_DUCK") desc = "P2 CROUCHES LOW TO THE GROUND.";
    else if (a2 === "AERIAL_JUMP") desc = "P2 LEAPS HIGH INTO AIR (AERIAL JUMP).";
    else if (a2 === "RAISE_ARM_HIGH") desc = "P2 RAISES ARM HIGH TO THE SKY.";
    else if (a2 === "ARM_FEINT_WAVE") desc = "P2 EXECUTES FEINT WAVE.";

    return {
      p1Action: a1,
      p2Action: a2,
      p1Pose: cmd1.pose,
      p2Pose: cmd2.pose,
      p1Damage: 0,
      p2Damage: 0,
      outcomeType: "NEUTRAL_REPOSITION",
      narrative: desc,
    };
  }

  return {
    p1Action: a1,
    p2Action: a2,
    p1Pose: cmd1.pose,
    p2Pose: cmd2.pose,
    p1Damage: 0,
    p2Damage: 0,
    outcomeType: "NEUTRAL_REPOSITION",
    narrative: "NEUTRAL RESET.",
  };
}
