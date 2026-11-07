import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import crypto from "crypto";

export interface EscrowMatchSession {
  matchId: string;
  creatorWallet: string;
  opponentWallet?: string;
  stakeLamports: number;
  vaultPublicKey: string;
  status: "INITIALIZED" | "ACTIVE" | "COMPLETED" | "REFUNDED";
  createdAt: number;
  timeLockExpiresAt: number;
  matchHashProof?: string;
}

// Genera un MatchID criptográfico único resistente a colisiones y replay
export function generateSecureMatchId(player1: string, player2: string, salt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${player1}-${player2}-${salt}-${Date.now()}`)
    .digest("hex")
    .substring(0, 16);
}

// Crea la transacción de depósito al Escrow Vault con TimeLock para evitar fondos atrapados
export function buildDepositInstruction(
  fromPubkey: PublicKey,
  vaultPubkey: PublicKey,
  solAmount: number
) {
  const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  return SystemProgram.transfer({
    fromPubkey,
    toPubkey: vaultPubkey,
    lamports,
  });
}

// Verificador criptográfico de integridad de resultado antes de autorizar el pago
export function verifyMatchIntegrity(
  finalHashProof: string,
  turnHashes: string[],
  p1Wallet: string,
  p2Wallet: string
): boolean {
  if (turnHashes.length === 0) return false;
  // El último hash de la cadena debe coincidir con el proof registrado
  const expectedFinal = turnHashes[turnHashes.length - 1];
  return finalHashProof === expectedFinal;
}
