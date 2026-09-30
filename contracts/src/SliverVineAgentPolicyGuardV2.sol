// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {SliverVineAgentPolicyGuard} from "./SliverVineAgentPolicyGuard.sol";
import {SanctuaryInvariantsPackLib} from "./libs/SanctuaryInvariantsPackLib.sol";
import {SanctuaryInvariantsStylusLib} from "./libs/SanctuaryInvariantsStylusLib.sol";
import {GmxMulticallDecodeLib} from "./libs/GmxMulticallDecodeLib.sol";
import {GmxRiskInvariantLib} from "./libs/GmxRiskInvariantLib.sol";

/**
 * @title  SliverVineAgentPolicyGuardV2
 * @notice ERC-8196 pre-screen + on-chain GMX ExchangeRouter.multicall wire invariants.
 *         Optional Stylus coprocessor staticcall with Solidity fallback.
 */
contract SliverVineAgentPolicyGuardV2 is SliverVineAgentPolicyGuard {
    error GmxInvariantTripped(uint256 errMask);

    event AgentPolicyGmxWireValidated(
        bytes32 indexed digest, bytes32 indexed agentId, uint8 wireKind, uint256 errMask
    );

    address public immutable stylusCoprocessor;

    constructor(address guardian_, address stylusCoprocessor_) SliverVineAgentPolicyGuard(guardian_) {
        stylusCoprocessor = stylusCoprocessor_;
    }

    /// @notice View pre-screen: V1 policy + parsed GMX multicall pure invariants.
    function checkAgentPolicyWithGmxWire(
        bytes32 agentId,
        uint256 maxNotional,
        uint256 ttl,
        bytes calldata routerMulticallData,
        GmxRiskInvariantLib.GmxWireContext calldata ctx
    ) public view returns (bytes32 digest) {
        digest = checkAgentPolicy(agentId, maxNotional, ttl);
        _enforceGmxWire(routerMulticallData, ctx);
    }

    /// @notice Settlement-plane record of a passing GMX wire pre-screen.
    function validateAgentPolicyWithGmxWire(
        bytes32 agentId,
        uint256 maxNotional,
        uint256 ttl,
        bytes calldata routerMulticallData,
        GmxRiskInvariantLib.GmxWireContext calldata ctx
    ) external returns (bytes32 digest) {
        digest = checkAgentPolicyWithGmxWire(agentId, maxNotional, ttl, routerMulticallData, ctx);
        GmxMulticallDecodeLib.ParsedGmxWire memory wire = _parseWire(routerMulticallData);
        emit AgentPolicyGmxWireValidated(digest, agentId, uint8(wire.kind), 0);
    }

    function _enforceGmxWire(bytes calldata routerMulticallData, GmxRiskInvariantLib.GmxWireContext calldata ctx)
        private
        view
    {
        GmxMulticallDecodeLib.ParsedGmxWire memory wire = _parseWire(routerMulticallData);
        bytes memory packed = SanctuaryInvariantsPackLib.packWireEval(wire, ctx);
        (bool invoked, uint256 errMask) = SanctuaryInvariantsStylusLib.tryEvaluatePacked(stylusCoprocessor, packed);
        if (!invoked) errMask = GmxRiskInvariantLib.collectWireErrors(wire, ctx);
        if (errMask != 0) revert GmxInvariantTripped(errMask);
    }

    function _parseWire(bytes calldata routerMulticallData)
        private
        pure
        returns (GmxMulticallDecodeLib.ParsedGmxWire memory)
    {
        return GmxMulticallDecodeLib.parseMulticall(routerMulticallData);
    }
}
