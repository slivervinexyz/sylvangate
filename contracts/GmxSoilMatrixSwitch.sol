// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {SliverVineRiskOracleV2} from "./SliverVineRiskOracleV2.sol";
import {DefenseMatrixBitmap} from "./libs/DefenseMatrixBitmap.sol";

/// @title GmxSoilMatrixSwitch — 1× SLOAD defenseState gate + optional wire digest pass
contract GmxSoilMatrixSwitch {
    error OracleZero();
    error MatrixTripped(bytes32 state);
    error SloTimeout();
    error WireDigestMismatch();

    SliverVineRiskOracleV2 public immutable riskOracle;
    mapping(address => bytes32) public expectedWireDigest;

    bytes32 public constant ERR_SLO_TIMEOUT = keccak256("SLO_TIMEOUT");

    event MatrixGatePassed(address indexed caller, bytes32 wireDigest, uint256 timestamp);
    event MatrixGateTripped(address indexed caller, bytes32 state, bytes32 wireDigest);

    constructor(address oracle_) {
        if (oracle_ == address(0)) revert OracleZero();
        riskOracle = SliverVineRiskOracleV2(oracle_);
    }

    function setExpectedWireDigest(address caller, bytes32 digest) external {
        expectedWireDigest[caller] = digest;
    }

    /// @notice Single SLOAD `defenseState` + calldata wire digest check (no extra storage reads).
    function gateMatrix(bytes32 calldataWireDigest) external view {
        bytes32 state = riskOracle.defenseState();
        uint256 trip = DefenseMatrixBitmap.edgeTripMask(state);
        if (trip != 0) revert MatrixTripped(state);
        if (DefenseMatrixBitmap.isSystemFlushed(state)) revert SloTimeout();
        if (DefenseMatrixBitmap.statusCode(state) == DefenseMatrixBitmap.STATUS_SHUTDOWN) revert SloTimeout();

        uint256 ts = DefenseMatrixBitmap.lastTimestamp(state);
        if (block.timestamp > ts + riskOracle.sloWindowSec()) revert SloTimeout();

        if (calldataWireDigest != bytes32(0)) {
            bytes32 expected = expectedWireDigest[msg.sender];
            if (expected != bytes32(0) && calldataWireDigest != expected) revert WireDigestMismatch();
        }
    }
}
