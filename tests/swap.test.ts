import * as anchor from "@anchor-lang/core";
import { Program, BN } from "@anchor-lang/core";
import { RaydiumCpSwap } from "../target/types/raydium_cp_swap";
import {
  setupSwapTest,
  swap_base_input,
  swap_base_output,
  getPoolVaultAddress,
  advancePastPoolOpenTime,
} from "./utils";
import { assert } from "chai";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

describe("swap test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;

  const program = anchor.workspace.RaydiumCpSwap as Program<RaydiumCpSwap>;

  const confirmOptions = {
    skipPreflight: true,
  };

  it("swap base input without transfer fee", async () => {
    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 0,
        tradeFeeRate: new BN(10),
        protocolFeeRate: new BN(1000),
        fundFeeRate: new BN(25000),
        create_fee: new BN(0),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 }
    );
    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const inputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      inputTokenAccountAddr,
      "processed",
      inputTokenProgram
    );
    await advancePastPoolOpenTime(anchor.getProvider().connection);
    let amount_in = new BN(100000000);
    await swap_base_input(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      poolState.token1Mint,
      poolState.token1Program,
      amount_in,
      new BN(0)
    );
    const inputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      inputTokenAccountAddr,
      "processed",
      inputTokenProgram
    );
    assert.equal(
      inputTokenAccountBefore.amount - inputTokenAccountAfter.amount,
      BigInt(amount_in.toString())
    );
  });

  it("swap base output without transfer fee", async () => {
    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 0,
        tradeFeeRate: new BN(10),
        protocolFeeRate: new BN(1000),
        fundFeeRate: new BN(25000),
        create_fee: new BN(0),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 }
    );
    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const outputToken = poolState.token1Mint;
    const outputTokenProgram = poolState.token1Program;
    const outputTokenAccountAddr = getAssociatedTokenAddressSync(
      outputToken,
      owner.publicKey,
      false,
      outputTokenProgram
    );
    const outputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    await advancePastPoolOpenTime(anchor.getProvider().connection);
    let amount_out = new BN(100000000);
    await swap_base_output(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      poolState.token1Mint,
      poolState.token1Program,
      amount_out,
      new BN(10000000000000),
      confirmOptions
    );
    const outputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    assert.equal(
      outputTokenAccountAfter.amount - outputTokenAccountBefore.amount,
      BigInt(amount_out.toString())
    );
  });

  it("swap base output with transfer fee", async () => {
    const transferFeeConfig = { transferFeeBasisPoints: 5, MaxFee: 5000 }; // %5
    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 0,
        tradeFeeRate: new BN(10),
        protocolFeeRate: new BN(1000),
        fundFeeRate: new BN(25000),
        create_fee: new BN(0),
      },
      transferFeeConfig
    );

    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const outputToken = poolState.token1Mint;
    const outputTokenProgram = poolState.token1Program;
    const outputTokenAccountAddr = getAssociatedTokenAddressSync(
      outputToken,
      owner.publicKey,
      false,
      outputTokenProgram
    );
    const outputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    await advancePastPoolOpenTime(anchor.getProvider().connection);
    let amount_out = new BN(100000000);
    await swap_base_output(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      poolState.token1Mint,
      poolState.token1Program,
      amount_out,
      new BN(10000000000000),
      confirmOptions
    );
    const outputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );
    assert.equal(
      outputTokenAccountAfter.amount - outputTokenAccountBefore.amount,
      BigInt(amount_out.toString())
    );
  });
});

describe("zero fees test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;

  const program = anchor.workspace.RaydiumCpSwap as Program<RaydiumCpSwap>;

  const confirmOptions = {
    skipPreflight: true,
  };

  // creating a new amm config (needed here for zero fee rates) gates its
  // signer on crate::admin::ID — a production key on a stock build.
  // `yarn test:local-admin` builds with `--features localnet` and compiles
  // the local wallet in as admin so these cases can sign as admin;
  // otherwise they are skipped.
  const adminIsLocalWallet =
    process.env.CPSWAP_LOCALNET_ADMIN === owner.publicKey.toBase58();

  it("swap base input with zero fees transfers the full amount and accrues no fees", async function () {
    if (!adminIsLocalWallet) this.skip();

    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 100,
        tradeFeeRate: new BN(0),
        protocolFeeRate: new BN(0),
        fundFeeRate: new BN(0),
        create_fee: new BN(0),
        creatorFeeRate: new BN(0),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 }
    );
    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const outputToken = poolState.token1Mint;
    const outputTokenProgram = poolState.token1Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const outputTokenAccountAddr = getAssociatedTokenAddressSync(
      outputToken,
      owner.publicKey,
      false,
      outputTokenProgram
    );
    const inputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      inputTokenAccountAddr,
      "processed",
      inputTokenProgram
    );
    const outputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );

    const [inputVaultAddr] = await getPoolVaultAddress(
      poolAddress,
      inputToken,
      program.programId
    );
    const [outputVaultAddr] = await getPoolVaultAddress(
      poolAddress,
      outputToken,
      program.programId
    );
    const inputVaultBefore = await getAccount(
      anchor.getProvider().connection,
      inputVaultAddr,
      "processed",
      inputTokenProgram
    );
    const outputVaultBefore = await getAccount(
      anchor.getProvider().connection,
      outputVaultAddr,
      "processed",
      outputTokenProgram
    );

    await advancePastPoolOpenTime(anchor.getProvider().connection);
    const amount_in = new BN(100000000);
    await swap_base_input(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      outputToken,
      outputTokenProgram,
      amount_in,
      new BN(0),
      confirmOptions
    );

    const inputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      inputTokenAccountAddr,
      "processed",
      inputTokenProgram
    );
    const outputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );

    // the whole input amount leaves the user's account: no trade/creator fee withheld
    assert.equal(
      inputTokenAccountBefore.amount - inputTokenAccountAfter.amount,
      BigInt(amount_in.toString())
    );

    // constant-product output with zero fees: dy = (dx * y) / (x + dx)
    const vault0 = new BN(inputVaultBefore.amount.toString());
    const vault1 = new BN(outputVaultBefore.amount.toString());
    const expectedOut = amount_in.mul(vault1).div(vault0.add(amount_in));
    assert.equal(
      outputTokenAccountAfter.amount - outputTokenAccountBefore.amount,
      BigInt(expectedOut.toString())
    );

    const poolStateAfter = await program.account.poolState.fetch(poolAddress);
    assert.equal(poolStateAfter.protocolFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.protocolFeesToken1.toString(), "0");
    assert.equal(poolStateAfter.fundFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.fundFeesToken1.toString(), "0");
    assert.equal(poolStateAfter.creatorFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.creatorFeesToken1.toString(), "0");
  });

  it("swap base output with zero fees transfers exactly the requested output and accrues no fees", async function () {
    if (!adminIsLocalWallet) this.skip();

    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 101,
        tradeFeeRate: new BN(0),
        protocolFeeRate: new BN(0),
        fundFeeRate: new BN(0),
        create_fee: new BN(0),
        creatorFeeRate: new BN(0),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 }
    );
    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const outputToken = poolState.token1Mint;
    const outputTokenProgram = poolState.token1Program;
    const outputTokenAccountAddr = getAssociatedTokenAddressSync(
      outputToken,
      owner.publicKey,
      false,
      outputTokenProgram
    );
    const outputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );

    await advancePastPoolOpenTime(anchor.getProvider().connection);
    const amount_out = new BN(100000000);
    await swap_base_output(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      outputToken,
      outputTokenProgram,
      amount_out,
      new BN(10000000000000),
      confirmOptions
    );

    const outputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      outputTokenAccountAddr,
      "processed",
      outputTokenProgram
    );

    // requested output amount is delivered exactly, with no creator fee added on top
    assert.equal(
      outputTokenAccountAfter.amount - outputTokenAccountBefore.amount,
      BigInt(amount_out.toString())
    );

    const poolStateAfter = await program.account.poolState.fetch(poolAddress);
    assert.equal(poolStateAfter.protocolFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.protocolFeesToken1.toString(), "0");
    assert.equal(poolStateAfter.fundFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.fundFeesToken1.toString(), "0");
    assert.equal(poolStateAfter.creatorFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.creatorFeesToken1.toString(), "0");
  });

  it("supports a configured creator fee rate on a pool where creator fees are disabled", async function () {
    if (!adminIsLocalWallet) this.skip();

    // pools initialize with enable_creator_fee = false, which forces the
    // effective creator_fee_rate to 0 (see adjust_creator_fee_rate) regardless
    // of the ammConfig's creatorFeeRate. This is the same all-zero-rate,
    // creator-fee-on-input path that used to divide by zero in
    // split_creator_fee before the fix.
    const { configAddress, poolAddress, poolState } = await setupSwapTest(
      program,
      anchor.getProvider().connection,
      owner,
      {
        config_index: 102,
        tradeFeeRate: new BN(0),
        protocolFeeRate: new BN(0),
        fundFeeRate: new BN(0),
        create_fee: new BN(0),
        creatorFeeRate: new BN(2500),
      },
      { transferFeeBasisPoints: 0, MaxFee: 0 }
    );
    const inputToken = poolState.token0Mint;
    const inputTokenProgram = poolState.token0Program;
    const outputToken = poolState.token1Mint;
    const outputTokenProgram = poolState.token1Program;
    const inputTokenAccountAddr = getAssociatedTokenAddressSync(
      inputToken,
      owner.publicKey,
      false,
      inputTokenProgram
    );
    const inputTokenAccountBefore = await getAccount(
      anchor.getProvider().connection,
      inputTokenAccountAddr,
      "processed",
      inputTokenProgram
    );

    await advancePastPoolOpenTime(anchor.getProvider().connection);
    const amount_in = new BN(100000000);
    await swap_base_input(
      program,
      owner,
      configAddress,
      inputToken,
      inputTokenProgram,
      outputToken,
      outputTokenProgram,
      amount_in,
      new BN(0),
      confirmOptions
    );

    const inputTokenAccountAfter = await getAccount(
      anchor.getProvider().connection,
      inputTokenAccountAddr,
      "processed",
      inputTokenProgram
    );
    assert.equal(
      inputTokenAccountBefore.amount - inputTokenAccountAfter.amount,
      BigInt(amount_in.toString())
    );

    const poolStateAfter = await program.account.poolState.fetch(poolAddress);
    assert.equal(poolStateAfter.protocolFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.protocolFeesToken1.toString(), "0");
    assert.equal(poolStateAfter.fundFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.fundFeesToken1.toString(), "0");
    assert.equal(poolStateAfter.creatorFeesToken0.toString(), "0");
    assert.equal(poolStateAfter.creatorFeesToken1.toString(), "0");
  });
});
