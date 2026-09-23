// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {GmxMulticallDecodeLib} from "./GmxMulticallDecodeLib.sol";
import {GmxRiskInvariantLib} from "./GmxRiskInvariantLib.sol";

/// @dev Pack 96-byte Stylus calldata from decoded GMX wire + audit context.
library SanctuaryInvariantsPackLib {
    uint256 internal constant PACKED_LEN = 96;

    function packWireEval(GmxMulticallDecodeLib.ParsedGmxWire memory wire, GmxRiskInvariantLib.GmxWireContext memory ctx)
        internal
        pure
        returns (bytes memory packed)
    {
        packed = new bytes(PACKED_LEN);
        _writeU64(packed, 0, wire.executionFee);
        if (wire.kind == GmxMulticallDecodeLib.WireKind.Deposit) {
            _writeU64(packed, 8, wire.minMarketTokens);
            _writeU64(packed, 16, ctx.expectedMarketTokens);
        } else {
            _writeU64(packed, 8, wire.minLongTokenAmount);
            _writeU64(packed, 16, ctx.expectedLongTokenAmount);
        }
        uint16 slip = ctx.slippageBps == 0 ? 30 : ctx.slippageBps;
        packed[24] = bytes1(uint8(slip));
        packed[25] = bytes1(uint8(slip >> 8));
        _writeU64(packed, 32, ctx.poolLongUsd);
        _writeU64(packed, 40, ctx.poolShortUsd);
        _writeU64(packed, 48, 30);
        _writeU64(packed, 56, 500_000);
        _writeU64(packed, 64, 10);
        _writeU64(packed, 72, 0);
    }

    function _writeU64(bytes memory buf, uint256 off, uint256 value) private pure {
        for (uint256 i; i < 8; ++i) {
            buf[off + i] = bytes1(uint8(value >> (8 * i)));
        }
    }
}
