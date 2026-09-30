// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {GmxForkTraceHarness} from "./GmxForkTraceHarness.sol";

/// @notice Arbitrum One fork probe — replay TS-generated GMX ExchangeRouter.multicall and decode reverts.
contract GmxLocalForkTraceTest is GmxForkTraceHarness {
    string internal constant MICRO_FILL_FIXTURE = "contracts/test/fixtures/gmx-micro-fill-multicall.json";
    string internal constant GM_WITHDRAW_FIXTURE = "contracts/test/fixtures/gmx-gm-withdraw-multicall.json";
    string internal constant WALLET_A_SHORT_FIXTURE = "contracts/test/fixtures/gmx-wallet-a-short-multicall.json";

    function setUp() public {
        string memory rpc = vm.envOr("ARB_MAINNET_RPC_URL", string("https://arb1.arbitrum.io/rpc"));
        vm.createSelectFork(rpc);
    }

    function test_forkTraceMicroFillMulticall() public {
        string[3] memory legs = ["sendWnt", "sendTokens", "createOrder"];
        _runForkTrace(MICRO_FILL_FIXTURE, MICRO_FILL_ARTIFACT, legs, false);
    }

    function test_forkTraceGmWithdrawMulticall() public {
        string[3] memory legs = ["sendWnt", "sendTokens", "createWithdrawal"];
        _runForkTrace(GM_WITHDRAW_FIXTURE, ARTIFACT, legs, true);
    }

    function test_forkTraceWalletAShortMulticall() public {
        string[3] memory legs = ["sendWnt", "sendTokens", "createOrder"];
        _runForkTrace(WALLET_A_SHORT_FIXTURE, "artifacts/gmx_short_fallback_fork_trace.json", legs, false);
    }
}
