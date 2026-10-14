import { readFileSync } from "fs";
import { Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";

// get the associated token account for the wrapped native SOL mint for the given keypair
// used to set the CPSWAP_LOCALNET_CREATE_POOL_FEE_RECEIVER env var in package.json for localnet tests
const keypairPath = process.argv[2];
const secret = JSON.parse(readFileSync(keypairPath, "utf8"));
const owner = Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey;

const ata = getAssociatedTokenAddressSync(NATIVE_MINT, owner);
process.stdout.write(ata.toBase58());
