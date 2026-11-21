import * as anchor from "@anchor-lang/core";
import { Program, BN, web3 } from "@anchor-lang/core";
import { RaydiumCpSwap } from "../target/types/raydium_cp_swap";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assert } from "chai";
import {
  createTokenMintAndAssociatedTokenAccount,
  getOracleAccountAddress,
  getPoolAddress,
  initialize,
  sendTransaction,
  swap_base_input,
  swap_base_output,
} from "./utils";

// The program holds exactly one pool, so this suite is ordered: the pool is
// created once and every later case swaps against it.
describe("single fee-less pool", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const connection = anchor.getProvider().connection;
  const owner = anchor.Wallet.local().payer; // the localnet admin
  const program = anchor.workspace.RaydiumCpSwap as Program<RaydiumCpSwap>;
  const [poolAddress] = getPoolAddress(program.programId);

  const initAmount0 = new BN(10_000_000_000);
  const initAmount1 = new BN(20_000_000_000);

  let token0: PublicKey;
  let token0Program: PublicKey;
  let token1: PublicKey;
  let token1Program: PublicKey;

  async function expectError(
    promise: Promise<unknown>,
    needle: string | RegExp
  ) {
    try {
      await promise;
    } catch (e: any) {
      const text = `${e}\n${(e.logs ?? []).join("\n")}`;
      if (typeof needle === "string") {
        assert.include(text, needle, `expected error containing "${needle}"`);
      } else {
        assert.match(text, needle);
      }
      return;
    }
    assert.fail(`expected the transaction to fail with "${needle}"`);
  }

  async function balance(address: PublicKey, tokenProgram: PublicKey) {
    return (await getAccount(connection, address, "processed", tokenProgram))
      .amount;
  }

  function userAta(mint: PublicKey, tokenProgram: PublicKey) {
    return getAssociatedTokenAddressSync(
      mint,
      owner.publicKey,
      false,
      tokenProgram
    );
  }

  async function snapshot() {
    const pool = await program.account.poolState.fetch(poolAddress);
    return {
      vault0: await balance(pool.token0Vault, token0Program),
      vault1: await balance(pool.token1Vault, token1Program),
      user0: await balance(userAta(token0, token0Program), token0Program),
      user1: await balance(userAta(token1, token1Program), token1Program),
    };
  }

  // Clock sysvar layout: slot, epoch_start_timestamp, epoch,
  // leader_schedule_epoch, unix_timestamp (i64 at offset 32).
  async function clockUnixTimestamp() {
    const info = await connection.getAccountInfo(
      web3.SYSVAR_CLOCK_PUBKEY,
      "processed"
    );
    return info!.data.readBigInt64LE(32);
  }

  before(async () => {
    // one legacy SPL mint and one plain Token-2022 mint
    [{ token0, token0Program }, { token1, token1Program }] =
      await createTokenMintAndAssociatedTokenAccount(
        connection,
        owner,
        new Keypair(),
        null
      );
  });

  it("rejects mints with a transfer fee", async () => {
    const [
      { token0: t0, token0Program: p0 },
      { token1: t1, token1Program: p1 },
    ] = await createTokenMintAndAssociatedTokenAccount(
      connection,
      owner,
      new Keypair(),
      // even a 0% transfer fee is rejected: its authority could raise it later
      { transferFeeBasisPoints: 0, MaxFee: 0 }
    );
    await expectError(
      initialize(program, owner, t0, p0, t1, p1, { initAmount0, initAmount1 }),
      "NotSupportMint"
    );
  });

  it("rejects initialize from a non-admin", async () => {
    const stranger = Keypair.generate();
    await sendTransaction(
      connection,
      [
        web3.SystemProgram.transfer({
          fromPubkey: owner.publicKey,
          toPubkey: stranger.publicKey,
          lamports: web3.LAMPORTS_PER_SOL,
        }),
      ],
      [owner]
    );

    await expectError(
      initialize(
        program,
        stranger,
        token0,
        token0Program,
        token1,
        token1Program,
        { initAmount0, initAmount1 },
        undefined,
        owner.publicKey
      ),
      "ConstraintAddress"
    );
  });

  it("admin creates the pool with permanent liquidity", async () => {
    const { poolState } = await initialize(
      program,
      owner,
      token0,
      token0Program,
      token1,
      token1Program,
      { initAmount0, initAmount1 }
    );

    assert(poolState.token0Mint.equals(token0));
    assert(poolState.token1Mint.equals(token1));
    assert(
      poolState.observationKey.equals(
        getOracleAccountAddress(poolAddress, program.programId)[0]
      )
    );

    const { vault0, vault1 } = await snapshot();
    assert.equal(vault0.toString(), initAmount0.toString());
    assert.equal(vault1.toString(), initAmount1.toString());
  });

  it("cannot create a second pool", async () => {
    const [
      { token0: t0, token0Program: p0 },
      { token1: t1, token1Program: p1 },
    ] = await createTokenMintAndAssociatedTokenAccount(
      connection,
      owner,
      new Keypair(),
      null
    );
    await expectError(
      initialize(program, owner, t0, p0, t1, p1, { initAmount0, initAmount1 }),
      "already in use"
    );
  });

  for (const zeroForOne of [true, false]) {
    it(`swap base input ${
      zeroForOne ? "0 -> 1" : "1 -> 0"
    } charges no pool fee`, async () => {
      const [inMint, inProgram, outMint, outProgram] = zeroForOne
        ? [token0, token0Program, token1, token1Program]
        : [token1, token1Program, token0, token0Program];
      const before = await snapshot();
      const [x, y] = zeroForOne
        ? [before.vault0, before.vault1]
        : [before.vault1, before.vault0];

      const amountIn = 100_000_000n;
      const out = (amountIn * y) / (x + amountIn); // pure x*y=k, no fee

      await swap_base_input(
        program,
        owner,
        inMint,
        inProgram,
        outMint,
        outProgram,
        new BN(amountIn.toString()),
        new BN(out.toString())
      );

      const after = await snapshot();
      const [xAfter, yAfter] = zeroForOne
        ? [after.vault0, after.vault1]
        : [after.vault1, after.vault0];
      const [userInDelta, userOutDelta] = zeroForOne
        ? [before.user0 - after.user0, after.user1 - before.user1]
        : [before.user1 - after.user1, after.user0 - before.user0];

      assert.equal(userInDelta, amountIn);
      assert.equal(userOutDelta, out);
      assert.equal(xAfter - x, amountIn, "the whole input lands in the vault");
      assert.equal(y - yAfter, out);
      assert(xAfter * yAfter >= x * y, "k must not decrease");
    });
  }

  for (const zeroForOne of [true, false]) {
    it(`swap base output ${
      zeroForOne ? "0 -> 1" : "1 -> 0"
    } charges no pool fee`, async () => {
      const [inMint, inProgram, outMint, outProgram] = zeroForOne
        ? [token0, token0Program, token1, token1Program]
        : [token1, token1Program, token0, token0Program];
      const before = await snapshot();
      const [x, y] = zeroForOne
        ? [before.vault0, before.vault1]
        : [before.vault1, before.vault0];

      const amountOut = 50_000_000n;
      await swap_base_output(
        program,
        owner,
        inMint,
        inProgram,
        outMint,
        outProgram,
        new BN(amountOut.toString()),
        new BN("100000000000")
      );

      const after = await snapshot();
      const [xAfter, yAfter] = zeroForOne
        ? [after.vault0, after.vault1]
        : [after.vault1, after.vault0];
      const [userPaid, userReceived] = zeroForOne
        ? [before.user0 - after.user0, after.user1 - before.user1]
        : [before.user1 - after.user1, after.user0 - before.user0];

      // pure x*y=k, rounded up in the pool's favor
      const numerator = x * amountOut;
      const denominator = y - amountOut;
      const expectedIn = (numerator + denominator - 1n) / denominator;
      assert.equal(userReceived, amountOut);
      assert.equal(userPaid, expectedIn);
      assert.equal(y - yAfter, amountOut);
      assert.equal(xAfter - x, expectedIn);
      assert(xAfter * yAfter >= x * y, "k must not decrease");
    });
  }

  it("records swaps in the oracle", async () => {
    const [observationAddress] = getOracleAccountAddress(
      poolAddress,
      program.programId
    );
    const fetchOracle = () =>
      program.account.observationState.fetch(observationAddress, "processed");
    const latest = (o: Awaited<ReturnType<typeof fetchOracle>>) =>
      o.observations[o.observationIndex];

    const before = await fetchOracle();
    assert.isTrue(before.initialized);
    assert(before.poolId.equals(poolAddress));
    assert(
      !latest(before).blockTimestamp.isZero(),
      "the latest observation must carry a timestamp"
    );

    // The oracle ignores updates within the same second, so wait for the
    // cluster clock to move past the last update before swapping.
    const lastUpdate = BigInt(before.lastUpdateTimestamp.toString());
    while ((await clockUnixTimestamp()) <= lastUpdate) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const { vault0, vault1 } = await snapshot();
    await swap_base_input(
      program,
      owner,
      token0,
      token0Program,
      token1,
      token1Program,
      new BN(1_000_000),
      new BN(0)
    );
    const after = await fetchOracle();

    const elapsed =
      BigInt(after.lastUpdateTimestamp.toString()) - lastUpdate;
    assert(elapsed > 0n, "lastUpdateTimestamp must advance");
    assert(
      BigInt(latest(after).blockTimestamp.toString()) >=
        BigInt(latest(before).blockTimestamp.toString())
    );

    // cumulative += pre-swap price (Q32.32) * seconds elapsed
    const Q32 = 1n << 32n;
    const price0 = (vault1 * Q32) / vault0;
    const price1 = (vault0 * Q32) / vault1;
    const cum = (o: Awaited<ReturnType<typeof fetchOracle>>) => [
      BigInt(latest(o).cumulativeToken0PriceX32.toString()),
      BigInt(latest(o).cumulativeToken1PriceX32.toString()),
    ];
    const [c0Before, c1Before] = cum(before);
    const [c0After, c1After] = cum(after);
    assert.equal(c0After - c0Before, price0 * elapsed);
    assert.equal(c1After - c1Before, price1 * elapsed);
  });

  it("enforces slippage limits", async () => {
    await expectError(
      swap_base_input(
        program,
        owner,
        token0,
        token0Program,
        token1,
        token1Program,
        new BN(100_000_000),
        new BN("100000000000")
      ),
      "ExceededSlippage"
    );
    await expectError(
      swap_base_output(
        program,
        owner,
        token0,
        token0Program,
        token1,
        token1Program,
        new BN(50_000_000),
        new BN(1)
      ),
      "ExceededSlippage"
    );
  });

  it("rejects swapping a token for itself", async () => {
    await expectError(
      swap_base_input(
        program,
        owner,
        token0,
        token0Program,
        token0,
        token0Program,
        new BN(100_000_000),
        new BN(0)
      ),
      // Anchor's duplicate-mutable-account check usually fires before the
      // program's own InvalidVault check; either rejection is fine.
      /InvalidVault|ConstraintDuplicateMutableAccount/
    );
  });

  it("cannot drain the output vault", async () => {
    const { vault1 } = await snapshot();
    await expectError(
      swap_base_output(
        program,
        owner,
        token0,
        token0Program,
        token1,
        token1Program,
        new BN(vault1.toString()),
        new BN("18446744073709551615")
      ),
      "ZeroTradingTokens"
    );
  });
});
