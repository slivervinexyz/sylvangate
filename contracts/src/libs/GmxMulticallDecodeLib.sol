// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

/// @dev Zero-copy calldata parser for GMX ExchangeRouter.multicall(bytes[]) GM deposit/withdraw legs.
library GmxMulticallDecodeLib {
    error NotMulticall();
    error LegCount();
    error LegOrder();
    error InvalidLeg();

    bytes4 internal constant SEL_MULTICALL = 0xac9650d8;
    bytes4 internal constant SEL_SEND_WNT = 0x7d39aaf1;
    bytes4 internal constant SEL_SEND_TOKENS = 0xe6d66ac8;
    bytes4 internal constant SEL_CREATE_DEPOSIT = 0xc82aa41b;
    bytes4 internal constant SEL_CREATE_WITHDRAWAL = 0xe78dc235;

    uint256 private constant _DEPOSIT_MIN_MARKET_OFFSET = 68;
    uint256 private constant _DEPOSIT_EXEC_FEE_OFFSET = 132;
    uint256 private constant _WITHDRAW_MIN_LONG_OFFSET = 68;
    uint256 private constant _WITHDRAW_MIN_SHORT_OFFSET = 100;
    uint256 private constant _WITHDRAW_EXEC_FEE_OFFSET = 164;

    enum WireKind {
        Unknown,
        Deposit,
        Withdraw
    }

    struct ParsedGmxWire {
        WireKind kind;
        uint256 executionFee;
        uint256 minMarketTokens;
        uint256 minLongTokenAmount;
        uint256 minShortTokenAmount;
        uint8 legCount;
    }

    function parseMulticall(bytes calldata data) internal pure returns (ParsedGmxWire memory wire) {
        if (data.length < 68 || bytes4(data[:4]) != SEL_MULTICALL) revert NotMulticall();

        uint256 n = _arrayLen(data);
        if (n < 3) revert LegCount();

        bytes calldata leg0 = _legAt(data, 0);
        bytes calldata legLast = _legAt(data, n - 1);
        if (leg0.length < 68 || bytes4(leg0[:4]) != SEL_SEND_WNT) revert LegOrder();

        wire.executionFee = _wordAt(leg0, 36);
        wire.legCount = uint8(n);

        bytes4 lastSel = bytes4(legLast[:4]);
        if (lastSel == SEL_CREATE_DEPOSIT) {
            wire.kind = WireKind.Deposit;
            _assertDepositMiddle(data, n);
            if (legLast.length < _DEPOSIT_EXEC_FEE_OFFSET + 32) revert InvalidLeg();
            wire.minMarketTokens = _wordAt(legLast, _DEPOSIT_MIN_MARKET_OFFSET);
            if (_wordAt(legLast, _DEPOSIT_EXEC_FEE_OFFSET) != wire.executionFee) revert LegOrder();
        } else if (lastSel == SEL_CREATE_WITHDRAWAL) {
            if (n != 3) revert LegCount();
            wire.kind = WireKind.Withdraw;
            if (bytes4(_legAt(data, 1)[:4]) != SEL_SEND_TOKENS) revert LegOrder();
            if (legLast.length < _WITHDRAW_EXEC_FEE_OFFSET + 32) revert InvalidLeg();
            wire.minLongTokenAmount = _wordAt(legLast, _WITHDRAW_MIN_LONG_OFFSET);
            wire.minShortTokenAmount = _wordAt(legLast, _WITHDRAW_MIN_SHORT_OFFSET);
            if (_wordAt(legLast, _WITHDRAW_EXEC_FEE_OFFSET) != wire.executionFee) revert LegOrder();
        } else {
            revert LegOrder();
        }
    }

    function _assertDepositMiddle(bytes calldata data, uint256 n) private pure {
        for (uint256 i = 1; i < n - 1; ++i) {
            bytes calldata mid = _legAt(data, i);
            if (mid.length < 4 || bytes4(mid[:4]) != SEL_SEND_TOKENS) revert LegOrder();
        }
    }

    function _arrayLen(bytes calldata data) private pure returns (uint256 n) {
        n = uint256(bytes32(data[36:68]));
    }

    function _legAt(bytes calldata data, uint256 i) private pure returns (bytes calldata leg) {
        uint256 arrayBase = 36;
        uint256 rel = uint256(bytes32(data[arrayBase + 32 + i * 32:arrayBase + 64 + i * 32]));
        uint256 elem = arrayBase + 32 + rel;
        if (elem + 32 > data.length) revert InvalidLeg();
        uint256 len = uint256(bytes32(data[elem:elem + 32]));
        uint256 start = elem + 32;
        if (start + len > data.length) revert InvalidLeg();
        leg = data[start:start + len];
    }

    function _wordAt(bytes calldata leg, uint256 off) private pure returns (uint256 w) {
        if (off + 32 > leg.length) revert InvalidLeg();
        w = uint256(bytes32(leg[off:off + 32]));
    }
}
