// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SliverVineAgentPolicyGuard} from "../src/SliverVineAgentPolicyGuard.sol";

contract SliverVineAgentPolicyGuardTest is Test {
    SliverVineAgentPolicyGuard internal guard;
    address internal guardian = address(0xA11CE);

    bytes32 internal constant AGENT = keccak256("agent-1");
    uint256 internal constant NOTIONAL = 5_000e6;

    function setUp() public {
        vm.warp(1_700_000_000);
        guard = new SliverVineAgentPolicyGuard(guardian);
    }

    function test_ValidatePassesWhenActiveAndTtlFresh() public {
        uint256 ttl = block.timestamp + 30;
        bytes32 preview = guard.checkAgentPolicy(AGENT, NOTIONAL, ttl);

        vm.expectEmit(true, true, false, true);
        emit SliverVineAgentPolicyGuard.AgentPolicyValidated(preview, AGENT, NOTIONAL, ttl);

        bytes32 digest = guard.validateAgentPolicy(AGENT, NOTIONAL, ttl);
        assertEq(digest, preview);
        assertTrue(guard.isPolicyActive());
    }

    function test_CheckRevertsWhenTtlExpired() public {
        uint256 ttl = block.timestamp - 1;
        vm.expectRevert(SliverVineAgentPolicyGuard.PolicyExpired.selector);
        guard.checkAgentPolicy(AGENT, NOTIONAL, ttl);
    }

    function test_ValidateRevertsWhenPolicyTerminated() public {
        uint256 ttl = block.timestamp + 30;
        vm.prank(guardian);
        guard.terminatePolicy();

        vm.expectRevert(SliverVineAgentPolicyGuard.PolicyInactive.selector);
        guard.validateAgentPolicy(AGENT, NOTIONAL, ttl);
    }

    function test_TerminateIsOneWayAndGuardianOnly() public {
        vm.expectRevert(SliverVineAgentPolicyGuard.NotGuardian.selector);
        guard.terminatePolicy();

        vm.prank(guardian);
        vm.expectEmit(true, false, false, false);
        emit SliverVineAgentPolicyGuard.AgentPolicyTerminated(guardian);
        guard.terminatePolicy();
        assertFalse(guard.isPolicyActive());

        vm.prank(guardian);
        vm.expectRevert(SliverVineAgentPolicyGuard.AlreadyTerminated.selector);
        guard.terminatePolicy();
    }

    function test_CheckRevertsOnZeroAgentOrNotional() public {
        uint256 ttl = block.timestamp + 1;
        vm.expectRevert(SliverVineAgentPolicyGuard.ZeroAgentId.selector);
        guard.checkAgentPolicy(bytes32(0), NOTIONAL, ttl);
        vm.expectRevert(SliverVineAgentPolicyGuard.ZeroNotional.selector);
        guard.checkAgentPolicy(AGENT, 0, ttl);
    }
}
