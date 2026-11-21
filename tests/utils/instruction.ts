import { Program, BN } from "@anchor-lang/core";
import { RaydiumCpSwap } from "../../target/types/raydium_cp_swap";
import {
  ConfirmOptions,
  PublicKey,
  Signer,
  SystemProgram,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  getAuthAddress,
  getPoolAddress,
  getPoolVaultAddress,
  getOracleAccountAddress,
} from "./index";

export async function initialize(
  program: Program<RaydiumCpSwap>,
  creator: Signer,
  token0: PublicKey,
  token0Program: PublicKey,
  token1: PublicKey,
  token1Program: PublicKey,
  initAmount: { initAmount0: BN; initAmount1: BN },
  confirmOptions?: ConfirmOptions,
  // token accounts the creator funds the pool from; default to the creator's ATAs
  sourceTokenOwner: PublicKey = creator.publicKey
) {
  const [auth] = getAuthAddress(program.programId);
  const [poolAddress] = getPoolAddress(program.programId);
  const [vault0] = getPoolVaultAddress(poolAddress, token0, program.programId);
  const [vault1] = getPoolVaultAddress(poolAddress, token1, program.programId);
  const [observationAddress] = getOracleAccountAddress(
    poolAddress,
    program.programId
  );

  await program.methods
    .initialize(initAmount.initAmount0, initAmount.initAmount1)
    .accountsPartial({
      creator: creator.publicKey,
      authority: auth,
      poolState: poolAddress,
      token0Mint: token0,
      token1Mint: token1,
      creatorToken0: getAssociatedTokenAddressSync(
        token0,
        sourceTokenOwner,
        false,
        token0Program
      ),
      creatorToken1: getAssociatedTokenAddressSync(
        token1,
        sourceTokenOwner,
        false,
        token1Program
      ),
      token0Vault: vault0,
      token1Vault: vault1,
      observationState: observationAddress,
      token0Program,
      token1Program,
      systemProgram: SystemProgram.programId,
    })
    .signers([creator])
    .rpc(confirmOptions);
  const poolState = await program.account.poolState.fetch(poolAddress);
  return { poolAddress, poolState };
}

function swapAccounts(
  program: Program<RaydiumCpSwap>,
  owner: Signer,
  inputToken: PublicKey,
  inputTokenProgram: PublicKey,
  outputToken: PublicKey,
  outputTokenProgram: PublicKey
) {
  const [auth] = getAuthAddress(program.programId);
  const [poolAddress] = getPoolAddress(program.programId);
  const [observationAddress] = getOracleAccountAddress(
    poolAddress,
    program.programId
  );
  return {
    payer: owner.publicKey,
    authority: auth,
    poolState: poolAddress,
    inputTokenAccount: getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    ),
    outputTokenAccount: getAssociatedTokenAddressSync(
      outputToken,
      owner.publicKey,
      false,
      outputTokenProgram
    ),
    inputVault: getPoolVaultAddress(poolAddress, inputToken, program.programId)[0],
    outputVault: getPoolVaultAddress(
      poolAddress,
      outputToken,
      program.programId
    )[0],
    inputTokenProgram,
    outputTokenProgram,
    inputTokenMint: inputToken,
    outputTokenMint: outputToken,
    observationState: observationAddress,
  };
}

export async function swap_base_input(
  program: Program<RaydiumCpSwap>,
  owner: Signer,
  inputToken: PublicKey,
  inputTokenProgram: PublicKey,
  outputToken: PublicKey,
  outputTokenProgram: PublicKey,
  amount_in: BN,
  minimum_amount_out: BN,
  confirmOptions?: ConfirmOptions
) {
  return program.methods
    .swapBaseInput(amount_in, minimum_amount_out)
    .accountsPartial(
      swapAccounts(
        program,
        owner,
        inputToken,
        inputTokenProgram,
        outputToken,
        outputTokenProgram
      )
    )
    .signers([owner])
    .rpc(confirmOptions);
}

export async function swap_base_output(
  program: Program<RaydiumCpSwap>,
  owner: Signer,
  inputToken: PublicKey,
  inputTokenProgram: PublicKey,
  outputToken: PublicKey,
  outputTokenProgram: PublicKey,
  amount_out: BN,
  max_amount_in: BN,
  confirmOptions?: ConfirmOptions
) {
  return program.methods
    .swapBaseOutput(max_amount_in, amount_out)
    .accountsPartial(
      swapAccounts(
        program,
        owner,
        inputToken,
        inputTokenProgram,
        outputToken,
        outputTokenProgram
      )
    )
    .signers([owner])
    .rpc(confirmOptions);
}
