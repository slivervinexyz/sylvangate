// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

/// @title ISliverVineGate
/// @notice On-chain verifier for off-chain SliverVine Sanctuary risk decisions.
/// @dev The gate does NOT compute risk. It makes bypassing the off-chain engine impossible.
interface ISliverVineGate {
    /// @param payloadHash Binds the attestation to one exact payload (see GatedExecutor.payloadHash).
    /// @param subject     The only address permitted to consume this attestation (`msg.sender`).
    /// @param verdict     1 = ALLOW. Every other value is treated as DENY (fail-closed).
    /// @param riskBps     Risk score in basis points, 0..10000. Telemetry only, never gating logic.
    /// @param issuedAt    Engine clock at decision time (unix seconds).
    /// @param expiresAt   Hard expiry. `expiresAt - issuedAt` must be <= MAX_TTL.
    /// @param nonce       Engine-side uniqueness. Replay is enforced on the full EIP-712 digest.
    struct RiskAttestation {
        bytes32 payloadHash;
        address subject;
        uint8 verdict;
        uint16 riskBps;
        uint64 issuedAt;
        uint64 expiresAt;
        uint256 nonce;
    }

    /// @notice Validates and permanently consumes an attestation. Reverts on any failure.
    function verifyAndConsume(RiskAttestation calldata att, bytes[] calldata signatures)
        external
        returns (bytes32 digest);

    /// @notice Consumes attestation and emits Dune-indexable `IntentAttested` telemetry.
    function verifyAndConsume(
        RiskAttestation calldata att,
        bytes[] calldata signatures,
        uint8 action,
        uint256 shadowMarginUsd
    ) external returns (bytes32 digest);

    /// @notice Non-mutating dry run that emits `RiskTripBlocked` when validation fails.
    function tryReportRiskTrip(
        RiskAttestation calldata att,
        bytes[] calldata signatures,
        address agent,
        string calldata reason
    ) external returns (bytes4 reasonCode);

    /// @notice Non-mutating dry run. Returns bytes4(0) when the attestation would be accepted,
    ///         otherwise the error selector that `verifyAndConsume` would revert with.
    function checkAttestation(RiskAttestation calldata att, bytes[] calldata signatures, address caller)
        external
        view
        returns (bytes4 reason);

    /// @notice EIP-712 digest for `att` under this gate's domain (chainId + address bound).
    function hashAttestation(RiskAttestation calldata att) external view returns (bytes32);

    function halted() external view returns (bool);
    function consumed(bytes32 digest) external view returns (bool);
    function isSigner(address account) external view returns (bool);
    function threshold() external view returns (uint8);
}
