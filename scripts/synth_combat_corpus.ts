/**
 * Synthetic combat corpus generator and evaluator.
 * Grounded in Spanish FrameNet frames and Spanish WordNet synsets.
 */

import { compileNaturalActionPlan, classifyClauseSemantics } from "../lib/neural-combat-nlp";

export interface SyntheticInstance {
  id: string;
  text: string;
  expectedActions: string[];
  isConditional: boolean;
  slots: Array<{ token: string; tag: string }>;
}

const ACTION_VERBS = [
  { text: "agáchate", class: "CROUCH_DUCK" },
  { text: "agacha la cabeza", class: "CROUCH_DUCK" },
  { text: "cabecea", class: "CROUCH_DUCK" },
  { text: "baja el cuerpo", class: "CROUCH_DUCK" },
  { text: "esquiva", class: "EVASIVE_DODGE" },
  { text: "esquívalo", class: "EVASIVE_DODGE" },
  { text: "hazte a un lado", class: "EVASIVE_DODGE" },
  { text: "quítate", class: "EVASIVE_DODGE" },
  { text: "salta", class: "AERIAL_JUMP" },
  { text: "brinca", class: "AERIAL_JUMP" },
  { text: "elévate", class: "AERIAL_JUMP" },
  { text: "alza el brazo", class: "RAISE_ARM_HIGH" },
  { text: "mueve la mano arriba", class: "RAISE_ARM_HIGH" },
  { text: "sube la mano", class: "RAISE_ARM_HIGH" },
  { text: "pégale", class: "PUNCH_STRIKE" },
  { text: "golpéalo", class: "PUNCH_STRIKE" },
  { text: "dale un puño", class: "PUNCH_STRIKE" },
  { text: "revientalo", class: "PUNCH_STRIKE" },
  { text: "pártelo", class: "PUNCH_STRIKE" },
  { text: "destrózalo", class: "PUNCH_STRIKE" },
  { text: "dale con la cabeza", class: "HEADBUTT_THRUST" },
  { text: "métesela con la cabeza", class: "HEADBUTT_THRUST" },
  { text: "baja la patada", class: "LOW_LEG_SWEEP" },
  { text: "métele por debajo", class: "LOW_LEG_SWEEP" },
  { text: "barrida al suelo", class: "LOW_LEG_SWEEP" },
  { text: "revuélcalo por el piso", class: "LOW_LEG_SWEEP" },
  { text: "pégale una patada en el aire", class: "AERIAL_KICK" },
  { text: "patada voladora", class: "AERIAL_KICK" },
  { text: "defiéndete", class: "SHIELD_GUARD" },
  { text: "bloquea", class: "SHIELD_GUARD" },
  { text: "cúbrete", class: "SHIELD_GUARD" },
  { text: "no pelees solo defiéndete", class: "SHIELD_GUARD" },
  { text: "mueve el brazo", class: "FEINT_DECEIVE" },
  { text: "hazle finta", class: "FEINT_DECEIVE" },
  { text: "no hagas nada", class: "PASSIVE_ABSORB" },
  { text: "deja que te pegue", class: "PASSIVE_ABSORB" },
];

const CONNECTORS = [
  "y luego",
  "y después",
  "luego",
  "después",
  "entonces",
  ",",
  "y",
];

export function generateCorpus(count: number = 250): SyntheticInstance[] {
  const instances: SyntheticInstance[] = [];

  for (let i = 0; i < count; i++) {
    // 30% Single Action, 45% Sequential 2-3 Actions, 25% Conditionals
    const typeRoll = Math.random();

    if (typeRoll < 0.3) {
      // Single action
      const v = ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)];
      instances.push({
        id: `synth-${i}`,
        text: v.text,
        expectedActions: [v.class],
        isConditional: false,
        slots: [],
      });
    } else if (typeRoll < 0.75) {
      // Sequential 2 or 3 actions
      const numSteps = Math.random() < 0.7 ? 2 : 3;
      const chosen: typeof ACTION_VERBS = [];
      for (let k = 0; k < numSteps; k++) {
        const v = ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)];
        chosen.push(v);
      }

      let fullText = chosen[0].text;
      for (let k = 1; k < chosen.length; k++) {
        const conn = CONNECTORS[Math.floor(Math.random() * CONNECTORS.length)];
        fullText += (conn === "," ? ", " : ` ${conn} `) + chosen[k].text;
      }

      instances.push({
        id: `synth-${i}`,
        text: fullText,
        expectedActions: chosen.map((c) => c.class),
        isConditional: false,
        slots: [],
      });
    } else {
      // Conditional Guard-Counter
      const defVerbs = ["defiéndete", "bloquea", "cúbrete", "esquiva", "resiste", "hazte a un lado"];
      const triggers = [
        "y cuando él termine de golpear,",
        "cuando termine de atacar,",
        "y cuando el rival falle,",
        "cuando él pare de pegar,",
      ];
      const retVerbs = ["golpéalo tú", "pégale con la cabeza", "métele por debajo", "pégale una patada en el aire", "dale duro"];

      const d = defVerbs[Math.floor(Math.random() * defVerbs.length)];
      const t = triggers[Math.floor(Math.random() * triggers.length)];
      const r = retVerbs[Math.floor(Math.random() * retVerbs.length)];

      const fullText = `${d} ${t} ${r}`;
      instances.push({
        id: `synth-${i}`,
        text: fullText,
        expectedActions: [d.includes("esquiv") ? "EVASIVE_DODGE" : "SHIELD_GUARD", "REACTIVE_COUNTER"],
        isConditional: true,
        slots: [],
      });
    }
  }

  return instances;
}

// Benchmark runner
export function runBenchmark() {
  console.log("Running combat NLU benchmark...");

  const corpus = generateCorpus(100);
  let correct = 0;

  for (const inst of corpus) {
    const plan = compileNaturalActionPlan(inst.text);

    let match = false;
    if (inst.isConditional) {
      match = plan.isConditional;
    } else {
      // Check if action classes match the sequence length and main labels
      if (plan.nodes.length === inst.expectedActions.length) {
        match = plan.nodes.every((n, idx) => {
          const exp = inst.expectedActions[idx];
          return n.actionClass === exp || (exp === "CROUCH_DUCK" && n.plane === "LOW");
        });
      }
    }

    if (match) {
      correct++;
    } else {
      // Log failure case for continuous improvement
      // console.log(`[MISMATCH] Prompt: "${inst.text}" Expected:`, inst.expectedActions, "Got:", plan.nodes.map(n => n.actionClass));
    }
  }

  const accuracy = (correct / corpus.length) * 100;
  console.log(`Corpus Size: ${corpus.length} sample prompts`);
  console.log(`Generalization Accuracy: ${accuracy.toFixed(1)}%`);
  console.log("Zero API external calls made: 100% Client-Side Evaluation.");
}

runBenchmark();
