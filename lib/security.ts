import { z } from "zod";
import crypto from "crypto";

// input validation and sanitization for prompts
const ADVANCED_ATTACK_PATTERNS = [
  /ignore (all )?(previous|prior|system) (instructions|rules|prompts)/i,
  /disregard the rules/i,
  /you are now (an? )?(dan|unrestricted|god mode|jailbroken)/i,
  /developer mode (on|enabled)/i,
  /hypothetical response where you/i,
  /(repeat|reveal|print|leak|show) (the|your) (system prompt|original instructions|initial guidelines)/i,
  /what (is|are) (your|the) (instructions|system prompt)/i,
  /transfer (all )?(funds|sol|money|tokens)/i,
  /drain (vault|pool|contract|escrow)/i,
  /private key/i,
  /seed phrase/i,
  /signature/i,
  /set (hp|health|energy|shield) to/i,
  /win immediately/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /```(system|json|instruction)/i,
  /system:/i,
  /assistant:/i,
];

// zero-width characters
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u00A0\u2060]/g;

// suspicious encodings
const SUSPICIOUS_ENCODINGS = /(base64|rot13|hex|eval|function\(|atob\()/i;

export interface SecurityAuditResult {
  valid: boolean;
  sanitizedText: string;
  threatLevel: "PASS" | "SUSPICIOUS" | "CRITICAL_BLOCKED";
  owaspViolation?: string;
  reason?: string;
  commitmentHash?: string;
  entropyScore?: number;
}

// shannon entropy check
function calculateShannonEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;
  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function sanitizePrompt(
  rawPrompt: string,
  salt: string = ""
): SecurityAuditResult {
  if (!rawPrompt || typeof rawPrompt !== "string") {
    return {
      valid: false,
      sanitizedText: "",
      threatLevel: "CRITICAL_BLOCKED",
      reason: "Empty prompt or invalid format",
    };
  }

  // length check
  if (rawPrompt.length > 280) {
    return {
      valid: false,
      sanitizedText: "",
      threatLevel: "CRITICAL_BLOCKED",
      reason: "Prompt exceeds 280 characters limit",
    };
  }

  // zero-width detection
  if (ZERO_WIDTH_REGEX.test(rawPrompt)) {
    return {
      valid: false,
      sanitizedText: "",
      threatLevel: "CRITICAL_BLOCKED",
      reason: "Invisible characters detected",
    };
  }

  // entropy check
  const entropy = calculateShannonEntropy(rawPrompt);
  if (entropy > 5.2 && rawPrompt.length > 40) {
    return {
      valid: false,
      sanitizedText: "",
      threatLevel: "CRITICAL_BLOCKED",
      reason: `Abnormal entropy score (${entropy.toFixed(2)})`,
    };
  }

  // suspicious encodings
  if (SUSPICIOUS_ENCODINGS.test(rawPrompt)) {
    return {
      valid: false,
      sanitizedText: "",
      threatLevel: "CRITICAL_BLOCKED",
      reason: "Suspicious execution pattern or encoding",
    };
  }

  // check known jailbreaks
  for (const pattern of ADVANCED_ATTACK_PATTERNS) {
    if (pattern.test(rawPrompt)) {
      return {
        valid: false,
        sanitizedText: "",
        threatLevel: "CRITICAL_BLOCKED",
        reason: "Security policy trigger",
      };
    }
  }

  // unicode normalization
  const normalized = rawPrompt.normalize("NFKC");

  // sanitize delimiters
  const sanitized = normalized
    .replace(/[<>{}[\]\\]/g, "")
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .trim();

  // hash commitment
  const commitmentHash = crypto
    .createHmac("sha256", "SOLAGENT_PROMPT_SALT_2026")
    .update(`${sanitized}:${salt}`)
    .digest("hex");

  return {
    valid: true,
    sanitizedText: sanitized,
    threatLevel: "PASS",
    commitmentHash,
    entropyScore: entropy,
  };
}


export const TurnActionSchema = z.object({
  action: z.enum(["ATTACK", "DEFEND", "STAKE_SHIELD", "LIQUIDATE_BURST"]),
  rationale: z.string().max(100),
  taunt: z.string().max(80),
  confidenceScore: z.number().int().min(0).max(100),
});

export type TurnAction = z.infer<typeof TurnActionSchema>;

export function secureHashCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
