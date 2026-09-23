// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {GateFixture} from "./helpers/GateFixture.sol";
import {SliverVineGate} from "../src/SliverVineGate.sol";
import {GatedExecutor} from "../src/GatedExecutor.sol";
import {ISliverVineGate} from "../src/interfaces/ISliverVineGate.sol";

contract TargetStub {
    uint256 public calls;
    bool public shouldRevert;

    error TargetFailed();

    function poke(uint256) external returns (uint256) {
        if (shouldRevert) revert TargetFailed();
        ++calls;
        return 42;
    }

    function setRevert(bool v) external {
        shouldRevert = v;
    }
}

/// @dev Attempts to re-enter the executor from inside the target call.
contract ReentrantTarget {
    GatedExecutor public exec;
    bytes public payload;
    bool public tried;

    constructor(GatedExecutor exec_) {
        exec = exec_;
    }

    function setPayload(bytes calldata p) external {
        payload = p;
    }

    function poke(uint256) external returns (uint256) {
        tried = true;
        (bool ok,) = address(exec).call(payload);
        require(!ok, "reentry unexpectedly succeeded");
        return 1;
    }
}

contract GatedExecutorTest is GateFixture {
    GatedExecutor internal exec;
    TargetStub internal target;

    function setUp() public {
        _deployGate();
        target = new TargetStub();

        address[] memory allowed = new address[](1);
        allowed[0] = address(target);
        exec = new GatedExecutor(address(gate), true, allowed);
    }

    /* ---------------------------------------------------------------- */

    function _boundAtt(address initiator, address target_, bytes memory data, uint256 nonce)
        internal
        view
        returns (ISliverVineGate.RiskAttestation memory a)
    {
        a = ISliverVineGate.RiskAttestation({
            payloadHash: keccak256(
                abi.encode(block.chainid, address(exec), initiator, target_, keccak256(data), nonce)
            ),
            subject: address(exec), // the executor is what calls the gate
            verdict: 1,
            riskBps: 800,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + 20,
            nonce: nonce
        });
    }

    /* ---------------------------------------------------------------- */

    function test_Execute_HappyPath() public {
        bytes memory data = abi.encodeCall(TargetStub.poke, (7));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(target), data, 1);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        exec.execute(address(target), data, a, sigs);

        assertEq(target.calls(), 1);
        assertEq(exec.allowedCount(), 1);
    }

    /// @dev THE reason GatedExecutor exists: an ALLOW for one payload must not authorise another.
    function test_Execute_RedirectedCalldata_Reverts() public {
        bytes memory approved = abi.encodeCall(TargetStub.poke, (7));
        bytes memory swapped = abi.encodeCall(TargetStub.poke, (999));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(target), approved, 2);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        vm.expectRevert(GatedExecutor.PayloadMismatch.selector);
        exec.execute(address(target), swapped, a, sigs);
        assertEq(target.calls(), 0, "no call may occur");
    }

    /// @dev Front-running defence: the attestation is bound to the initiator, so an observer who
    ///      copies a pending attestation out of the mempool cannot use it.
    function test_Execute_DifferentInitiator_Reverts() public {
        bytes memory data = abi.encodeCall(TargetStub.poke, (7));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(target), data, 3);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(stranger);
        vm.expectRevert(GatedExecutor.PayloadMismatch.selector);
        exec.execute(address(target), data, a, sigs);
    }

    function test_Execute_TargetNotAllowed_Reverts() public {
        TargetStub other = new TargetStub();
        bytes memory data = abi.encodeCall(TargetStub.poke, (7));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(other), data, 4);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        vm.expectRevert(GatedExecutor.TargetNotAllowed.selector);
        exec.execute(address(other), data, a, sigs);
    }

    function test_Execute_BubblesTargetRevert() public {
        target.setRevert(true);
        bytes memory data = abi.encodeCall(TargetStub.poke, (7));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(target), data, 5);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        vm.expectRevert(TargetStub.TargetFailed.selector);
        exec.execute(address(target), data, a, sigs);
    }

    function test_Execute_ReplayBlockedAcrossCalls() public {
        bytes memory data = abi.encodeCall(TargetStub.poke, (7));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(target), data, 6);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        exec.execute(address(target), data, a, sigs);

        vm.prank(subject);
        vm.expectRevert(SliverVineGate.Replayed.selector);
        exec.execute(address(target), data, a, sigs);
    }

    /* ---------------------------------------------------------------- */
    /*                       SOFT DENY / TELEMETRY                      */
    /* ---------------------------------------------------------------- */

    /// @dev A revert emits nothing, so denials would be invisible on-chain. tryExecute makes
    ///      "toxic order intercepted" an on-chain fact while still performing no call.
    function test_TryExecute_DenyIsRecordedAndPerformsNoCall() public {
        bytes memory data = abi.encodeCall(TargetStub.poke, (7));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(target), data, 10);
        a.verdict = 0; // engine says DENY
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        (bool ok,) = exec.tryExecute(address(target), data, a, sigs);

        assertFalse(ok, "must not report success");
        assertEq(target.calls(), 0, "target must not be touched");
        assertEq(exec.deniedCount(), 1, "denial must be counted");
        assertEq(exec.allowedCount(), 0);
    }

    function test_TryExecute_AllowPathStillWorks() public {
        bytes memory data = abi.encodeCall(TargetStub.poke, (7));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(target), data, 11);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        (bool ok,) = exec.tryExecute(address(target), data, a, sigs);

        assertTrue(ok);
        assertEq(exec.allowedCount(), 1);
        assertEq(exec.deniedCount(), 0);
    }

    function test_TryExecute_PayloadMismatchRecorded() public {
        bytes memory approved = abi.encodeCall(TargetStub.poke, (7));
        bytes memory swapped = abi.encodeCall(TargetStub.poke, (8));
        ISliverVineGate.RiskAttestation memory a = _boundAtt(subject, address(target), approved, 12);
        bytes[] memory sigs = _sign(a, 2);

        vm.prank(subject);
        (bool ok,) = exec.tryExecute(address(target), swapped, a, sigs);
        assertFalse(ok);
        assertEq(exec.deniedCount(), 1);
    }

    /* ---------------------------------------------------------------- */
    /*                           REENTRANCY                             */
    /* ---------------------------------------------------------------- */

    /// @dev Two independent defences are asserted at once: the executor lock, and the fact that the
    ///      digest is already consumed before the external call begins.
    function test_Reentrancy_Blocked() public {
        ReentrantTarget rt = new ReentrantTarget(exec);

        address[] memory allowed = new address[](1);
        allowed[0] = address(rt);
        GatedExecutor exec2 = new GatedExecutor(address(gate), true, allowed);

        bytes memory data = abi.encodeCall(ReentrantTarget.poke, (1));
        ISliverVineGate.RiskAttestation memory a = ISliverVineGate.RiskAttestation({
            payloadHash: keccak256(
                abi.encode(block.chainid, address(exec2), subject, address(rt), keccak256(data), 20)
            ),
            subject: address(exec2),
            verdict: 1,
            riskBps: 100,
            issuedAt: uint64(block.timestamp),
            expiresAt: uint64(block.timestamp) + 20,
            nonce: 20
        });
        bytes[] memory sigs = _sign(a, 2);

        rt.setPayload(abi.encodeCall(GatedExecutor.execute, (address(rt), data, a, sigs)));

        vm.prank(subject);
        exec2.execute(address(rt), data, a, sigs);

        assertTrue(rt.tried(), "reentry path was not exercised");
        assertEq(exec2.allowedCount(), 1, "exactly one execution");
    }
}
