// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {GateFixture} from "./helpers/GateFixture.sol";
import {SliverVineGate} from "../src/SliverVineGate.sol";
import {SliverVineGateAuth} from "../src/SliverVineGateAuth.sol";
import {ISliverVineGate} from "../src/interfaces/ISliverVineGate.sol";

/// @notice Invariant-by-invariant unit coverage. Each test maps to one row of the spec table
///         (I1..I12) so an auditor can check completeness by reading test names alone.
contract SliverVineGateTest is GateFixture {
    function setUp() public {
        _deployGate();
    }

    /* ====================================================================== */
    /*                              HAPPY PATH                                */
    /* ====================================================================== */

    function test_HappyPath_ConsumesAndEmits() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 1);
        bytes[] memory sigs = _sign(a, 2);
        bytes32 expected = gate.hashAttestation(a);

        vm.prank(subject);
        bytes32 digest = gate.verifyAndConsume(a, sigs);

        assertEq(digest, expected, "digest mismatch");
        assertTrue(gate.consumed(digest), "not marked consumed");
    }

    function test_HappyPath_ExcessSignaturesAccepted() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 2);
        bytes[] memory sigs = _sign(a, 3); // 3-of-3 on a 2-of-3 gate
        vm.prank(subject);
        gate.verifyAndConsume(a, sigs);
    }

    function test_CheckAttestation_AgreesWithMutatingPath() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 3);
        bytes[] memory sigs = _sign(a, 2);

        assertEq(gate.checkAttestation(a, sigs, subject), bytes4(0), "dry run should pass");
        vm.prank(subject);
        gate.verifyAndConsume(a, sigs);
        assertEq(
            gate.checkAttestation(a, sigs, subject),
            SliverVineGate.Replayed.selector,
            "dry run should now report replay"
        );
    }

    function test_IntentAttested_EmitsOnTelemetryConsume() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 40);
        bytes[] memory sigs = _sign(a, 2);
        uint8 action = 2; // ACTION_EMERGENCY_DELEVERAGE
        uint256 shadowUsd = 42_100e6;

        vm.expectEmit(true, true, false, true);
        emit SliverVineGate.IntentAttested(a.payloadHash, subject, action, shadowUsd);

        vm.prank(subject);
        gate.verifyAndConsume(a, sigs, action, shadowUsd);
    }

    function test_TryReportRiskTrip_EmitsRiskTripBlocked() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 41);
        a.verdict = 0; // DENY
        bytes[] memory sigs = _sign(a, 2);
        string memory reason = "FAIL_CLOSED_BLOCK";

        vm.expectEmit(true, true, false, true);
        emit SliverVineGate.RiskTripBlocked(a.payloadHash, subject, reason);

        bytes4 code = gate.tryReportRiskTrip(a, sigs, subject, reason);
        assertEq(code, SliverVineGate.Denied.selector);
    }

    /* ====================================================================== */
    /*                       I1  halted denies everything                     */
    /* ====================================================================== */

    function test_I1_Halted_Denies() public {
        vm.prank(guardian);
        gate.halt();

        ISliverVineGate.RiskAttestation memory a = _att(subject, 10);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.Halted.selector);
        gate.verifyAndConsume(a, sigs);
    }

    /* ====================================================================== */
    /*                        I2  only verdict==1 allows                      */
    /* ====================================================================== */

    function test_I2_NonAllowVerdict_Denies() public {
        uint8[3] memory verdicts = [0, 2, 255];
        for (uint256 i; i < verdicts.length; ++i) {
            ISliverVineGate.RiskAttestation memory a = _att(subject, 20 + i);
            a.verdict = verdicts[i];
            bytes[] memory sigs = _sign(a, 2);

            vm.prank(subject);
            vm.expectRevert(SliverVineGate.Denied.selector);
            gate.verifyAndConsume(a, sigs);
        }
    }

    /* ====================================================================== */
    /*                             I3  expiry                                 */
    /* ====================================================================== */

    function test_I3_Expired_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 30);
        bytes[] memory sigs = _sign(a, 2);

        vm.warp(a.expiresAt + 1);
        vm.prank(subject);
        vm.expectRevert(SliverVineGate.Expired.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I3_ExactExpiryStillValid() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 31);
        bytes[] memory sigs = _sign(a, 2);

        vm.warp(a.expiresAt); // boundary: <= is accepted
        vm.prank(subject);
        gate.verifyAndConsume(a, sigs);
    }

    /* ====================================================================== */
    /*                        I4  TTL capped at MAX_TTL                       */
    /* ====================================================================== */

    function test_I4_TtlTooLong_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 40);
        a.expiresAt = a.issuedAt + gate.MAX_TTL() + 1;
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.TtlTooLong.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I4_TtlAtMaxAccepted() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 41);
        a.expiresAt = a.issuedAt + gate.MAX_TTL();
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        gate.verifyAndConsume(a, sigs);
    }

    /* ====================================================================== */
    /*                      I5  forward clock skew bound                      */
    /* ====================================================================== */

    function test_I5_FutureDated_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 50);
        a.issuedAt = uint64(block.timestamp) + gate.MAX_FUTURE_SKEW() + 1;
        a.expiresAt = a.issuedAt + 10;
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.FutureDated.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I5_SkewAtBoundaryAccepted() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 51);
        a.issuedAt = uint64(block.timestamp) + gate.MAX_FUTURE_SKEW();
        a.expiresAt = a.issuedAt + 10;
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        gate.verifyAndConsume(a, sigs);
    }

    /* ====================================================================== */
    /*                            I6  single use                              */
    /* ====================================================================== */

    function test_I6_Replay_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 60);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        gate.verifyAndConsume(a, sigs);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.Replayed.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I6_DistinctNonceProducesDistinctDigest() public view {
        bytes32 d1 = gate.hashAttestation(_att(subject, 61));
        bytes32 d2 = gate.hashAttestation(_att(subject, 62));
        assertTrue(d1 != d2, "nonce must affect digest");
    }

    /* ====================================================================== */
    /*                  I7  quorum, ordering, dedup, malleability             */
    /* ====================================================================== */

    function test_I7a_BelowThreshold_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 70);
        bytes[] memory sigs = _sign(a, 1);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.InsufficientSigners.selector);
        gate.verifyAndConsume(a, sigs);
    }

    /// @dev THE classic m-of-n bypass: one key signing m times. Ascending-order enforcement makes it
    ///      unrepresentable, so this surfaces as SignersNotSorted rather than a silent pass.
    function test_I7b_DuplicateSigner_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 71);
        bytes32 digest = gate.hashAttestation(a);

        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sigFor(pk[0], digest);
        sigs[1] = _sigFor(pk[0], digest); // same signer twice

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.SignersNotSorted.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I7b_DescendingOrder_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 72);
        bytes32 digest = gate.hashAttestation(a);

        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sigFor(pk[1], digest);
        sigs[1] = _sigFor(pk[0], digest); // lower address second

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.SignersNotSorted.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I7c_UnknownSigner_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 73);
        bytes32 digest = gate.hashAttestation(a);

        // Build a valid-but-unauthorised pair, still ascending.
        address outsider = vm.addr(outsiderKey);
        bytes[] memory sigs = new bytes[](2);
        if (outsider < vm.addr(pk[0])) {
            sigs[0] = _sigFor(outsiderKey, digest);
            sigs[1] = _sigFor(pk[0], digest);
        } else {
            sigs[0] = _sigFor(pk[0], digest);
            sigs[1] = _sigFor(outsiderKey, digest);
        }

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.UnknownSigner.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I7d_WrongLengthSignature_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 74);
        bytes32 digest = gate.hashAttestation(a);

        bytes[] memory sigs = new bytes[](2);
        sigs[0] = hex"1234"; // 2 bytes
        sigs[1] = _sigFor(pk[1], digest);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.InvalidSignature.selector);
        gate.verifyAndConsume(a, sigs);
    }

    /// @dev Flipping s to n-s and v to the complement yields a second valid signature for the same
    ///      key under permissive ECDSA. The gate must reject it, otherwise a single authorised key
    ///      could produce two distinct "signers" for one digest.
    function test_I7d_MalleableSignature_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 75);
        bytes32 digest = gate.hashAttestation(a);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk[0], digest);
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 sFlipped = bytes32(n - uint256(s));
        uint8 vFlipped = v == 27 ? 28 : 27;

        bytes[] memory sigs = new bytes[](2);
        sigs[0] = abi.encodePacked(r, sFlipped, vFlipped);
        sigs[1] = _sigFor(pk[1], digest);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.InvalidSignature.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I7d_NonCanonicalV_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 76);
        bytes32 digest = gate.hashAttestation(a);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk[0], digest);
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = abi.encodePacked(r, s, uint8(v - 27)); // 0/1 form is not accepted
        sigs[1] = _sigFor(pk[1], digest);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.InvalidSignature.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I12_TooManySignatures_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 77);
        bytes[] memory sigs = new bytes[](17);
        for (uint256 i; i < 17; ++i) {
            sigs[i] = new bytes(65);
        }

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.TooManySignatures.selector);
        gate.verifyAndConsume(a, sigs);
    }

    /* ====================================================================== */
    /*                        I8  subject binding                             */
    /* ====================================================================== */

    function test_I8_WrongSubject_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 80);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(stranger); // valid signatures, wrong caller
        vm.expectRevert(SliverVineGate.WrongSubject.selector);
        gate.verifyAndConsume(a, sigs);
    }

    /* ====================================================================== */
    /*                    I10 / I11  field sanity bounds                      */
    /* ====================================================================== */

    function test_I10_RiskBpsOutOfRange_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 90);
        a.riskBps = 10_001;
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.RiskBpsOutOfRange.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_I11_ExpiryBeforeIssuance_Denies() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 91);
        a.expiresAt = a.issuedAt; // zero-length window, and guards the subtraction below it
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.ExpiryBeforeIssuance.selector);
        gate.verifyAndConsume(a, sigs);
    }

    /* ====================================================================== */
    /*                     DOMAIN SEPARATION / CROSS-CHAIN                    */
    /* ====================================================================== */

    /// @dev The reason a CREATE2 same-address deployment on Robinhood Chain (46630) and Arbitrum
    ///      Sepolia (421614) is safe: chainId sits inside the EIP-712 domain, so one chain's
    ///      signature set cannot authorise the other's gate.
    function test_CrossChainReplay_Impossible() public {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 100);
        bytes[] memory sigs = _sign(a, 2);
        bytes32 digestArb = gate.hashAttestation(a);

        vm.chainId(46630); // Robinhood Chain testnet
        bytes32 digestRh = gate.hashAttestation(a);
        assertTrue(digestArb != digestRh, "digest must be chain-scoped");

        // The signatures still recover successfully — just to unrelated addresses, because they were
        // bound to the other chainId. UnknownSigner is therefore the correct denial, and the point
        // stands: no quorum can be assembled on the second chain from the first chain's signatures.
        vm.prank(subject);
        vm.expectRevert(SliverVineGate.UnknownSigner.selector);
        gate.verifyAndConsume(a, sigs);
    }

    function test_DomainSeparator_RebuiltAfterChainIdChange() public {
        bytes32 before = gate.domainSeparator();
        vm.chainId(421614);
        assertTrue(before != gate.domainSeparator(), "separator must follow chainId");
    }

    /// @dev Independent recomputation of the digest. Guards against the contract validating against
    ///      its own mistake — the hashing must match the EIP-712 spec, not merely be self-consistent.
    function test_HashAttestation_MatchesIndependentEip712() public view {
        ISliverVineGate.RiskAttestation memory a = _att(subject, 101);

        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("SliverVineExoMesh"),
                keccak256("1"),
                block.chainid,
                address(gate)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "RiskAttestation(bytes32 payloadHash,address subject,uint8 verdict,uint16 riskBps,uint64 issuedAt,uint64 expiresAt,uint256 nonce)"
                ),
                a.payloadHash,
                a.subject,
                a.verdict,
                a.riskBps,
                a.issuedAt,
                a.expiresAt,
                a.nonce
            )
        );
        assertEq(gate.hashAttestation(a), keccak256(abi.encodePacked(hex"1901", domain, structHash)));
    }

    /* ====================================================================== */
    /*                       AUTHORITY ASYMMETRY                              */
    /* ====================================================================== */

    function test_Authority_StrangerCannotHalt() public {
        vm.prank(stranger);
        vm.expectRevert(SliverVineGateAuth.NotGuardian.selector);
        gate.halt();
    }

    function test_Authority_UnhaltRequiresTimelock() public {
        vm.prank(guardian);
        gate.halt();

        vm.prank(admin);
        vm.expectRevert(SliverVineGateAuth.UnhaltNotScheduled.selector);
        gate.executeUnhalt();

        vm.prank(admin);
        gate.scheduleUnhalt();

        vm.prank(admin);
        vm.expectRevert(SliverVineGateAuth.TimelockNotElapsed.selector);
        gate.executeUnhalt();

        vm.warp(block.timestamp + gate.UNHALT_DELAY());
        vm.prank(admin);
        gate.executeUnhalt();
        assertFalse(gate.halted());
    }

    /// @dev Halting must void an in-flight unhalt schedule, otherwise an attacker who compromises
    ///      admin could pre-schedule and then re-open the gate immediately after any halt.
    function test_Authority_HaltVoidsPendingUnhalt() public {
        vm.prank(guardian);
        gate.halt();
        vm.prank(admin);
        gate.scheduleUnhalt();
        vm.warp(block.timestamp + gate.UNHALT_DELAY());
        vm.prank(admin);
        gate.executeUnhalt();

        vm.prank(guardian);
        gate.halt();
        assertEq(gate.unhaltEta(), 0, "schedule must be cleared on halt");

        vm.prank(admin);
        vm.expectRevert(SliverVineGateAuth.UnhaltNotScheduled.selector);
        gate.executeUnhalt();
    }

    function test_Authority_SignerAddIsTimelocked() public {
        address newSigner = vm.addr(outsiderKey);

        vm.prank(admin);
        gate.proposeSignerChange(newSigner, true, 3);

        vm.prank(admin);
        vm.expectRevert(SliverVineGateAuth.TimelockNotElapsed.selector);
        gate.executeSignerChange();

        vm.warp(block.timestamp + gate.SIGNER_TIMELOCK());
        vm.prank(admin);
        gate.executeSignerChange();

        assertTrue(gate.isSigner(newSigner));
        assertEq(gate.threshold(), 3);
        assertEq(gate.signerCount(), 4);
    }

    function test_Authority_GuardianCanCancelLoosening() public {
        vm.prank(admin);
        gate.proposeSignerChange(vm.addr(outsiderKey), true, 3);

        vm.prank(guardian);
        gate.cancelSignerChange();

        vm.warp(block.timestamp + gate.SIGNER_TIMELOCK());
        vm.prank(admin);
        vm.expectRevert(SliverVineGateAuth.NoPendingChange.selector);
        gate.executeSignerChange();
    }

    function test_Authority_ThresholdCannotExceedSignerCount() public {
        vm.prank(admin);
        vm.expectRevert(SliverVineGateAuth.ThresholdOutOfRange.selector);
        gate.proposeSignerChange(vm.addr(outsiderKey), true, 5); // 5 > 4 resulting signers
    }

    function test_Authority_ThresholdCannotBeZero() public {
        vm.prank(admin);
        vm.expectRevert(SliverVineGateAuth.ThresholdOutOfRange.selector);
        gate.proposeSignerChange(signers[0], false, 0);
    }

    function test_Authority_OnlyOnePendingChange() public {
        vm.prank(admin);
        gate.proposeSignerChange(vm.addr(outsiderKey), true, 3);
        vm.prank(admin);
        vm.expectRevert(SliverVineGateAuth.ChangeAlreadyPending.selector);
        gate.proposeSignerChange(signers[0], false, 1);
    }

    function test_Authority_AdminHandoverIsPullBased() public {
        vm.prank(admin);
        gate.proposeAdmin(stranger);
        assertEq(gate.admin(), admin, "proposal alone must not transfer");

        vm.prank(stranger);
        gate.acceptAdmin();
        assertEq(gate.admin(), stranger);
    }

    function test_Authority_StrangerCannotAcceptAdmin() public {
        vm.prank(admin);
        gate.proposeAdmin(subject);
        vm.prank(stranger);
        vm.expectRevert(SliverVineGateAuth.NotPendingAdmin.selector);
        gate.acceptAdmin();
    }

    /* ====================================================================== */
    /*                            CONSTRUCTOR                                 */
    /* ====================================================================== */

    function test_Constructor_RejectsUnsortedSigners() public {
        address[] memory bad = new address[](2);
        bad[0] = address(uint160(2));
        bad[1] = address(uint160(1));
        vm.expectRevert(SliverVineGateAuth.InitialSignersNotSorted.selector);
        new SliverVineGate(bad, 1, guardian, admin);
    }

    function test_Constructor_RejectsDuplicateSigners() public {
        address[] memory bad = new address[](2);
        bad[0] = address(uint160(7));
        bad[1] = address(uint160(7));
        vm.expectRevert(SliverVineGateAuth.InitialSignersNotSorted.selector);
        new SliverVineGate(bad, 1, guardian, admin);
    }

    function test_Constructor_RejectsThresholdAboveSignerCount() public {
        address[] memory ok = new address[](1);
        ok[0] = address(uint160(9));
        vm.expectRevert(SliverVineGateAuth.ThresholdOutOfRange.selector);
        new SliverVineGate(ok, 2, guardian, admin);
    }

    function test_Constructor_RejectsZeroGuardian() public {
        address[] memory ok = new address[](1);
        ok[0] = address(uint160(9));
        vm.expectRevert(SliverVineGateAuth.ZeroAddress.selector);
        new SliverVineGate(ok, 1, address(0), admin);
    }
}
