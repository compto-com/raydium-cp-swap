import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const UPGRADEABLE_LOADER = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

async function rpcCall(endpoint: string, method: string, params: any[]) {
  const response = await (globalThis as any).fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

// The surfnet started by `anchor test` ships the bundled legacy token program
// build, while mainnet runs the p-token redeployment (which, unlike the
// bundled build, supports WithdrawExcessLamports). Replace the local token
// program with the live mainnet deployment via the surfnet_setAccount
// cheatcode so legacy-token behavior matches mainnet.
// Returns false (so the caller skips the legacy-token cases) when the local
// validator is not a surfnet, or when the mainnet deployment cannot be
// fetched — a network blip must not fail the whole suite.
export async function ensureMainnetTokenProgram(
  connection: Connection
): Promise<boolean> {
  try {
    const version = await rpcCall(connection.rpcEndpoint, "getVersion", []);
    if (version["surfnet-version"] === undefined) {
      return false;
    }

    const local = await connection.getAccountInfo(TOKEN_PROGRAM_ID);
    if (local === null) {
      throw new Error("local token program account does not exist");
    }
    if (local.owner.equals(UPGRADEABLE_LOADER)) {
      // mainnet deployment already installed
      return true;
    }

    const [programdataAddress] = PublicKey.findProgramAddressSync(
      [TOKEN_PROGRAM_ID.toBuffer()],
      UPGRADEABLE_LOADER
    );
    const mainnet = new Connection(MAINNET_RPC);
    const [programAccount, programdataAccount] =
      await mainnet.getMultipleAccountsInfo([
        TOKEN_PROGRAM_ID,
        programdataAddress,
      ]);

    if (programAccount === null || programdataAccount === null) {
      throw new Error("failed to fetch mainnet token program accounts");
    }

    // install programdata first so the program account never points at nothing
    for (const [address, account] of [
      [programdataAddress, programdataAccount],
      [TOKEN_PROGRAM_ID, programAccount],
    ] as const) {
      await rpcCall(connection.rpcEndpoint, "surfnet_setAccount", [
        address.toBase58(),
        {
          lamports: account.lamports,
          data: account.data.toString("hex"),
          owner: account.owner.toBase58(),
          executable: account.executable,
          rent_epoch: 0,
        },
      ]);
    }
    return true;
  } catch (err) {
    console.warn(
      "ensureMainnetTokenProgram: could not install mainnet token program, " +
        "skipping legacy-token cases:",
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

// Clock sysvar layout: slot(u64), epoch_start_timestamp(i64),
// epoch(u64), leader_schedule_epoch(u64), unix_timestamp(i64).
async function getOnChainUnixTimestamp(
  connection: Connection
): Promise<bigint> {
  const info = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  if (info === null) {
    throw new Error("clock sysvar account does not exist");
  }
  return info.data.readBigInt64LE(8 + 8 + 8 + 8);
}

// Pool `open_time` is bumped to at least the on-chain clock's unix_timestamp
// at pool-init time + 1 (see initialize.rs), and swaps are rejected with
// NotApproved until the on-chain clock passes that value. `anchor test`
// runs surfpool ("surfnet"), whose clock does not reliably advance with
// real/wall-clock time the way solana-test-validator's does, so sleeping a
// fixed duration and hoping the clock caught up is flaky. When running on
// a surfnet, warp the clock forward directly via the surfnet_timeTravel
// cheatcode; otherwise fall back to a short sleep for a real validator.
export async function advancePastPoolOpenTime(
  connection: Connection
): Promise<void> {
  const version = await rpcCall(connection.rpcEndpoint, "getVersion", []);
  if (version["surfnet-version"] === undefined) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return;
  }

  const currentUnixTimestamp = await getOnChainUnixTimestamp(connection);
  await rpcCall(connection.rpcEndpoint, "surfnet_timeTravel", [
    { absoluteTimestamp: Number(currentUnixTimestamp + 2n) * 1000 },
  ]);
}
