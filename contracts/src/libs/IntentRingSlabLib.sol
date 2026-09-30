// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

/// @title IntentRingSlabLib — FNV-1a ring slot + shared attempt budget (TS `intent-core-ring.ts` parity).
library IntentRingSlabLib {
    uint256 internal constant SLOT_MASK = 255;
    uint256 internal constant WORDS_PER_SLOT = 4;
    uint256 internal constant SLOT_ATTEMPTS = 0;
    uint256 internal constant SLOT_FLAGS = 1;
    uint256 internal constant FLAG_SEVER_CHANNEL = 1;
    uint256 internal constant FLAG_VENUE_DRIFT = 2;

    struct GateResult {
        bool ok;
        bool venueDrift;
        bool severChannel;
        uint32 attempts;
    }

    function hashKeyToSlot(bytes memory key) internal pure returns (uint256 slot) {
        uint256 h = 0x811c9dc5;
        uint256 len = key.length;
        for (uint256 i = 0; i < len; ++i) {
            h ^= uint256(uint8(key[i]));
            unchecked {
                h = h * 0x01000193;
            }
        }
        return h & SLOT_MASK;
    }

    function slotBaseOffset(uint256 slotIndex) internal pure returns (uint256) {
        return slotIndex * WORDS_PER_SLOT;
    }

    function checkVenueDrift(uint256 allowedMask, uint256 targetBit) internal pure returns (bool) {
        if (allowedMask == 0 || targetBit == 0) return true;
        return (allowedMask & targetBit) != 0;
    }

    function trackAttemptBudget(
        uint32[] storage ringU32,
        uint256 baseOffset,
        uint32 maxAttempts
    ) internal returns (GateResult memory r) {
        uint256 attemptsIdx = baseOffset + SLOT_ATTEMPTS;
        uint256 flagsIdx = baseOffset + SLOT_FLAGS;
        uint32 next = ringU32[attemptsIdx] + 1;
        ringU32[attemptsIdx] = next;
        if (next > maxAttempts) {
            ringU32[flagsIdx] |= uint32(FLAG_SEVER_CHANNEL);
            r.ok = false;
            r.severChannel = true;
            r.attempts = next;
            return r;
        }
        r.ok = true;
        r.severChannel = false;
        r.attempts = next;
    }

    function evaluateGate(
        uint32[] storage ringU32,
        uint256 baseOffset,
        uint256 allowedMask,
        uint256 targetBit,
        uint32 maxAttempts
    ) internal returns (GateResult memory r) {
        if (!checkVenueDrift(allowedMask, targetBit)) {
            ringU32[baseOffset + SLOT_FLAGS] |= uint32(FLAG_VENUE_DRIFT);
            r.ok = false;
            r.venueDrift = true;
            r.attempts = ringU32[baseOffset + SLOT_ATTEMPTS];
            return r;
        }
        r = trackAttemptBudget(ringU32, baseOffset, maxAttempts);
        r.venueDrift = false;
    }
}
