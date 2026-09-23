// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {console2} from "forge-std/console2.sol";
import {GmxForkHexLib} from "./GmxForkHexLib.sol";

/// @notice Low-level revert returndata parser — Error(string), Panic(uint256), GMX v2 custom errors.
library GmxForkRevertDecoder {
    using GmxForkHexLib for bytes4;
    using GmxForkHexLib for uint256;
    using GmxForkHexLib for int256;
    using GmxForkHexLib for address;

    bytes4 internal constant ERROR_STRING = 0x08c379a0;
    bytes4 internal constant PANIC = 0x4e487b71;

    error InsufficientExecutionFee(uint256 minExecutionFee, uint256 executionFee);
    error InsufficientWntAmountForExecutionFee(uint256 wntAmount, uint256 executionFee);
    error InsufficientCollateralUsd(int256 remainingCollateralUsd);
    error MinPositionSize(uint256 positionSizeInUsd, uint256 minPositionSizeUsd);
    error EmptyOrder();
    error MarketNotFound(address key);
    error InvalidOrderPrices(uint256 primaryPriceMin, uint256 primaryPriceMax, uint256 triggerPrice, uint256 orderType);
    error OrderNotFulfillableAtAcceptablePrice(uint256 price, uint256 acceptablePrice);
    error DisabledMarket(address market);
    error InvalidPositionMarket(address market);
    error OrderTypeCannotBeCreated(uint256 orderType);
    error MaxPriceAgeExceeded(uint256 oracleTimestamp, uint256 currentTimestamp);
    error OraclePriceOutdated();

    function logReturndata(bytes memory returndata, string memory label) internal pure {
        console2.log(string.concat("[gmx-fork] ", label, " returndata.len"), returndata.length);
        if (returndata.length == 0) {
            console2.log(string.concat("[gmx-fork] ", label, " returndata EMPTY (silent 0x)"));
            return;
        }
        console2.log(string.concat("[gmx-fork] ", label, " returndata.hex"));
        console2.logBytes(returndata);
        console2.log(string.concat("[gmx-fork] ", label, " decoded"), decode(returndata));
    }

    function decode(bytes memory returndata) internal pure returns (string memory) {
        if (returndata.length < 4) return "silent";
        bytes4 sel;
        assembly {
            sel := mload(add(returndata, 32))
        }
        bytes memory args = _slice(returndata, 4);
        if (sel == ERROR_STRING && args.length > 0) {
            return string.concat("Error(", abi.decode(args, (string)), ")");
        }
        if (sel == PANIC && args.length >= 32) {
            return string.concat("Panic(0x", abi.decode(args, (uint256)).uhex(), ")");
        }
        return _decodeGmx(sel, args);
    }

    function _decodeGmx(bytes4 sel, bytes memory args) private pure returns (string memory) {
        if (sel == InsufficientExecutionFee.selector) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("InsufficientExecutionFee(", a.uhex(), ", ", b.uhex(), ")");
        }
        if (sel == InsufficientWntAmountForExecutionFee.selector) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("InsufficientWntAmountForExecutionFee(", a.uhex(), ", ", b.uhex(), ")");
        }
        if (sel == InsufficientCollateralUsd.selector) {
            return string.concat("InsufficientCollateralUsd(", abi.decode(args, (int256)).ihex(), ")");
        }
        if (sel == MinPositionSize.selector) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("MinPositionSize(", a.uhex(), ", ", b.uhex(), ")");
        }
        if (sel == EmptyOrder.selector) return "EmptyOrder()";
        if (sel == OraclePriceOutdated.selector) return "OraclePriceOutdated()";
        if (sel == MarketNotFound.selector) {
            address key = abi.decode(args, (address));
            return string.concat("MarketNotFound(0x", GmxForkHexLib.addr(key), ")");
        }
        if (sel == DisabledMarket.selector) {
            address market = abi.decode(args, (address));
            return string.concat("DisabledMarket(0x", GmxForkHexLib.addr(market), ")");
        }
        if (sel == InvalidPositionMarket.selector) {
            address market = abi.decode(args, (address));
            return string.concat("InvalidPositionMarket(0x", GmxForkHexLib.addr(market), ")");
        }
        if (sel == OrderTypeCannotBeCreated.selector) {
            return string.concat("OrderTypeCannotBeCreated(", abi.decode(args, (uint256)).uhex(), ")");
        }
        if (sel == OrderNotFulfillableAtAcceptablePrice.selector) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("OrderNotFulfillableAtAcceptablePrice(", a.uhex(), ", ", b.uhex(), ")");
        }
        if (sel == InvalidOrderPrices.selector) {
            (uint256 a, uint256 b, uint256 c, uint256 d) = abi.decode(args, (uint256, uint256, uint256, uint256));
            return string.concat("InvalidOrderPrices(", a.uhex(), ", ", b.uhex(), ", ", c.uhex(), ", ", d.uhex(), ")");
        }
        if (sel == MaxPriceAgeExceeded.selector) {
            (uint256 a, uint256 b) = abi.decode(args, (uint256, uint256));
            return string.concat("MaxPriceAgeExceeded(", a.uhex(), ", ", b.uhex(), ")");
        }
        return string.concat("CustomError(0x", sel.b4hex(), ")");
    }

    function _slice(bytes memory data, uint256 skip) private pure returns (bytes memory) {
        if (data.length <= skip) return "";
        bytes memory out = new bytes(data.length - skip);
        for (uint256 i = 0; i < out.length; i++) out[i] = data[i + skip];
        return out;
    }
}
