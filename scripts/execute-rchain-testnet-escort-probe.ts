#!/usr/bin/env tsx
/**
 * Case A-Tier2: Robinhood testnet 46630 native escort attestation tx (ZeroDev Kernel / EOA).
 * Dry-run default. Live: CONFIRM_RCHAIN_TESTNET_PROBE=YES BROADCAST=1 RH_TESTNET_PK=0x… ZERODEV_PROJECT_ID=…
 */
import { RCHAIN_PROBE_TESTNET } from "./_shared/rchain-probe-chain";
import { runRchainEscortProbe } from "./_shared/run-rchain-escort-probe";

runRchainEscortProbe(RCHAIN_PROBE_TESTNET, process.argv.slice(2)).catch((err) => {
  console.error("[rchain-probe] fail-closed", err);
  process.exit(1);
});
