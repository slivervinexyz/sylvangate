// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {GmxMulticallDecodeLib} from "./GmxMulticallDecodeLib.sol";

/// @dev Pure GMX GM wire invariants — mirrors `src/core/gmx-risk-core.ts` (zero SLOAD / RPC).
library GmxRiskInvariantLib {
    uint256 internal constant GMX_MIN_EXECUTION_FEE_WEI = 1e15;
    uint256 internal constant SLIPPAGE_BPS_CAP = 10_000;
    uint256 internal constant IMBALANCE_MAX_BPS = 3_500; // 0.35

    uint256 internal constant ERR_EXECUTION_FEE = 1 << 0;
    uint256 internal constant ERR_MIN_MARKET_TOKENS = 1 << 1;
    uint256 internal constant ERR_MIN_LONG_TOKENS = 1 << 2;
    uint256 internal constant ERR_MIN_SHORT_TOKENS = 1 << 3;
    uint256 internal constant ERR_POOL_IMBALANCE = 1 << 4;

    struct GmxWireContext {
        uint256 expectedMarketTokens;
        uint256 expectedLongTokenAmount;
        uint256 expectedShortTokenAmount;
        uint16 slippageBps;
        uint256 poolLongUsd;
        uint256 poolShortUsd;
        uint256 maxImbalanceDeltaBps;
    }

    function validateExecutionFeeWei(uint256 feeWei) internal pure returns (bool) {
        return feeWei >= GMX_MIN_EXECUTION_FEE_WEI;
    }

    function minOutputAmount(uint256 expectedAmount, uint256 slippageBps) internal pure returns (uint256) {
        if (expectedAmount == 0) return 0;
        if (slippageBps > SLIPPAGE_BPS_CAP) slippageBps = SLIPPAGE_BPS_CAP;
        return (expectedAmount * (SLIPPAGE_BPS_CAP - slippageBps)) / SLIPPAGE_BPS_CAP;
    }

    function auditPoolWeightsImbalance(uint256 poolLongUsd, uint256 poolShortUsd, uint256 maxDeltaBps)
        internal
        pure
        returns (bool)
    {
        uint256 total = poolLongUsd + poolShortUsd;
        if (total == 0) return false;
        uint256 diff = poolLongUsd > poolShortUsd ? poolLongUsd - poolShortUsd : poolShortUsd - poolLongUsd;
        return diff * SLIPPAGE_BPS_CAP <= maxDeltaBps * total;
    }

    function collectWireErrors(GmxMulticallDecodeLib.ParsedGmxWire memory wire, GmxWireContext memory ctx)
        internal
        pure
        returns (uint256 errMask)
    {
        if (!validateExecutionFeeWei(wire.executionFee)) errMask |= ERR_EXECUTION_FEE;

        uint256 slipBps = ctx.slippageBps == 0 ? 30 : ctx.slippageBps;
        if (slipBps > SLIPPAGE_BPS_CAP) slipBps = SLIPPAGE_BPS_CAP;

        if (wire.kind == GmxMulticallDecodeLib.WireKind.Deposit) {
            errMask |= _auditMinOutput(ERR_MIN_MARKET_TOKENS, wire.minMarketTokens, ctx.expectedMarketTokens, slipBps);
        } else if (wire.kind == GmxMulticallDecodeLib.WireKind.Withdraw) {
            errMask |= _auditMinOutput(ERR_MIN_LONG_TOKENS, wire.minLongTokenAmount, ctx.expectedLongTokenAmount, slipBps);
            errMask |= _auditMinOutput(ERR_MIN_SHORT_TOKENS, wire.minShortTokenAmount, ctx.expectedShortTokenAmount, slipBps);
        }

        if (ctx.poolLongUsd != 0 || ctx.poolShortUsd != 0) {
            uint256 maxDelta = ctx.maxImbalanceDeltaBps == 0 ? IMBALANCE_MAX_BPS : ctx.maxImbalanceDeltaBps;
            if (!auditPoolWeightsImbalance(ctx.poolLongUsd, ctx.poolShortUsd, maxDelta)) {
                errMask |= ERR_POOL_IMBALANCE;
            }
        }
    }

    function _auditMinOutput(uint256 errBit, uint256 minOutput, uint256 expected, uint256 slipBps)
        private
        pure
        returns (uint256)
    {
        if (expected == 0) return 0;
        if (minOutput < minOutputAmount(expected, slipBps)) return errBit;
        return 0;
    }
}
