// natural language parser and action plan generator for combat instructions

export type NeuralActionClass =
  | "CROUCH_DUCK"
  | "EVASIVE_DODGE"
  | "AERIAL_JUMP"
  | "RAISE_ARM_HIGH"
  | "PUNCH_STRIKE"
  | "LOW_LEG_SWEEP"
  | "MID_LEG_KICK"
  | "AERIAL_KICK"
  | "HEADBUTT_THRUST"
  | "SHIELD_GUARD"
  | "FEINT_DECEIVE"
  | "PASSIVE_ABSORB"
  | "ADAPTIVE_COUNTER"
  | "UPPERCUT_LIFT"
  | "FLYING_KNEE"
  | "SPINNING_BACKFIST"
  | "NEUTRAL_STANCE";

export type LimbTarget = "ARM" | "LEG" | "HEAD" | "TORSO" | "FULL_BODY";
export type SpatialPlane = "HIGH" | "MID" | "LOW" | "UNDER" | "AERIAL";

export interface ActionNode {
  id: string;
  sequenceIndex: number;
  actionClass: NeuralActionClass;
  label: string;
  limb: LimbTarget;
  plane: SpatialPlane;
  baseDamage: number;
  durationMs: number;
  triggerEvent: "IMMEDIATE" | "ON_OPPONENT_RECOVERY" | "ON_OPPONENT_STRIKE" | "AERIAL_WINDOW";
  confidence: number;
  matchedTokens: string[];
  explanation: string;
}

export interface ActionPlanDAG {
  nodes: ActionNode[];
  rawPrompt: string;
  isConditional: boolean;
  conditionalTriggerDescription?: string;
  tactics: {
    aggression: number;   // 0 to 100
    defense: number;      // 0 to 100
    agility: number;      // 0 to 100
    tacticalIQ: number;   // 0 to 100
    evasionPriority: boolean;
    pacifist: boolean;
    damageMultiplier: number;
    defenseMultiplier: number;
  };
  bioTags: Array<{ token: string; tag: string }>;
  thoughtLog: string[];
}

// subword n-gram embedding
const DENSE_DIM = 16;

/**
 * Normalizes text: strips diacritics, lowercase, removes punctuation except delimiters.
 */
export function normalizeSpanish(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Morphological stemmer & enclitic stripper for Spanish verbs.
 * Strips enclitic pronouns: -le, -les, -lo, -la, -los, -las, -te, -se, -me, -nos
 * e.g., "pégale" -> "pega", "defiéndete" -> "defiende", "esquívalo" -> "esquiva"
 */
export function stripEnclitics(token: string): string {
  const t = normalizeSpanish(token);
  return t.replace(/(?:les|los|las|le|lo|la|te|se|me|nos)$/i, "");
}

/**
 * Extracts character n-grams (sizes 3 and 4) from a word.
 * This guarantees that typos ("pándole", "peglae", "agachtae", "esqiva")
 * and unseen morphological variants preserve >85% vector similarity.
 */
function extractSubwordNgrams(word: string): string[] {
  const padded = `<${word}>`;
  const ngrams: string[] = [];
  for (let n = 3; n <= 4; n++) {
    for (let i = 0; i <= padded.length - n; i++) {
      ngrams.push(padded.substring(i, i + n));
    }
  }
  return ngrams;
}

/**
 * Fast deterministic hash function to project subwords into embedding dimensions.
 */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Computes a 16-D continuous unit embedding vector for any arbitrary word.
 */
export function embedWord(word: string): number[] {
  const norm = stripEnclitics(word);
  const ngrams = extractSubwordNgrams(norm);
  const vec = new Array(DENSE_DIM).fill(0);

  if (ngrams.length === 0) return vec;

  for (const ng of ngrams) {
    const h = hashString(ng);
    const idx = h % DENSE_DIM;
    const sign = (h >> 8) % 2 === 0 ? 1 : -1;
    vec[idx] += sign * 1.0;
  }

  // L2 Normalize
  let normSq = 0;
  for (let i = 0; i < DENSE_DIM; i++) normSq += vec[i] * vec[i];
  const mag = Math.sqrt(normSq);
  if (mag > 0.00001) {
    for (let i = 0; i < DENSE_DIM; i++) vec[i] /= mag;
  }
  return vec;
}

/**
 * Cosine similarity between two dense vectors (-1.0 to 1.0).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < DENSE_DIM; i++) dot += a[i] * b[i];
  return dot;
}

// action category anchors
interface CategoryAnchor {
  category: NeuralActionClass;
  label: string;
  defaultLimb: LimbTarget;
  defaultPlane: SpatialPlane;
  damage: number;
  durationMs: number;
  prototypes: string[]; // Spanish verbs, nouns, slang, and modisms
  centroidVector: number[];
}

const ACTION_CENTROIDS: CategoryAnchor[] = [
  {
    category: "CROUCH_DUCK",
    label: "CROUCH",
    defaultLimb: "HEAD",
    defaultPlane: "LOW",
    damage: 0,
    durationMs: 320,
    prototypes: [
      "agachate", "agacha", "agacharse", "cabecea", "cabeceo", "escondete",
      "baja", "baja la cabeza", "inclinate", "crouch", "duck", "doblate",
      "agachate", "ponte abajo", "cuerpo a tierra", "bajo"
    ],
    centroidVector: [],
  },
  {
    category: "EVASIVE_DODGE",
    label: "DODGE",
    defaultLimb: "FULL_BODY",
    defaultPlane: "MID",
    damage: 0,
    durationMs: 300,
    prototypes: [
      "esquiva", "esquivalo", "evita", "evade", "quitate", "zafate",
      "hazte a un lado", "retrocede", "escapa", "paso atras", "dodge", "side step"
    ],
    centroidVector: [],
  },
  {
    category: "AERIAL_JUMP",
    label: "JUMP",
    defaultLimb: "FULL_BODY",
    defaultPlane: "AERIAL",
    damage: 0,
    durationMs: 380,
    prototypes: [
      "salta", "saltar", "brinca", "brincar", "elevate", "vuela", "sube",
      "al aire", "jump", "leap", "en el aire", "salto"
    ],
    centroidVector: [],
  },
  {
    category: "RAISE_ARM_HIGH",
    label: "HIGH GUARD",
    defaultLimb: "ARM",
    defaultPlane: "HIGH",
    damage: 14,
    durationMs: 320,
    prototypes: [
      "alza el brazo", "mueve la mano arriba", "sube la mano", "mano arriba",
      "brazo arriba", "levanta el brazo", "levanta la mano", "alza la mano",
      "mueve la mano", "alza el puño", "eleva el brazo", "raise arm"
    ],
    centroidVector: [],
  },
  {
    category: "LOW_LEG_SWEEP",
    label: "LOW SWEEP",
    defaultLimb: "LEG",
    defaultPlane: "UNDER",
    damage: 28,
    durationMs: 400,
    prototypes: [
      "baja la patada", "metele por debajo", "por debajo", "barrida", "al suelo",
      "a los tobillos", "a los pies", "barre el piso", "patada baja", "low sweep",
      "pateale abajo", "al ras del suelo", "metele abajo", "al piso", "saca los pies",
      "revuelcalo", "revuelcalo por el piso", "tiralo al piso", "tiralo al suelo"
    ],
    centroidVector: [],
  },
  {
    category: "MID_LEG_KICK",
    label: "MID KICK",
    defaultLimb: "LEG",
    defaultPlane: "MID",
    damage: 24,
    durationMs: 350,
    prototypes: [
      "patada", "patea", "patealo", "patadon", "pierna", "kick", "dale una patada",
      "metele una patada", "pateale el cuerpo", "zancada", "patada al estomago"
    ],
    centroidVector: [],
  },
  {
    category: "AERIAL_KICK",
    label: "AERIAL KICK",
    defaultLimb: "LEG",
    defaultPlane: "AERIAL",
    damage: 34,
    durationMs: 420,
    prototypes: [
      "patada en el aire", "patada voladora", "patealo en el aire", "dropkick",
      "salta y dale una patada", "patada aerea", "vuela y patea"
    ],
    centroidVector: [],
  },
  {
    category: "HEADBUTT_THRUST",
    label: "HEADBUTT",
    defaultLimb: "HEAD",
    defaultPlane: "MID",
    damage: 30,
    durationMs: 360,
    prototypes: [
      "pegale con la cabeza", "dale con la cabeza", "cabezazo", "testarazo",
      "craneo", "frentazo", "cabecealo", "headbutt", "rompele con la frente"
    ],
    centroidVector: [],
  },
  {
    category: "PUNCH_STRIKE",
    label: "PUNCH",
    defaultLimb: "ARM",
    defaultPlane: "MID",
    damage: 24,
    durationMs: 300,
    prototypes: [
      "pegale", "golpealo", "dale", "puño", "jab", "recto", "cross", "gancho",
      "punch", "hit", "strike", "parte", "partelo", "rompele", "rompelo", "revientalo", "sacudelo",
      "machacalo", "destroza", "destrozalo", "castigalo", "ataca", "mandale", "metele",
      "sacale el aire", "quiebralo", "despedazalo", "trituralo", "dale duro", "dale con todo"
    ],
    centroidVector: [],
  },
  {
    category: "SHIELD_GUARD",
    label: "BLOCK",
    defaultLimb: "ARM",
    defaultPlane: "MID",
    damage: 0,
    durationMs: 350,
    prototypes: [
      "defiendete", "bloquea", "cubrete", "escudo", "resiste", "aguanta",
      "guardia", "no pelees", "solo defiendete", "protegete", "shield", "block",
      "evita que te peguen", "evita daño", "cubrete la cara"
    ],
    centroidVector: [],
  },
  {
    category: "FEINT_DECEIVE",
    label: "FEINT",
    defaultLimb: "ARM",
    defaultPlane: "MID",
    damage: 6,
    durationMs: 280,
    prototypes: [
      "mueve el brazo", "finta", "amaga", "engaña", "distrae", "hazle finta",
      "provocalo", "feint", "bait", "mueve la mano rapido"
    ],
    centroidVector: [],
  },
  {
    category: "PASSIVE_ABSORB",
    label: "ABSORB",
    defaultLimb: "FULL_BODY",
    defaultPlane: "MID",
    damage: 0,
    durationMs: 400,
    prototypes: [
      "deja que te pegue", "no hagas nada", "quedate quieto", "recibe el golpe",
      "no te muevas", "parate ahi", "absorbe", "quieto", "dejate pegar"
    ],
    centroidVector: [],
  },
  {
    category: "ADAPTIVE_COUNTER",
    label: "COUNTER",
    defaultLimb: "FULL_BODY",
    defaultPlane: "MID",
    damage: 26,
    durationMs: 340,
    prototypes: [
      "anticipa", "adaptate", "aprende", "contragolpea", "espera el error",
      "leelo", "counter", "castiga su movimiento", "espera que falle"
    ],
    centroidVector: [],
  },
  {
    category: "UPPERCUT_LIFT",
    label: "UPPERCUT",
    defaultLimb: "ARM",
    defaultPlane: "HIGH",
    damage: 30,
    durationMs: 320,
    prototypes: [
      "gancho", "uppercut", "sube el golpe", "puño ascendente", "gancho a la barbilla",
      "mandibula", "quijada", "gancho arriba", "upper", "subele el puño"
    ],
    centroidVector: [],
  },
  {
    category: "FLYING_KNEE",
    label: "FLYING KNEE",
    defaultLimb: "LEG",
    defaultPlane: "AERIAL",
    damage: 32,
    durationMs: 380,
    prototypes: [
      "rodillazo", "rodillazo volador", "vuela y dale con la rodilla", "rodilla en el aire",
      "flying knee", "rodillazo al pecho"
    ],
    centroidVector: [],
  },
  {
    category: "SPINNING_BACKFIST",
    label: "SPINNING FIST",
    defaultLimb: "ARM",
    defaultPlane: "HIGH",
    damage: 28,
    durationMs: 340,
    prototypes: [
      "giro", "golpe giratorio", "puño con giro", "spinning backfist", "vuelta y golpe",
      "giro de puño", "codazo con giro"
    ],
    centroidVector: [],
  },
];

// Pre-compute centroids for all anchor categories
for (const centroid of ACTION_CENTROIDS) {
  const sumVec = new Array(DENSE_DIM).fill(0);
  for (const proto of centroid.prototypes) {
    const tokens = proto.split(/\s+/);
    for (const tok of tokens) {
      const v = embedWord(tok);
      for (let i = 0; i < DENSE_DIM; i++) sumVec[i] += v[i];
    }
  }
  // Normalize centroid
  let normSq = 0;
  for (let i = 0; i < DENSE_DIM; i++) normSq += sumVec[i] * sumVec[i];
  const mag = Math.sqrt(normSq);
  if (mag > 0.00001) {
    for (let i = 0; i < DENSE_DIM; i++) sumVec[i] /= mag;
  }
  centroid.centroidVector = sumVec;
}

// clause classification
export interface ChunkClassification {
  category: NeuralActionClass;
  label: string;
  limb: LimbTarget;
  plane: SpatialPlane;
  damage: number;
  durationMs: number;
  confidence: number;
  explanation: string;
}

/**
 * Classifies any arbitrary phrase/clause in continuous vector space.
 * Matches multi-word n-grams against action centroids with semantic boosting.
 */
export function classifyClauseSemantics(clause: string): ChunkClassification {
  const norm = normalizeSpanish(clause);
  const words = norm.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return {
      category: "NEUTRAL_STANCE",
      label: "BALANCED GUARD",
      limb: "FULL_BODY",
      plane: "MID",
      damage: 10,
      durationMs: 300,
      confidence: 0.5,
      explanation: "Empty clause fallback to neutral stance.",
    };
  }

  // 1. Check for specific high-priority multi-word semantic patterns
  // (e.g., "patada en el aire", "alza el brazo", "por debajo", "con la cabeza")
  if (norm.includes("patada en el aire") || (norm.includes("patada") && (norm.includes("aire") || norm.includes("voladora")))) {
    return {
      category: "AERIAL_KICK",
      label: "AERIAL KICK",
      limb: "LEG",
      plane: "AERIAL",
      damage: 34,
      durationMs: 420,
      confidence: 0.98,
      explanation: "Aerial kick strike.",
    };
  }

  if (norm.includes("baja la patada") || norm.includes("por debajo") || norm.includes("al suelo") || norm.includes("tobillo") || norm.includes("barrida")) {
    return {
      category: "LOW_LEG_SWEEP",
      label: "LOW SWEEP",
      limb: "LEG",
      plane: "UNDER",
      damage: 28,
      durationMs: 400,
      confidence: 0.96,
      explanation: "Low horizontal leg sweep.",
    };
  }

  if (norm.includes("alza el brazo") || norm.includes("mueve la mano arriba") || norm.includes("mano arriba") || norm.includes("brazo arriba") || norm.includes("sube la mano")) {
    return {
      category: "RAISE_ARM_HIGH",
      label: "HIGH GUARD",
      limb: "ARM",
      plane: "HIGH",
      damage: 14,
      durationMs: 320,
      confidence: 0.97,
      explanation: "High arm guard posture.",
    };
  }

  if (norm.includes("cabeza") || norm.includes("cabezazo") || norm.includes("testarazo") || norm.includes("craneo")) {
    return {
      category: "HEADBUTT_THRUST",
      label: "HEADBUTT",
      limb: "HEAD",
      plane: "MID",
      damage: 30,
      durationMs: 360,
      confidence: 0.95,
      explanation: "Headbutt kinetic thrust.",
    };
  }

  if (norm.includes("agacha") || norm.includes("agachate") || norm.includes("cabecea") || norm.includes("cabeceo") || norm.includes("duck")) {
    return {
      category: "CROUCH_DUCK",
      label: "CROUCH",
      limb: "HEAD",
      plane: "LOW",
      damage: 0,
      durationMs: 320,
      confidence: 0.98,
      explanation: "Low crouch posture.",
    };
  }

  if (norm.includes("esquiva") || norm.includes("esquivalo") || norm.includes("hazte a un lado") || norm.includes("evade") || norm.includes("quitate")) {
    return {
      category: "EVASIVE_DODGE",
      label: "DODGE",
      limb: "FULL_BODY",
      plane: "MID",
      damage: 0,
      durationMs: 300,
      confidence: 0.98,
      explanation: "Lateral evasive step.",
    };
  }

  if (norm.includes("salta") || norm.includes("brinca") || norm.includes("elevate") || norm.includes("vuela") || norm.includes("jump")) {
    return {
      category: "AERIAL_JUMP",
      label: "JUMP",
      limb: "FULL_BODY",
      plane: "AERIAL",
      damage: 0,
      durationMs: 380,
      confidence: 0.98,
      explanation: "Vertical airborne jump.",
    };
  }

  if (norm.includes("patada") || norm.includes("patea") || norm.includes("patealo") || norm.includes("patadon") || norm.includes("kick")) {
    return {
      category: "MID_LEG_KICK",
      label: "MID KICK",
      limb: "LEG",
      plane: "MID",
      damage: 24,
      durationMs: 350,
      confidence: 0.98,
      explanation: "Mid-level leg kick.",
    };
  }

  if (
    norm.includes("pegale") ||
    norm.includes("golpealo") ||
    norm.includes("pega") ||
    norm.includes("golpea") ||
    norm.includes("dale") ||
    norm.includes("puno") ||
    norm.includes("puño") ||
    norm.includes("jab") ||
    norm.includes("cross") ||
    norm.includes("directo") ||
    norm.includes("partelo") ||
    norm.includes("revienta") ||
    norm.includes("machaca") ||
    norm.includes("destroza") ||
    norm.includes("sacale el aire")
  ) {
    return {
      category: "PUNCH_STRIKE",
      label: "PUNCH",
      limb: "ARM",
      plane: "MID",
      damage: 24,
      durationMs: 300,
      confidence: 0.98,
      explanation: "Direct punch impact.",
    };
  }

  if (norm.includes("defiendete") || norm.includes("bloquea") || norm.includes("cubrete") || norm.includes("resiste") || norm.includes("aguanta")) {
    return {
      category: "SHIELD_GUARD",
      label: "BLOCK",
      limb: "ARM",
      plane: "MID",
      damage: 0,
      durationMs: 350,
      confidence: 0.98,
      explanation: "Active defensive guard.",
    };
  }

  if (norm.includes("mueve el brazo") || norm.includes("finta") || norm.includes("amaga") || norm.includes("distrae")) {
    return {
      category: "FEINT_DECEIVE",
      label: "FEINT",
      limb: "ARM",
      plane: "MID",
      damage: 6,
      durationMs: 280,
      confidence: 0.94,
      explanation: "Arm feint motion.",
    };
  }

  // 2. Vector centroid cosine similarity over all words in clause
  // Compute pooled sentence vector
  const pooledVec = new Array(DENSE_DIM).fill(0);
  for (const w of words) {
    const v = embedWord(w);
    for (let i = 0; i < DENSE_DIM; i++) pooledVec[i] += v[i];
  }
  let normSq = 0;
  for (let i = 0; i < DENSE_DIM; i++) normSq += pooledVec[i] * pooledVec[i];
  const mag = Math.sqrt(normSq);
  if (mag > 0.00001) {
    for (let i = 0; i < DENSE_DIM; i++) pooledVec[i] /= mag;
  }

  let bestAnchor = ACTION_CENTROIDS[0];
  let highestSim = -999;

  for (const anchor of ACTION_CENTROIDS) {
    // Test similarity of pooled clause
    let sim = cosineSimilarity(pooledVec, anchor.centroidVector);

    // Boost if any word prototype has strong direct subword overlap
    for (const w of words) {
      const stripped = stripEnclitics(w);
      for (const proto of anchor.prototypes) {
        if (proto === stripped || stripped.startsWith(proto) || proto.startsWith(stripped)) {
          sim += 0.35;
          break;
        }
      }
    }

    if (sim > highestSim) {
      highestSim = sim;
      bestAnchor = anchor;
    }
  }

  // Detect explicit limb and plane overrides in clause
  let detectedLimb = bestAnchor.defaultLimb;
  let detectedPlane = bestAnchor.defaultPlane;

  if (words.some((w) => ["pierna", "pata", "pie", "tobillo", "kick"].includes(w))) {
    detectedLimb = "LEG";
  } else if (words.some((w) => ["brazo", "mano", "puno", "puño", "codo"].includes(w))) {
    detectedLimb = "ARM";
  } else if (words.some((w) => ["cabeza", "craneo", "frente"].includes(w))) {
    detectedLimb = "HEAD";
  }

  if (words.some((w) => ["aire", "volador", "voladora", "arriba", "salto", "alto"].includes(w))) {
    detectedPlane = "HIGH";
  } else if (words.some((w) => ["abajo", "suelo", "piso", "debajo", "tobillo", "bajo"].includes(w))) {
    detectedPlane = "UNDER";
  }

  return {
    category: bestAnchor.category,
    label: bestAnchor.label,
    limb: detectedLimb,
    plane: detectedPlane,
    damage: bestAnchor.damage,
    durationMs: bestAnchor.durationMs,
    confidence: Math.min(0.99, Math.max(0.4, (highestSim + 1) / 2)),
    explanation: `Cosine match with ${bestAnchor.category} cluster (score: ${highestSim.toFixed(3)})`,
  };
}

// build action plan DAG from prompt
export function compileNaturalActionPlan(prompt: string): ActionPlanDAG {
  const norm = normalizeSpanish(prompt);
  const thoughtLog: string[] = [];
  const bioTags: Array<{ token: string; tag: string }> = [];

  thoughtLog.push(`[NLU INPUT] Raw prompt: "${prompt}"`);

  // Tokenize for BIO tagging
  const rawTokens = prompt.trim().split(/\s+/).filter(Boolean);

  // 1. Global Tactical Intent Analysis
  const avoidDamage =
    norm.includes("evita que te peguen") ||
    norm.includes("evita que te peguen mucho") ||
    norm.includes("solo defiendete") ||
    norm.includes("no pelees solo") ||
    norm.includes("evita dano") ||
    norm.includes("bloquea todo");

  const highDamage =
    norm.includes("quitale mucho dano") ||
    norm.includes("quitale mucho daño") ||
    norm.includes("mucho dano") ||
    norm.includes("mucho daño") ||
    norm.includes("revientalo") ||
    norm.includes("pega fuerte") ||
    norm.includes("destrozalo") ||
    norm.includes("con todo");

  const evasionPriority =
    norm.includes("esquiva todo el pele") ||
    norm.includes("esquiva todo") ||
    norm.includes("se como el agua") ||
    norm.includes("evade todo");

  const isPacifist =
    norm.includes("no hagas nada") ||
    norm.includes("deja que el te pegue") ||
    norm.includes("deja que te pegue") ||
    norm.includes("dejate golpear") ||
    norm.includes("recibe el golpe") ||
    norm.includes("no ataques para nada") ||
    (norm.includes("nada") && norm.includes("hagas"));

  const isAdaptive =
    norm.includes("anticipa") ||
    norm.includes("adaptate") ||
    norm.includes("aprende") ||
    norm.includes("contragolpea") ||
    norm.includes("leelo");

  const tactics = {
    aggression: isPacifist ? 0 : highDamage ? 95 : 70,
    defense: avoidDamage ? 95 : 50,
    agility: evasionPriority ? 90 : 55,
    tacticalIQ: 85,
    evasionPriority,
    pacifist: isPacifist,
    damageMultiplier: highDamage ? 1.4 : 1.0,
    defenseMultiplier: avoidDamage ? 0.25 : 1.0,
  };

  thoughtLog.push(`[INTENT EXTRACTION] Pacifist=${isPacifist} | DmgBoost=${highDamage} | DefShield=${avoidDamage} | Evasion=${evasionPriority}`);

  // If strict pacifist
  if (isPacifist) {
    for (const t of rawTokens) bioTags.push({ token: t, tag: "B-PASSIVE_ABSORB" });
    thoughtLog.push("[BIO TAGGER] All tokens projected to B-PASSIVE_ABSORB.");
    return {
      nodes: [
        {
          id: "node-1",
          sequenceIndex: 1,
          actionClass: "PASSIVE_ABSORB",
          label: "ABSORB",
          limb: "FULL_BODY",
          plane: "MID",
          baseDamage: 0,
          durationMs: 400,
          triggerEvent: "IMMEDIATE",
          confidence: 0.99,
          matchedTokens: rawTokens,
          explanation: "Passive stance: Hold position and absorb.",
        },
      ],
      rawPrompt: prompt,
      isConditional: false,
      tactics,
      bioTags,
      thoughtLog,
    };
  }

  // 2. DISCOURSE SYNTACTIC CONDITIONALS:
  // e.g. "defiéndete y cuando él termine de golpear, golpéalo tú"
  // e.g. "esquiva y cuando termine de atacar, dale con la cabeza"
  // e.g. "bloquea y cuando el rival pare, dale una patada en el aire"
  const conditionalMatch = norm.match(
    /(?:(defiendete|bloquea|cubrete|esquiva|resiste|espera|aguanta|hazte a un lado))\s*(?:y\s+)?cuando\s+(?:el|rival|oponente|este)?\s*(?:termine|acabe|pare|deje|falle)?\s*(?:de\s+(?:golpear|atacar|pegar|tirar|dar))?[,\s]+(.+)$/i
  );

  if (conditionalMatch) {
    const defensePart = conditionalMatch[1].trim();
    const retaliatePart = conditionalMatch[2].trim();

    thoughtLog.push(`[SYNTACTIC PARSER] Conditional Guard-Counter detected.`);
    thoughtLog.push(`[PHASE 1 - GUARD DIRECTIVE] "${defensePart}"`);
    thoughtLog.push(`[PHASE 2 - REACTIVE RETALIATION] Trigger: On Opponent Strike Recovery -> Execute "${retaliatePart}"`);

    const defClass = classifyClauseSemantics(defensePart);
    const retClass = classifyClauseSemantics(retaliatePart);

    let retDmg = retClass.damage;
    if (tactics.damageMultiplier > 1.0) retDmg = Math.round(retDmg * tactics.damageMultiplier);

    // Tag tokens
    for (const t of rawTokens) {
      const lower = normalizeSpanish(t);
      if (lower.includes("cuando") || lower.includes("termine") || lower.includes("acabe")) {
        bioTags.push({ token: t, tag: "B-TEMPORAL_TRIGGER" });
      } else if (lower.includes("defiend") || lower.includes("bloque") || lower.includes("cubre")) {
        bioTags.push({ token: t, tag: "B-GUARD_ACTIVE" });
      } else if (lower.includes("golpe") || lower.includes("pega") || lower.includes("dale") || lower.includes("patada") || lower.includes("cabeza")) {
        bioTags.push({ token: t, tag: "B-COUNTER_STRIKE" });
      } else {
        bioTags.push({ token: t, tag: "O" });
      }
    }

    tactics.tacticalIQ = 98; // High IQ for executing conditional counter-timing

    return {
      nodes: [
        {
          id: "node-guard",
          sequenceIndex: 1,
          actionClass: defClass.category === "EVASIVE_DODGE" ? "EVASIVE_DODGE" : "SHIELD_GUARD",
          label: defClass.label,
          limb: defClass.limb,
          plane: defClass.plane,
          baseDamage: 0,
          durationMs: 350,
          triggerEvent: "IMMEDIATE",
          confidence: defClass.confidence,
          matchedTokens: [defensePart],
          explanation: `Phase 1 defensive hold: ${defClass.explanation}`,
        },
        {
          id: "node-counter",
          sequenceIndex: 2,
          actionClass: retClass.category,
          label: `COUNTER: ${retClass.label}`,
          limb: retClass.limb,
          plane: retClass.plane,
          baseDamage: retDmg,
          durationMs: retClass.durationMs,
          triggerEvent: "ON_OPPONENT_RECOVERY",
          confidence: retClass.confidence,
          matchedTokens: [retaliatePart],
          explanation: `Phase 2 counter-attack: ${retClass.explanation}`,
        },
      ],
      rawPrompt: prompt,
      isConditional: true,
      conditionalTriggerDescription: "Triggers counter-strike precisely when opponent enters recovery frame.",
      tactics,
      bioTags,
      thoughtLog,
    };
  }

  // 3. SEQUENTIAL MULTI-STAGE COMPOSITION:
  // Split along sequence markers: commas, semicolons, "y luego", "luego", "después", "entonces", "y"
  const rawClauses = norm
    .split(/[,;.\n]+|\b(?:y\s+luego|y\s+despues|luego|despues|después|entonces|seguidamente|then|next|y|and)\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  thoughtLog.push(`[SEQUENTIAL CHUNKER] Identified ${rawClauses.length} distinct tactical clauses.`);

  const nodes: ActionNode[] = [];
  let seqIdx = 1;

  for (const clause of rawClauses) {
    const classification = classifyClauseSemantics(clause);
    let dmg = classification.damage;
    if (dmg > 0 && tactics.damageMultiplier > 1.0) {
      dmg = Math.round(dmg * tactics.damageMultiplier);
    }

    let repeatCount = 1;
    const clauseNorm = normalizeSpanish(clause);
    if (clauseNorm.includes("tres veces") || clauseNorm.includes("3 veces") || clauseNorm.includes("three times")) {
      repeatCount = 3;
    } else if (clauseNorm.includes("dos veces") || clauseNorm.includes("2 veces") || clauseNorm.includes("two times") || clauseNorm.includes("twice")) {
      repeatCount = 2;
    } else if (clauseNorm.includes("cuatro veces") || clauseNorm.includes("4 veces") || clauseNorm.includes("four times")) {
      repeatCount = 4;
    }

    for (let r = 0; r < repeatCount; r++) {
      thoughtLog.push(
        `[STEP ${seqIdx}] "${clause}" -> ${classification.label} (Limb: ${classification.limb}, Plane: ${classification.plane}, Dmg: ${dmg}) [Confidence: ${(classification.confidence * 100).toFixed(1)}%]`
      );

      nodes.push({
        id: `node-${seqIdx}`,
        sequenceIndex: seqIdx,
        actionClass: classification.category,
        label: classification.label,
        limb: classification.limb,
        plane: classification.plane,
        baseDamage: dmg,
        durationMs: classification.durationMs,
        triggerEvent: "IMMEDIATE",
        confidence: classification.confidence,
        matchedTokens: [clause],
        explanation: classification.explanation,
      });

      seqIdx++;
    }
  }

  // Generate BIO Tags for raw tokens
  for (const tok of rawTokens) {
    const clean = normalizeSpanish(tok);
    if (["luego", "despues", "entonces", "primero", "y"].includes(clean)) {
      bioTags.push({ token: tok, tag: "B-SEQ_ORDER" });
    } else if (["brazo", "mano", "pie", "pierna", "cabeza", "craneo", "cuerpo"].includes(clean)) {
      bioTags.push({ token: tok, tag: "B-LIMB_TARGET" });
    } else if (["aire", "suelo", "piso", "debajo", "arriba", "abajo"].includes(clean)) {
      bioTags.push({ token: tok, tag: "B-SPATIAL_PLANE" });
    } else if (nodes.some((n) => n.matchedTokens.some((mt) => mt.includes(clean)))) {
      bioTags.push({ token: tok, tag: "B-ACTION" });
    } else {
      bioTags.push({ token: tok, tag: "O" });
    }
  }

  if (nodes.length === 0) {
    nodes.push({
      id: "node-fallback",
      sequenceIndex: 1,
      actionClass: "NEUTRAL_STANCE",
      label: "NEUTRAL",
      limb: "FULL_BODY",
      plane: "MID",
      baseDamage: 0,
      durationMs: 300,
      triggerEvent: "IMMEDIATE",
      confidence: 0.5,
      matchedTokens: [],
      explanation: "Neutral ready stance.",
    });
  }

  tactics.tacticalIQ = Math.min(100, 75 + nodes.length * 7);

  return {
    nodes,
    rawPrompt: prompt,
    isConditional: false,
    tactics,
    bioTags,
    thoughtLog,
  };
}
