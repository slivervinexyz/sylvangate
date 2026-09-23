// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {GateFixture} from "./helpers/GateFixture.sol";
import {SliverVineGate} from "../src/SliverVineGate.sol";
import {ISliverVineGate} from "../src/interfaces/ISliverVineGate.sol";

/// @notice Property-based coverage. Run with `forge test --profile deep` for 65,535 runs per
///         property, matching the off-chain engine's existing fuzz corpus size.
contract SliverVineGateFuzzTest is GateFixture {
    function setUp() public {
        _deployGate();
    }

    /// @dev PROPERTY: acceptance is exactly the conjunction of the documented predicates. Any input
    ///      outside that region must be refused — never merely "usually refused".
    function testFuzz_AcceptanceRegionIsExact(
        uint64 issuedAt,
        uint32 ttl,
        uint8 verdict,
        uint16 riskBps,
        uint256 nonce,
        uint32 warpTo
    ) public {
        issuedAt = uint64(bound(issuedAt, 1_000_000, 2_000_000_000));
        uint64 now_ = uint64(bound(warpTo, 1_000_000, 2_000_000_000));
        vm.warp(now_);

        ISliverVineGate.RiskAttestation memory a = ISliverVineGate.RiskAttestation({
            payloadHash: keccak256(abi.encodePacked(nonce)),
            subject: subject,
            verdict: verdict,
            riskBps: riskBps,
            issuedAt: issuedAt,
            expiresAt: issuedAt + uint64(ttl),
            nonce: nonce
        });
        bytes[] memory sigs = _sign(a, 2);

        bool shouldPass = verdict == 1 && riskBps <= 10_000 && a.expiresAt > a.issuedAt
            && a.expiresAt - a.issuedAt <= gate.MAX_TTL() && a.issuedAt <= now_ + gate.MAX_FUTURE_SKEW()
            && now_ <= a.expiresAt;

        vm.prank(subject);
        if (shouldPass) {
            gate.verifyAndConsume(a, sigs);
        } else {
            vm.expectRevert();
            gate.verifyAndConsume(a, sigs);
        }
    }

    /// @dev PROPERTY: only the declared subject can consume, for every other caller in the space.
    function testFuzz_OnlySubjectMayConsume(address caller, uint256 nonce) public {
        vm.assume(caller != subject);
        ISliverVineGate.RiskAttestation memory a = _att(subject, nonce);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(caller);
        vm.expectRevert(SliverVineGate.WrongSubject.selector);
        gate.verifyAndConsume(a, sigs);
    }

    /// @dev PROPERTY: an arbitrary key that is not in the signer set can never contribute to quorum,
    ///      no matter how the signature is arranged.
    function testFuzz_ArbitraryKeyCannotReachQuorum(uint256 rogueKey, uint256 nonce) public {
        rogueKey = bound(rogueKey, 1, type(uint128).max);
        address rogue = vm.addr(rogueKey);
        vm.assume(!gate.isSigner(rogue));

        ISliverVineGate.RiskAttestation memory a = _att(subject, nonce);
        bytes32 digest = gate.hashAttestation(a);

        address known = vm.addr(pk[0]);
        bytes[] memory sigs = new bytes[](2);
        if (rogue < known) {
            sigs[0] = _sigFor(rogueKey, digest);
            sigs[1] = _sigFor(pk[0], digest);
        } else {
            sigs[0] = _sigFor(pk[0], digest);
            sigs[1] = _sigFor(rogueKey, digest);
        }

        vm.prank(subject);
        vm.expectRevert(); // UnknownSigner (or SignersNotSorted on address collision ordering)
        gate.verifyAndConsume(a, sigs);
    }

    /// @dev PROPERTY: consumption is idempotent-by-refusal. One digest, at most one execution, for
    ///      any attestation shape.
    function testFuzz_NeverConsumableTwice(uint256 nonce, uint16 riskBps) public {
        riskBps = uint16(bound(riskBps, 0, 10_000));
        ISliverVineGate.RiskAttestation memory a = _att(subject, nonce);
        a.riskBps = riskBps;
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        gate.verifyAndConsume(a, sigs);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.Replayed.selector);
        gate.verifyAndConsume(a, sigs);
    }

    /// @dev PROPERTY: mutating any signed field invalidates the quorum. Guards against a field being
    ///      accidentally omitted from the EIP-712 struct hash — a silent, catastrophic bug class.
    function testFuzz_EveryFieldIsSigned(uint8 which, uint256 nonce) public {
        which = uint8(bound(which, 0, 5));
        ISliverVineGate.RiskAttestation memory a = _att(subject, nonce);
        bytes[] memory sigs = _sign(a, 2); // signed over the ORIGINAL struct

        if (which == 0) a.payloadHash = keccak256("tampered");
        else if (which == 1) a.riskBps = a.riskBps == 5 ? 6 : 5;
        else if (which == 2) a.issuedAt = a.issuedAt - 1;
        else if (which == 3) a.expiresAt = a.expiresAt - 1;
        else if (which == 4) a.nonce = a.nonce ^ 1;
        else a.subject = stranger;

        vm.prank(a.subject);
        vm.expectRevert();
        gate.verifyAndConsume(a, sigs);
    }
}
