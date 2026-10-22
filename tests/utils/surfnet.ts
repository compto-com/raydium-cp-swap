import { Connection, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";

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

// Surfpool >= 1.6.0 bundles the p-token build of the legacy token program,
// which (unlike older bundled builds) supports WithdrawExcessLamports and
// UnwrapLamports. Returns false (so the caller skips the legacy-token cases)
// when the local validator is not a surfnet or is older than that.
const MIN_SURFNET_VERSION = [1, 6, 0];

export async function ensureMainnetTokenProgram(
  connection: Connection
): Promise<boolean> {
  const version = await rpcCall(connection.rpcEndpoint, "getVersion", []);
  const surfnetVersion: string | undefined = version["surfnet-version"];
  if (surfnetVersion === undefined) {
    console.warn(
      "ensureMainnetTokenProgram: local validator is not a surfnet, " +
        "skipping legacy-token cases"
    );
    return false;
  }

  const parts = surfnetVersion.split(".").map((part) => parseInt(part, 10));
  for (let i = 0; i < MIN_SURFNET_VERSION.length; i++) {
    const part = parts[i] ?? 0;
    if (part !== MIN_SURFNET_VERSION[i]) {
      if (part > MIN_SURFNET_VERSION[i]) {
        return true;
      }
      console.warn(
        `ensureMainnetTokenProgram: surfnet ${surfnetVersion} is older than ` +
          `${MIN_SURFNET_VERSION.join(".")}, skipping legacy-token cases`
      );
      return false;
    }
  }
  return true;
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
