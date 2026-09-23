// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SliverVineGate} from "../src/SliverVineGate.sol";
import {ISliverVineGate} from "../src/interfaces/ISliverVineGate.sol";

/// @dev Drives the gate with adversarial sequences. The handler tracks, off to the side, what the
///      gate *should* have allowed; the invariants then assert the gate never diverged.
contract GateHandler is Test {
    SliverVineGate public gate;

    uint256[] public pk;
    address public subject;

    uint256 public successes;
    uint256 public unauthorisedSuccesses; // MUST stay 0
    uint256 public doubleSpends; // MUST stay 0

    mapping(bytes32 => bool) public seen;

    /// @dev A key that is deliberately NOT in the gate's signer set.
    uint256 private constant ROGUE_KEY = 0xBADF00D;

    constructor(SliverVineGate gate_, uint256[] memory pk_, address subject_) {
        gate = gate_;
        pk = pk_;
        subject = subject_;
    }

    /// @param sigCount 0..3 signatures — deliberately includes below-quorum counts
    /// @param useRogue when true, substitutes an unauthorised key into the quorum
    function tryConsume(uint8 sigCount, bool useRogue, uint16 riskBps, uint8 verdict, uint32 ttl, uint256 nonce)
        external
    {
        sigCount = uint8(bound(sigCount, 0, 3));
        ttl = uint32(bound(ttl, 0, 60));

        ISliverVineGate.RiskAttestation memory a = ISliverVineGate.RiskAttestation({
            payloadHash: keccak256(abi.encodePacked(nonce)),
            subject: subject,
            verdict: verdict,
            riskBps: riskBps,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + uint64(ttl),
            nonce: nonce
        });

        bytes32 digest = gate.hashAttestation(a);
        bytes[] memory sigs = new bytes[](sigCount);
        for (uint256 i; i < sigCount; ++i) {
            uint256 key = (useRogue && i == 0) ? ROGUE_KEY : pk[i];
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }

        bool wasSeen = seen[digest];

        vm.prank(subject);
        try gate.verifyAndConsume(a, sigs) {
            ++successes;
            if (useRogue || sigCount < gate.threshold() || verdict != 1 || riskBps > 10_000 || ttl == 0 || ttl > 30) {
                ++unauthorisedSuccesses;
            }
            if (wasSeen) ++doubleSpends;
            seen[digest] = true;
        } catch {
            // denial is always an acceptable outcome — the gate is allowed to be conservative
        }
    }

    function warp(uint32 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 120));
    }

    function haltAndRecover(bool doHalt) external {
        if (doHalt && !gate.halted()) {
            vm.prank(gate.guardian());
            gate.halt();
        } else if (!doHalt && gate.halted()) {
            vm.startPrank(gate.admin());
            gate.scheduleUnhalt();
            vm.warp(block.timestamp + gate.UNHALT_DELAY());
            gate.executeUnhalt();
            vm.stopPrank();
        }
    }
}

contract SliverVineGateInvariantTest is Test {
    SliverVineGate internal gate;
    GateHandler internal handler;

    function setUp() public {
        uint256[] memory keys = new uint256[](3);
        keys[0] = 0xA11CE;
        keys[1] = 0xB0B;
        keys[2] = 0xCA401;
        // insertion sort by address
        for (uint256 i = 1; i < 3; ++i) {
            uint256 k = keys[i];
            uint256 j = i;
            while (j > 0 && vm.addr(keys[j - 1]) > vm.addr(k)) {
                keys[j] = keys[j - 1];
                --j;
            }
            keys[j] = k;
        }

        address[] memory signers = new address[](3);
        uint256[] memory pk = new uint256[](3);
        for (uint256 i; i < 3; ++i) {
            signers[i] = vm.addr(keys[i]);
            pk[i] = keys[i];
        }

        gate = new SliverVineGate(signers, 2, makeAddr("guardian"), makeAddr("admin"));
        vm.warp(1_800_000_000);

        handler = new GateHandler(gate, pk, makeAddr("subject"));
        targetContract(address(handler));
    }

    /// @notice CORE SAFETY INVARIANT: nothing outside the documented acceptance region ever executes.
    function invariant_NoUnauthorisedExecution() public view {
        assertEq(handler.unauthorisedSuccesses(), 0, "gate allowed something it must not");
    }

    /// @notice CORE SAFETY INVARIANT: one attestation, at most one execution — forever.
    function invariant_NoDoubleSpend() public view {
        assertEq(handler.doubleSpends(), 0, "a digest was consumed twice");
    }

    /// @notice NON-VACUITY GUARD. An invariant suite that never reaches a success state proves
    ///         nothing. This asserts the handler's happy path is actually reachable, so the two
    ///         safety invariants above are meaningful rather than trivially true.
    function test_HandlerCanSucceed() public {
        handler.tryConsume(2, false, 800, 1, 20, 777);
        assertEq(handler.successes(), 1, "handler never reached a success state");
        assertEq(handler.unauthorisedSuccesses(), 0);
    }

    /// @notice Configuration can never drift into an unsatisfiable or trivially satisfiable state.
    function invariant_ThresholdWithinBounds() public view {
        assertGt(gate.threshold(), 0, "threshold reached zero");
        assertLe(gate.threshold(), gate.signerCount(), "threshold exceeds signer count");
    }
}
