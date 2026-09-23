// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SliverVineGate} from "../src/SliverVineGate.sol";
import {GatedExecutor} from "../src/GatedExecutor.sol";

/// @title Deterministic dual-chain deployment
/// @notice Deploys the identical bytecode to Robinhood Chain testnet (46630) and Arbitrum Sepolia
///         (421614) at the SAME address via the canonical CREATE2 factory. This is safe only
///         because chainId is inside the EIP-712 domain — see test_CrossChainReplay_Impossible.
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_ARB_SEPOLIA --broadcast --verify
///   forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_ROBINHOOD  --broadcast
///
/// Required env:
///   PRIVATE_KEY, GATE_SIGNERS (comma-separated, ASCENDING), GATE_THRESHOLD, GUARDIAN, GATE_ADMIN,
///   EXEC_TARGETS (comma-separated), SALT (bytes32 hex)
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address[] memory signers = vm.envAddress("GATE_SIGNERS", ",");
        uint8 threshold = uint8(vm.envUint("GATE_THRESHOLD"));
        address guardian = vm.envAddress("GUARDIAN");
        address gateAdmin = vm.envAddress("GATE_ADMIN");
        address[] memory targets = vm.envAddress("EXEC_TARGETS", ",");
        bytes32 salt = vm.envBytes32("SALT");

        // Fail loudly before spending gas: the constructor requires strict ascending order and the
        // same ordering must hold on both chains for the addresses to match.
        for (uint256 i = 1; i < signers.length; ++i) {
            require(signers[i] > signers[i - 1], "GATE_SIGNERS must be strictly ascending");
        }

        vm.startBroadcast(deployerKey);

        SliverVineGate gate = new SliverVineGate{salt: salt}(signers, threshold, guardian, gateAdmin);
        GatedExecutor exec = new GatedExecutor{salt: salt}(address(gate), true, targets);

        vm.stopBroadcast();

        console2.log("chainId          ", block.chainid);
        console2.log("SliverVineGate   ", address(gate));
        console2.log("GatedExecutor    ", address(exec));
        console2.log("domainSeparator  ");
        console2.logBytes32(gate.domainSeparator());
        console2.log("--- record these in DEPLOYMENTS.md; addresses must match across both chains ---");
    }
}
