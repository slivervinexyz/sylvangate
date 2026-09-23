// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {ISliverVineGate} from "./interfaces/ISliverVineGate.sol";

/**
 * @title  GatedExecutor
 * @notice Reference execution surface that cannot act without a live Sanctuary attestation.
 *
 * @dev WHY THIS EXISTS
 *      `SliverVineGate` proves "the engine approved something". This contract proves "the engine
 *      approved *exactly this*". Without calldata binding, one ALLOW for a harmless order could be
 *      redirected at an arbitrary target — the attestation would still verify.
 *
 * @dev SCOPE, DELIBERATELY NARROW
 *      - Non-payable, no `receive`, no `fallback`: the contract can never hold or move ETH.
 *        Value-bearing integrations use the ERC-4337 path (AgentGatePolicy) on the agent's own
 *        smart account instead of routing value through a shared executor.
 *      - No `delegatecall`.
 *      - No admin, no owner, no setters. Target policy is fixed at construction.
 *      Every one of these is a removed vulnerability class rather than a mitigated one.
 *
 * @dev TELEMETRY
 *      A reverting transaction emits nothing, so on-chain denial counts are impossible on the hard
 *      path. `tryExecute` closes that gap: on denial it performs no call, increments `deniedCount`
 *      and emits `GateDenied`. Safety is identical — the action never happens — but "toxic order
 *      intercepted" becomes an on-chain fact instead of a test-suite claim.
 */
contract GatedExecutor {
    error PayloadMismatch();
    error TargetNotAllowed();
    error Reentrancy();
    error ZeroAddress();

    ISliverVineGate public immutable gate;

    /// @notice When true, only `allowedTarget` addresses may be called.
    bool public immutable restrictTargets;

    mapping(address => bool) public allowedTarget;

    /// @notice Successful gated executions. Read by /api/grant-audit.
    uint256 public allowedCount = 0;

    /// @notice Attestations refused at this executor. Read by /api/grant-audit.
    uint256 public deniedCount = 0;

    uint256 private _lock = 1;

    event GatedExecuted(bytes32 indexed digest, address indexed initiator, address indexed target, uint256 dataLength);
    event GateDenied(address indexed initiator, address indexed target, bytes4 reason);

    constructor(address gate_, bool restrictTargets_, address[] memory targets) {
        if (gate_ == address(0)) revert ZeroAddress();
        gate = ISliverVineGate(gate_);
        restrictTargets = restrictTargets_;
        for (uint256 i; i < targets.length; ++i) {
            if (targets[i] == address(0)) revert ZeroAddress();
            allowedTarget[targets[i]] = true;
        }
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    /**
     * @notice Canonical payload binding.
     * @dev `initiator` is bound so an observer cannot front-run someone else's attestation.
     *      `address(this)` is bound so an attestation cannot hop between executors.
     *      `block.chainid` is bound as defence in depth — the gate's EIP-712 domain already
     *      separates chains, so same-address CREATE2 deployments on Robinhood Chain and Arbitrum
     *      Sepolia remain non-replayable across each other.
     */
    function payloadHash(address initiator, address target, bytes calldata data, uint256 nonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(block.chainid, address(this), initiator, target, keccak256(data), nonce));
    }

    /// @notice Hard path: reverts unless the attestation authorises exactly this call.
    function execute(
        address target,
        bytes calldata data,
        ISliverVineGate.RiskAttestation calldata att,
        bytes[] calldata signatures
    ) external nonReentrant returns (bytes memory result) {
        _assertBinding(target, data, att);

        // Consumes first: the digest is burned before the external call, so a re-entrant target
        // cannot reuse this attestation inside the same transaction.
        bytes32 digest = gate.verifyAndConsume(att, signatures);

        result = _call(target, data);
        unchecked {
            ++allowedCount;
        }
        emit GatedExecuted(digest, msg.sender, target, data.length);
    }

    /// @notice Soft path: never performs the call on denial, but records the denial on-chain.
    function tryExecute(
        address target,
        bytes calldata data,
        ISliverVineGate.RiskAttestation calldata att,
        bytes[] calldata signatures
    ) external nonReentrant returns (bool ok, bytes memory result) {
        if (restrictTargets && !allowedTarget[target]) {
            unchecked {
                ++deniedCount;
            }
            emit GateDenied(msg.sender, target, TargetNotAllowed.selector);
            return (false, "");
        }

        if (att.payloadHash != payloadHash(msg.sender, target, data, att.nonce)) {
            unchecked {
                ++deniedCount;
            }
            emit GateDenied(msg.sender, target, PayloadMismatch.selector);
            return (false, "");
        }

        bytes4 reason = gate.checkAttestation(att, signatures, address(this));
        if (reason != bytes4(0)) {
            unchecked {
                ++deniedCount;
            }
            emit GateDenied(msg.sender, target, reason);
            return (false, "");
        }

        bytes32 digest = gate.verifyAndConsume(att, signatures);
        result = _call(target, data);
        unchecked {
            ++allowedCount;
        }
        emit GatedExecuted(digest, msg.sender, target, data.length);
        return (true, result);
    }

    /* ------------------------------------------------------------------ */

    function _assertBinding(address target, bytes calldata data, ISliverVineGate.RiskAttestation calldata att)
        private
        view
    {
        if (restrictTargets && !allowedTarget[target]) revert TargetNotAllowed();
        if (att.payloadHash != payloadHash(msg.sender, target, data, att.nonce)) revert PayloadMismatch();
    }

    /// @dev Bubbles the callee's revert data verbatim. Silent failure would let a reverting target
    ///      look like a successful gated execution.
    function _call(address target, bytes calldata data) private returns (bytes memory) {
        (bool success, bytes memory ret) = target.call(data);
        if (!success) {
            assembly {
                revert(add(ret, 0x20), mload(ret))
            }
        }
        return ret;
    }
}
