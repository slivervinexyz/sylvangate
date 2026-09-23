// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {ISliverVineGate} from "./interfaces/ISliverVineGate.sol";
import {SliverVineGateAuth} from "./SliverVineGateAuth.sol";
import {SliverVineGateLib} from "./SliverVineGateLib.sol";

/// @title SliverVineGate — immutable consume-once EIP-712 attestation (no proxy, no custody).
contract SliverVineGate is SliverVineGateAuth {
    error Halted();
    error Denied();
    error Expired();
    error TtlTooLong();
    error FutureDated();
    error Replayed();
    error InsufficientSigners();
    error SignersNotSorted();
    error UnknownSigner();
    error InvalidSignature();
    error WrongSubject();
    error RiskBpsOutOfRange();
    error ExpiryBeforeIssuance();
    error TooManySignatures();

    uint8 public constant VERDICT_ALLOW = 1;
    uint8 public constant ACTION_PASS_GREENLIGHT = 0;
    uint8 public constant ACTION_FAIL_CLOSED_BLOCK = 1;
    uint8 public constant ACTION_EMERGENCY_DELEVERAGE = 2;
    uint64 public constant MAX_TTL = 30;
    uint64 public constant MAX_FUTURE_SKEW = 2;
    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "RiskAttestation(bytes32 payloadHash,address subject,uint8 verdict,uint16 riskBps,uint64 issuedAt,uint64 expiresAt,uint256 nonce)"
    );

    mapping(bytes32 => bool) public consumed;
    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    address private immutable _cachedThis;

    event AttestationConsumed(
        bytes32 indexed digest, address indexed subject, bytes32 payloadHash, uint16 riskBps, uint256 nonce
    );
    event IntentAttested(bytes32 indexed intentHash, address indexed agent, uint8 action, uint256 shadowMarginUsd);
    event RiskTripBlocked(bytes32 indexed intentHash, address indexed agent, string reason);

    constructor(address[] memory initialSigners, uint8 initialThreshold, address guardian_, address admin_) {
        _initAuth(initialSigners, initialThreshold, guardian_, admin_);
        _cachedChainId = block.chainid;
        _cachedThis = address(this);
        _cachedDomainSeparator = SliverVineGateLib.buildDomainSeparator();
    }

    function verifyAndConsume(ISliverVineGate.RiskAttestation calldata att, bytes[] calldata signatures)
        external
        returns (bytes32 digest)
    {
        digest = _verifyAndConsume(att, signatures, ACTION_PASS_GREENLIGHT, 0);
    }

    function verifyAndConsume(
        ISliverVineGate.RiskAttestation calldata att,
        bytes[] calldata signatures,
        uint8 action,
        uint256 shadowMarginUsd
    ) external returns (bytes32 digest) {
        digest = _verifyAndConsume(att, signatures, action, shadowMarginUsd);
    }

    function tryReportRiskTrip(
        ISliverVineGate.RiskAttestation calldata att,
        bytes[] calldata signatures,
        address agent,
        string calldata reason
    ) external returns (bytes4 reasonCode) {
        (reasonCode,) = _validate(att, signatures, agent);
        if (reasonCode != bytes4(0)) emit RiskTripBlocked(att.payloadHash, agent, reason);
    }

    function checkAttestation(ISliverVineGate.RiskAttestation calldata att, bytes[] calldata signatures, address caller)
        external
        view
        returns (bytes4 reason)
    {
        (reason,) = _validate(att, signatures, caller);
    }

    function hashAttestation(ISliverVineGate.RiskAttestation calldata att) public view returns (bytes32) {
        return SliverVineGateLib.hashAttestation(att, _lens());
    }

    function domainSeparator() external view returns (bytes32) {
        return SliverVineGateLib.domainSeparator(_cachedDomainSeparator, _cachedChainId, _cachedThis);
    }

    function _verifyAndConsume(
        ISliverVineGate.RiskAttestation calldata att,
        bytes[] calldata signatures,
        uint8 action,
        uint256 shadowMarginUsd
    ) private returns (bytes32 digest) {
        bytes4 reason;
        (reason, digest) = _validate(att, signatures, msg.sender);
        if (reason != bytes4(0)) SliverVineGateLib.revertWith(reason);
        consumed[digest] = true;
        emit AttestationConsumed(digest, att.subject, att.payloadHash, att.riskBps, att.nonce);
        emit IntentAttested(att.payloadHash, att.subject, action, shadowMarginUsd);
    }

    function _validate(ISliverVineGate.RiskAttestation calldata att, bytes[] calldata signatures, address caller)
        private
        view
        returns (bytes4 reason, bytes32 digest)
    {
        return SliverVineGateLib.validate(att, signatures, caller, _lens(), consumed, isSigner);
    }

    function _lens() private view returns (SliverVineGateLib.GateLens memory) {
        return SliverVineGateLib.GateLens({
            halted: halted,
            threshold: threshold,
            cachedDomainSeparator: _cachedDomainSeparator,
            cachedChainId: _cachedChainId,
            cachedThis: _cachedThis,
            attestationTypehash: ATTESTATION_TYPEHASH
        });
    }
}
