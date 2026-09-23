// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SliverVineGate} from "../src/SliverVineGate.sol";
import {ISliverVineGate} from "../src/interfaces/ISliverVineGate.sol";

/// @title DeployArbitrumOneGate — Arbitrum One Mainnet (42161) SliverVineGate ignition
/// @notice Deploys immutable SliverVineGate, verifies on-chain instance, optional ignition smoke consume.
///
/// Usage (from SliverVineGate/):
///   forge script script/DeployArbitrumOneGate.s.sol:DeployArbitrumOneGate \
///     --rpc-url https://arb1.arbitrum.io/rpc --broadcast -vvvv
///
/// Required env:
///   PRIVATE_KEY, GATE_SIGNERS (comma-separated, strictly ascending), GATE_THRESHOLD,
///   GUARDIAN, GATE_ADMIN
///
/// Optional ignition smoke (single verifyAndConsume):
///   RUN_IGNITION_SMOKE=1, IGNITION_SUBJECT, GATE_SIGNER_KEY_0, GATE_SIGNER_KEY_1, …
contract DeployArbitrumOneGate is Script {
    uint256 internal constant ARBITRUM_ONE_CHAIN_ID = 42161;

    function run() external {
        require(block.chainid == ARBITRUM_ONE_CHAIN_ID, "EXPECTED_ARBITRUM_ONE_42161");

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address[] memory signers = vm.envAddress("GATE_SIGNERS", ",");
        uint8 threshold = uint8(vm.envUint("GATE_THRESHOLD"));
        address guardian = vm.envAddress("GUARDIAN");
        address gateAdmin = vm.envAddress("GATE_ADMIN");

        for (uint256 i = 1; i < signers.length; ++i) {
            require(signers[i] > signers[i - 1], "GATE_SIGNERS must be strictly ascending");
        }
        require(threshold > 0 && threshold <= signers.length, "INVALID_THRESHOLD");

        vm.startBroadcast(deployerKey);

        SliverVineGate gate = new SliverVineGate(signers, threshold, guardian, gateAdmin);
        _verifyInstance(gate, threshold, signers.length);

        if (vm.envOr("RUN_IGNITION_SMOKE", uint256(0)) != 0) {
            _runIgnitionSmoke(gate, signers, threshold);
        }

        vm.stopBroadcast();

        bytes memory ctorArgs = abi.encode(signers, threshold, guardian, gateAdmin);

        console2.log("chainId                 ", block.chainid);
        console2.log("SliverVineGate          ", address(gate));
        console2.log("domainSeparator         ");
        console2.logBytes32(gate.domainSeparator());
        console2.log("threshold               ", threshold);
        console2.log("signerCount             ", signers.length);
        console2.log("");
        console2.log("--- Arbiscan One verification (https://arbiscan.io) ---");
        console2.log("forge verify-contract <addr> src/SliverVineGate.sol:SliverVineGate --chain-id 42161 --constructor-args-hex <hex>");
        console2.log("gateCtorArgsHex   ");
        console2.logBytes(ctorArgs);
    }

    function _verifyInstance(SliverVineGate gate, uint8 threshold, uint256 signerCount) internal view {
        require(address(gate).code.length > 0, "GATE_BYTECODE_EMPTY");
        require(gate.domainSeparator() != bytes32(0), "DOMAIN_SEPARATOR_ZERO");
        require(gate.threshold() == threshold, "THRESHOLD_MISMATCH");
        require(gate.signerCount() == signerCount, "SIGNER_COUNT_MISMATCH");
        console2.log("instanceVerification    PASS");
    }

    function _runIgnitionSmoke(SliverVineGate gate, address[] memory signers, uint8 threshold) internal {
        address subject = vm.envOr("IGNITION_SUBJECT", signers[0]);

        ISliverVineGate.RiskAttestation memory att = ISliverVineGate.RiskAttestation({
            payloadHash: keccak256("arbitrum-one-ignition-smoke-v1"),
            subject: subject,
            verdict: 1,
            riskBps: 1200,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + 20,
            nonce: block.timestamp
        });

        bytes32 digest = gate.hashAttestation(att);
        bytes[] memory sigs = new bytes[](threshold);
        for (uint256 i; i < threshold; ++i) {
            uint256 key = _signerKey(i);
            require(vm.addr(key) == signers[i], "SIGNER_KEY_MISMATCH");
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }

        vm.prank(subject);
        bytes32 consumed = gate.verifyAndConsume(att, sigs);
        require(gate.consumed(consumed), "IGNITION_SMOKE_NOT_CONSUMED");
        console2.log("ignitionSmoke           PASS");
        console2.log("ignitionDigest          ");
        console2.logBytes32(consumed);
    }

    function _signerKey(uint256 idx) internal view returns (uint256 key) {
        if (idx == 0) return vm.envUint("GATE_SIGNER_KEY_0");
        if (idx == 1) return vm.envUint("GATE_SIGNER_KEY_1");
        if (idx == 2) return vm.envUint("GATE_SIGNER_KEY_2");
        if (idx == 3) return vm.envUint("GATE_SIGNER_KEY_3");
        if (idx == 4) return vm.envUint("GATE_SIGNER_KEY_4");
        revert("SIGNER_KEY_IDX_OUT_OF_RANGE");
    }
}
