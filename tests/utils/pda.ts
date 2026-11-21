import { PublicKey } from "@solana/web3.js";
import idl from "../../target/idl/raydium_cp_swap.json";

function idlSeed(name: string): Buffer {
  const constant = idl.constants.find((c) => c.name === name);
  if (!constant) {
    throw new Error(`Seed constant ${name} not found in IDL`);
  }
  // `&[u8]` constants are serialized as "[1, 2, ...]", `&str` as "\"...\""
  const value: number[] | string = JSON.parse(constant.value);
  return Buffer.from(value);
}

export const POOL_SEED = idlSeed("POOL_SEED");
export const POOL_VAULT_SEED = idlSeed("POOL_VAULT_SEED");
export const POOL_AUTH_SEED = idlSeed("AUTH_SEED");
export const ORACLE_SEED = idlSeed("OBSERVATION_SEED");

export function getAuthAddress(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([POOL_AUTH_SEED], programId);
}

/** The program's single pool. */
export function getPoolAddress(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([POOL_SEED], programId);
}

export function getPoolVaultAddress(
  pool: PublicKey,
  vaultTokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POOL_VAULT_SEED, pool.toBuffer(), vaultTokenMint.toBuffer()],
    programId
  );
}

export function getOracleAccountAddress(
  pool: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORACLE_SEED, pool.toBuffer()],
    programId
  );
}
