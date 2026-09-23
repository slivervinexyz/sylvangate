// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {GmxForkHexLib} from "./GmxForkHexLib.sol";
import {GmxForkRevertDecoder} from "./GmxForkRevertDecoder.sol";

/// @notice Structured revert metadata for `artifacts/gmx_fork_trace.json`.
library GmxForkRevertAnalyze {
    using GmxForkHexLib for bytes4;
    using GmxForkHexLib for bytes;
    using GmxForkHexLib for uint256;
    using GmxForkHexLib for int256;
    using GmxForkRevertDecoder for bytes;

    bytes4 internal constant ERROR_STRING = 0x08c379a0;
    bytes4 internal constant PANIC = 0x4e487b71;

    struct ForkRevertInfo {
        bytes4 selector;
        string selectorHex;
        string errorName;
        string decoded;
        string argsJson;
        string returndataHex;
        uint256 returndataLen;
    }

    function analyze(bytes memory returndata) internal pure returns (ForkRevertInfo memory info) {
        info.returndataLen = returndata.length;
        info.returndataHex = returndata.bytesHex();
        if (returndata.length < 4) {
            info.errorName = "silent";
            info.decoded = "silent";
            info.argsJson = "{}";
            return info;
        }
        bytes4 sel;
        assembly {
            sel := mload(add(returndata, 32))
        }
        bytes memory args = _slice(returndata, 4);
        info.selector = sel;
        info.selectorHex = string.concat("0x", sel.b4hex());
        info.decoded = returndata.decode();
        info.errorName = _errorName(sel, args);
        info.argsJson = _argsJson(sel, args);
    }

    function _errorName(bytes4 sel, bytes memory args) private pure returns (string memory) {
        if (sel == ERROR_STRING && args.length > 0) return "Error(string)";
        if (sel == PANIC && args.length >= 32) return "Panic(uint256)";
        if (sel == GmxForkRevertDecoder.InsufficientExecutionFee.selector) return "InsufficientExecutionFee";
        if (sel == GmxForkRevertDecoder.InsufficientWntAmountForExecutionFee.selector) {
            return "InsufficientWntAmountForExecutionFee";
        }
        if (sel == GmxForkRevertDecoder.InsufficientCollateralUsd.selector) return "InsufficientCollateralUsd";
        if (sel == GmxForkRevertDecoder.MinPositionSize.selector) return "MinPositionSize";
        if (sel == GmxForkRevertDecoder.EmptyOrder.selector) return "EmptyOrder";
        if (sel == GmxForkRevertDecoder.OraclePriceOutdated.selector) return "OraclePriceOutdated";
        if (sel == GmxForkRevertDecoder.MarketNotFound.selector) return "MarketNotFound";
        if (sel == GmxForkRevertDecoder.DisabledMarket.selector) return "DisabledMarket";
        if (sel == GmxForkRevertDecoder.InvalidPositionMarket.selector) return "InvalidPositionMarket";
        if (sel == GmxForkRevertDecoder.OrderTypeCannotBeCreated.selector) return "OrderTypeCannotBeCreated";
        if (sel == GmxForkRevertDecoder.OrderNotFulfillableAtAcceptablePrice.selector) {
            return "OrderNotFulfillableAtAcceptablePrice";
        }
        if (sel == GmxForkRevertDecoder.InvalidOrderPrices.selector) return "InvalidOrderPrices";
        if (sel == GmxForkRevertDecoder.MaxPriceAgeExceeded.selector) return "MaxPriceAgeExceeded";
        return string.concat("CustomError(0x", sel.b4hex(), ")");
    }

    function _argsJson(bytes4 sel, bytes memory args) private pure returns (string memory) {
        if (sel == ERROR_STRING && args.length > 0) {
            return string.concat("{\"message\":\"", abi.decode(args, (string)), "\"}");
        }
        if (sel == PANIC && args.length >= 32) {
            return string.concat("{\"code\":\"0x", abi.decode(args, (uint256)).uhex(), "\"}");
        }
        if (sel == GmxForkRevertDecoder.InsufficientExecutionFee.selector && args.length >= 64) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("{\"minExecutionFee\":\"", a.uhex(), "\",\"executionFee\":\"", b.uhex(), "\"}");
        }
        if (sel == GmxForkRevertDecoder.InsufficientWntAmountForExecutionFee.selector && args.length >= 64) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("{\"wntAmount\":\"", a.uhex(), "\",\"executionFee\":\"", b.uhex(), "\"}");
        }
        if (sel == GmxForkRevertDecoder.InsufficientCollateralUsd.selector && args.length >= 32) {
            return string.concat("{\"remainingCollateralUsd\":\"", abi.decode(args, (int256)).ihex(), "\"}");
        }
        if (sel == GmxForkRevertDecoder.MinPositionSize.selector && args.length >= 64) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("{\"positionSizeInUsd\":\"", a.uhex(), "\",\"minPositionSizeUsd\":\"", b.uhex(), "\"}");
        }
        if (sel == GmxForkRevertDecoder.EmptyOrder.selector) return "{}";
        if (sel == GmxForkRevertDecoder.OraclePriceOutdated.selector) return "{}";
        if (sel == GmxForkRevertDecoder.MarketNotFound.selector && args.length >= 32) {
            address key = abi.decode(args, (address));
            return string.concat("{\"key\":\"0x", GmxForkHexLib.addr(key), "\"}");
        }
        if (sel == GmxForkRevertDecoder.DisabledMarket.selector && args.length >= 32) {
            address market = abi.decode(args, (address));
            return string.concat("{\"market\":\"0x", GmxForkHexLib.addr(market), "\"}");
        }
        if (sel == GmxForkRevertDecoder.InvalidPositionMarket.selector && args.length >= 32) {
            address market = abi.decode(args, (address));
            return string.concat("{\"market\":\"0x", GmxForkHexLib.addr(market), "\"}");
        }
        if (sel == GmxForkRevertDecoder.OrderTypeCannotBeCreated.selector && args.length >= 32) {
            return string.concat("{\"orderType\":\"", abi.decode(args, (uint256)).uhex(), "\"}");
        }
        if (sel == GmxForkRevertDecoder.OrderNotFulfillableAtAcceptablePrice.selector && args.length >= 64) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("{\"price\":\"", a.uhex(), "\",\"acceptablePrice\":\"", b.uhex(), "\"}");
        }
        if (sel == GmxForkRevertDecoder.InvalidOrderPrices.selector && args.length >= 128) {
            (uint256 a, uint256 b, uint256 c, uint256 d) = abi.decode(args, (uint256, uint256, uint256, uint256));
            return string.concat(
                "{\"primaryPriceMin\":\"",
                a.uhex(),
                "\",\"primaryPriceMax\":\"",
                b.uhex(),
                "\",\"triggerPrice\":\"",
                c.uhex(),
                "\",\"orderType\":\"",
                d.uhex(),
                "\"}"
            );
        }
        if (sel == GmxForkRevertDecoder.MaxPriceAgeExceeded.selector && args.length >= 64) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("{\"oracleTimestamp\":\"", a.uhex(), "\",\"currentTimestamp\":\"", b.uhex(), "\"}");
        }
        return string.concat("{\"selector\":\"0x", sel.b4hex(), "\"}");
    }

    function _slice(bytes memory data, uint256 skip) private pure returns (bytes memory) {
        if (data.length <= skip) return "";
        bytes memory out = new bytes(data.length - skip);
        for (uint256 i = 0; i < out.length; i++) out[i] = data[i + skip];
        return out;
    }
}
