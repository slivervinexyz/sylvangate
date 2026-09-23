// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

/// @dev Single-slot `bytes32 defenseState` pack/unpack — R01–R20 trip roots + oracle meta.
library DefenseMatrixBitmap {
    uint256 internal constant TRIP_ROOTS_MASK = (1 << 20) - 1;
    uint256 internal constant STATUS_SHIFT = 20;
    uint256 internal constant STATUS_MASK = 0xF;
    uint256 internal constant FLUSH_BIT = 1 << 24;
    uint256 internal constant TIMESTAMP_SHIFT = 25;
    uint256 internal constant TIMESTAMP_MASK = 0x7FFF_FFFF;
    uint256 internal constant SCHEMA_SHIFT = 56;
    uint256 internal constant SCHEMA_MASK = 0xFF;

    /// @dev R01 · R02 · R07 · R11 · R17 · R20 — Edge-packable roots.
    uint256 internal constant EDGE_TRIP_MASK =
        (1 << 0) | (1 << 1) | (1 << 6) | (1 << 10) | (1 << 16) | (1 << 19);

    uint8 internal constant STATUS_SAFE = 0;
    uint8 internal constant STATUS_WARNING = 1;
    uint8 internal constant STATUS_SHUTDOWN = 3;
    uint8 internal constant SCHEMA_VERSION = 1;

    function pack(
        uint256 trippedRoots,
        uint8 statusCode,
        bool isSystemFlushed,
        uint256 timestamp,
        uint8 schemaVersion
    ) internal pure returns (bytes32) {
        uint256 word = trippedRoots & TRIP_ROOTS_MASK;
        word |= (uint256(statusCode & uint8(STATUS_MASK)) << STATUS_SHIFT);
        if (isSystemFlushed) word |= FLUSH_BIT;
        word |= (uint256(timestamp & TIMESTAMP_MASK) << TIMESTAMP_SHIFT);
        word |= (uint256(schemaVersion & uint8(SCHEMA_MASK)) << SCHEMA_SHIFT);
        return bytes32(word);
    }

    function trippedRoots(bytes32 state) internal pure returns (uint256) {
        return uint256(state) & TRIP_ROOTS_MASK;
    }

    function statusCode(bytes32 state) internal pure returns (uint8) {
        return uint8((uint256(state) >> STATUS_SHIFT) & STATUS_MASK);
    }

    function isSystemFlushed(bytes32 state) internal pure returns (bool) {
        return (uint256(state) & FLUSH_BIT) != 0;
    }

    function lastTimestamp(bytes32 state) internal pure returns (uint256) {
        return (uint256(state) >> TIMESTAMP_SHIFT) & TIMESTAMP_MASK;
    }

    function schemaVersion(bytes32 state) internal pure returns (uint8) {
        return uint8((uint256(state) >> SCHEMA_SHIFT) & SCHEMA_MASK);
    }

    function edgeTripMask(bytes32 state) internal pure returns (uint256) {
        return uint256(state) & EDGE_TRIP_MASK;
    }

    function edgeTripped(bytes32 state) internal pure returns (bool) {
        return edgeTripMask(state) != 0;
    }
}
