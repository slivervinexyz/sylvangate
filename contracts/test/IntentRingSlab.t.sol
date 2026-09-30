// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IntentRingSlabLib} from "../src/libs/IntentRingSlabLib.sol";

contract IntentRingSlabHarness {
    using IntentRingSlabLib for uint32[];

    uint32[] internal ringU32;

    constructor() {
        ringU32 = new uint32[](1024);
    }

    function hash(bytes memory key) external pure returns (uint256) {
        return IntentRingSlabLib.hashKeyToSlot(key);
    }

    function bump(uint256 baseOffset, uint32 maxAttempts) external returns (IntentRingSlabLib.GateResult memory) {
        return ringU32.trackAttemptBudget(baseOffset, maxAttempts);
    }

    function gate(
        uint256 baseOffset,
        uint256 allowedMask,
        uint256 targetBit,
        uint32 maxAttempts
    ) external returns (IntentRingSlabLib.GateResult memory) {
        return ringU32.evaluateGate(baseOffset, allowedMask, targetBit, maxAttempts);
    }

    function attemptsAt(uint256 idx) external view returns (uint32) {
        return ringU32[idx];
    }

    function reset() external {
        for (uint256 i = 0; i < ringU32.length; ++i) {
            ringU32[i] = 0;
        }
    }
}

contract IntentRingSlabTest is Test {
    IntentRingSlabHarness internal h;

    function setUp() public {
        h = new IntentRingSlabHarness();
    }

    function test_hashKeyToSlot_knownCollisionProbe() public {
        uint256 slotA = h.hash("agent:collision-probe:0");
        uint256 slotB = h.hash("agent:collision-probe:256");
        assertTrue(slotA <= 255);
        assertTrue(slotB <= 255);
    }

    function testFuzz_hashKeyToSlot_alwaysMasked(bytes memory key) public {
        uint256 slot = h.hash(key);
        assertLe(slot, 255);
    }

    function testFuzz_collidingKeysShareAttemptBudget(bytes32 seedA, bytes32 seedB) public {
        bytes memory keyA = abi.encodePacked("agent:", seedA);
        bytes memory keyB = abi.encodePacked("agent:", seedB);
        if (keccak256(keyA) == keccak256(keyB)) keyB = abi.encodePacked("agent:", seedB, uint8(1));

        uint256 slotA = h.hash(keyA);
        uint256 slotB = h.hash(keyB);
        if (slotA != slotB) return;

        uint256 off = IntentRingSlabLib.slotBaseOffset(slotA);
        h.reset();
        IntentRingSlabLib.GateResult memory r1 = h.bump(off, 3);
        IntentRingSlabLib.GateResult memory r2 = h.bump(off, 3);
        assertEq(r1.attempts, 1);
        assertEq(r2.attempts, 2);
        IntentRingSlabLib.GateResult memory r3 = h.bump(IntentRingSlabLib.slotBaseOffset(slotB), 3);
        assertEq(r3.attempts, 3);
        assertEq(h.attemptsAt(off), 3);
    }

    function testFuzz_attemptBudget_seversOnFourth(uint256 baseOffsetRaw) public {
        uint256 baseOffset = bound(baseOffsetRaw, 0, 1020);
        h.reset();
        assertTrue(h.bump(baseOffset, 3).ok);
        assertTrue(h.bump(baseOffset, 3).ok);
        assertTrue(h.bump(baseOffset, 3).ok);
        IntentRingSlabLib.GateResult memory fourth = h.bump(baseOffset, 3);
        assertFalse(fourth.ok);
        assertTrue(fourth.severChannel);
        assertEq(fourth.attempts, 4);
    }

    function testFuzz_venueDrift_doesNotIncrementAttempts(uint256 baseOffsetRaw) public {
        uint256 baseOffset = bound(baseOffsetRaw, 0, 1020);
        h.reset();
        IntentRingSlabLib.GateResult memory r = h.gate(baseOffset, 1, 2, 3);
        assertFalse(r.ok);
        assertTrue(r.venueDrift);
        assertEq(r.attempts, 0);
        assertEq(h.attemptsAt(baseOffset), 0);
    }
}
