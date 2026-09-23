// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

/// @notice Shared hex helpers for GMX fork trace JSON artifacts.
library GmxForkHexLib {
    function b4hex(bytes4 value) internal pure returns (string memory) {
        return _hexFixed(abi.encodePacked(value));
    }

    function uhex(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        bytes memory alphabet = "0123456789abcdef";
        uint256 len;
        for (uint256 v = value; v > 0; v >>= 4) len++;
        bytes memory out = new bytes(len);
        for (uint256 i = len; i > 0; i--) {
            out[i - 1] = alphabet[value & 0xf];
            value >>= 4;
        }
        return string(out);
    }

    function ihex(int256 value) internal pure returns (string memory) {
        if (value < 0) return string.concat("-", uhex(uint256(-value)));
        return uhex(uint256(value));
    }

    function addr(address value) internal pure returns (string memory) {
        return uhex(uint256(uint160(value)));
    }

    function bytesHex(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "0x";
        return string.concat("0x", _hexFixed(data));
    }

    function _hexFixed(bytes memory raw) private pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory out = new bytes(raw.length * 2);
        for (uint256 i = 0; i < raw.length; i++) {
            out[i * 2] = alphabet[uint8(raw[i]) >> 4];
            out[i * 2 + 1] = alphabet[uint8(raw[i]) & 0x0f];
        }
        return string(out);
    }
}
