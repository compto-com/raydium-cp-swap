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

export const AMM_CONFIG_SEED = idlSeed("AMM_CONFIG_SEED");
export const POOL_SEED = idlSeed("POOL_SEED");
export const POOL_VAULT_SEED = idlSeed("POOL_VAULT_SEED");
export const POOL_AUTH_SEED = idlSeed("AUTH_SEED");
export const POOL_LPMINT_SEED = idlSeed("POOL_LP_MINT_SEED");
export const ORACLE_SEED = idlSeed("OBSERVATION_SEED");

export function u16ToBytes(num: number) {
  const arr = new ArrayBuffer(2);
  const view = new DataView(arr);
  view.setUint16(0, num, false);
  return new Uint8Array(arr);
}

export function i16ToBytes(num: number) {
  const arr = new ArrayBuffer(2);
  const view = new DataView(arr);
  view.setInt16(0, num, false);
  return new Uint8Array(arr);
}

export function u32ToBytes(num: number) {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setUint32(0, num, false);
  return new Uint8Array(arr);
}

export function i32ToBytes(num: number) {
  const arr = new ArrayBuffer(4);
  const view = new DataView(arr);
  view.setInt32(0, num, false);
  return new Uint8Array(arr);
}

export function getAmmConfigAddress(
  index: number,
  programId: PublicKey
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [AMM_CONFIG_SEED, u16ToBytes(index)],
    programId
  );
  return [address, bump];
}

export function getAuthAddress(programId: PublicKey): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_AUTH_SEED],
    programId
  );
  return [address, bump];
}

export function getPoolAddress(
  ammConfig: PublicKey,
  tokenMint0: PublicKey,
  tokenMint1: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [
      POOL_SEED,
      ammConfig.toBuffer(),
      tokenMint0.toBuffer(),
      tokenMint1.toBuffer(),
    ],
    programId
  );
  return [address, bump];
}

export function getPoolVaultAddress(
  pool: PublicKey,
  vaultTokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_VAULT_SEED, pool.toBuffer(), vaultTokenMint.toBuffer()],
    programId
  );
  return [address, bump];
}

export function getPoolLpMintAddress(
  pool: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_LPMINT_SEED, pool.toBuffer()],
    programId
  );
  return [address, bump];
}

export function getOrcleAccountAddress(
  pool: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [ORACLE_SEED, pool.toBuffer()],
    programId
  );
  return [address, bump];
}
