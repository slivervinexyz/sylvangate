// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {ISanctuaryInvariantsCoprocessor} from "../interfaces/ISanctuaryInvariantsCoprocessor.sol";

/// @dev Stylus staticcall helper — parse 32-byte packed result word (LE layout from Rust).
library SanctuaryInvariantsStylusLib {
    uint256 internal constant ERR_SOIL_TRIP = 1 << 5;

    function tryEvaluatePacked(address coprocessor, bytes memory packed)
        internal
        view
        returns (bool invoked, uint256 errMask)
    {
        if (coprocessor == address(0)) return (false, 0);
        (bool ok, bytes memory ret) =
            coprocessor.staticcall(abi.encodeWithSelector(ISanctuaryInvariantsCoprocessor.evaluatePacked.selector, packed));
        if (!ok || ret.length < 32) return (false, 0);
        bytes32 word = bytes32(ret);
        uint256 status = uint256(uint64(uint256(word >> 192)));
        uint256 gmxMask = uint256(uint64(uint256(word)));
        uint256 soilFlags = uint256(uint64(uint256(word >> 64)));
        if (status == 1 && gmxMask == 0 && soilFlags == 0) return (true, 0);
        if (gmxMask != 0) return (true, gmxMask);
        if (soilFlags != 0) return (true, ERR_SOIL_TRIP);
        return (true, gmxMask);
    }
}
