import { Wallet } from "ethers";
import { resolveHlTestnetDryRunPrivateKey } from "../../../../src/env/hl-testnet-key";

/** Test-only dry-run key — derived at runtime, not a published test vector. */
export const TEST_PRIVATE_KEY = resolveHlTestnetDryRunPrivateKey();
export const TEST_MASTER_ADDRESS = new Wallet(TEST_PRIVATE_KEY).address;
export const TEST_AGENT_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
