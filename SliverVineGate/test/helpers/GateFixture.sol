// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SliverVineGate} from "../../src/SliverVineGate.sol";
import {ISliverVineGate} from "../../src/interfaces/ISliverVineGate.sol";

/// @dev Shared rig: a 2-of-3 gate plus signature helpers that keep signers in the ascending order
///      the gate demands. Every test file builds on this so the ordering logic is exercised
///      identically everywhere.
abstract contract GateFixture is Test {
    SliverVineGate internal gate;

    uint256[] internal pk; // sorted so that vm.addr(pk[i]) is strictly ascending
    address[] internal signers;

    address internal guardian;
    address internal admin;
    address internal subject;
    address internal stranger;

    uint256 internal outsiderKey = 0xDEADBEEF;

    uint8 internal constant THRESHOLD = 2;

    function _deployGate() internal {
        guardian = makeAddr("guardian");
        admin = makeAddr("admin");
        subject = makeAddr("subject");
        stranger = makeAddr("stranger");

        uint256[] memory keys = new uint256[](3);
        keys[0] = 0xA11CE;
        keys[1] = 0xB0B;
        keys[2] = 0xCA401;
        _sortByAddress(keys);

        signers = new address[](3);
        for (uint256 i; i < 3; ++i) {
            pk.push(keys[i]);
            signers[i] = vm.addr(keys[i]);
        }

        gate = new SliverVineGate(signers, THRESHOLD, guardian, admin);
        vm.warp(1_800_000_000); // deterministic, comfortably away from 0
    }

    /* ------------------------------ builders ------------------------------ */

    function _att(address subject_, uint256 nonce_) internal view returns (ISliverVineGate.RiskAttestation memory a) {
        a = ISliverVineGate.RiskAttestation({
            payloadHash: keccak256(abi.encodePacked("payload", nonce_)),
            subject: subject_,
            verdict: 1,
            riskBps: 1_200,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + 20,
            nonce: nonce_
        });
    }

    /// @dev Signs with the first `count` keys. Because `pk` is address-sorted, the produced array is
    ///      already in strictly ascending signer order.
    function _sign(ISliverVineGate.RiskAttestation memory a, uint256 count) internal returns (bytes[] memory sigs) {
        bytes32 digest = gate.hashAttestation(a);
        sigs = new bytes[](count);
        for (uint256 i; i < count; ++i) {
            sigs[i] = _sigFor(pk[i], digest);
        }
    }

    function _sigFor(uint256 key, bytes32 digest) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _sortByAddress(uint256[] memory keys) internal {
        for (uint256 i = 1; i < keys.length; ++i) {
            uint256 k = keys[i];
            uint256 j = i;
            while (j > 0 && vm.addr(keys[j - 1]) > vm.addr(k)) {
                keys[j] = keys[j - 1];
                --j;
            }
            keys[j] = k;
        }
    }
}
