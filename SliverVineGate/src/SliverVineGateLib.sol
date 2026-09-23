// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {ISliverVineGate} from "./interfaces/ISliverVineGate.sol";

/// @title EIP-712 / ECDSA helpers for SliverVineGate (calldata pointers, no storage).
library SliverVineGateLib {
    uint256 internal constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant NAME_HASH = keccak256("SliverVineExoMesh");
    bytes32 internal constant VERSION_HASH = keccak256("1");
    uint8 internal constant VERDICT_ALLOW = 1;
    uint64 internal constant MAX_TTL = 30;
    uint64 internal constant MAX_FUTURE_SKEW = 2;
    uint256 internal constant MAX_SIGNATURES = 16;

    struct GateLens {
        bool halted;
        uint8 threshold;
        bytes32 cachedDomainSeparator;
        uint256 cachedChainId;
        address cachedThis;
        bytes32 attestationTypehash;
    }

    function structHash(ISliverVineGate.RiskAttestation calldata att, bytes32 typehash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                typehash, att.payloadHash, att.subject, att.verdict, att.riskBps, att.issuedAt, att.expiresAt, att.nonce
            )
        );
    }

    function buildDomainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function domainSeparator(bytes32 cached, uint256 cachedChainId, address cachedThis)
        internal
        view
        returns (bytes32)
    {
        if (block.chainid == cachedChainId && address(this) == cachedThis) return cached;
        return buildDomainSeparator();
    }

    function hashAttestation(ISliverVineGate.RiskAttestation calldata att, GateLens memory lens)
        internal
        view
        returns (bytes32)
    {
        bytes32 ds = domainSeparator(lens.cachedDomainSeparator, lens.cachedChainId, lens.cachedThis);
        return keccak256(abi.encodePacked(hex"1901", ds, structHash(att, lens.attestationTypehash)));
    }

    function recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v != 27 && v != 28) return address(0);
        if (uint256(s) > HALF_N || uint256(s) == 0 || uint256(r) == 0) return address(0);
        return ecrecover(digest, v, r, s);
    }

    function revertWith(bytes4 reason) internal pure {
        assembly {
            mstore(0x00, reason)
            revert(0x00, 0x04)
        }
    }

    function validate(
        ISliverVineGate.RiskAttestation calldata att,
        bytes[] calldata signatures,
        address caller,
        GateLens memory lens,
        mapping(bytes32 => bool) storage consumed,
        mapping(address => bool) storage isSigner
    ) internal view returns (bytes4 reason, bytes32 digest) {
        if (lens.halted) return (bytes4(keccak256("Halted()")), bytes32(0));
        if (caller != att.subject) return (bytes4(keccak256("WrongSubject()")), bytes32(0));
        if (att.verdict != VERDICT_ALLOW) return (bytes4(keccak256("Denied()")), bytes32(0));
        if (att.riskBps > 1e4) return (bytes4(keccak256("RiskBpsOutOfRange()")), bytes32(0));
        if (att.expiresAt <= att.issuedAt) return (bytes4(keccak256("ExpiryBeforeIssuance()")), bytes32(0));
        if (att.expiresAt - att.issuedAt > MAX_TTL) return (bytes4(keccak256("TtlTooLong()")), bytes32(0));
        // forge-lint: disable-next-line(block-timestamp)
        if (att.issuedAt > block.timestamp + MAX_FUTURE_SKEW) return (bytes4(keccak256("FutureDated()")), bytes32(0));
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > att.expiresAt) return (bytes4(keccak256("Expired()")), bytes32(0));
        uint256 count = signatures.length;
        if (count > MAX_SIGNATURES) return (bytes4(keccak256("TooManySignatures()")), bytes32(0));
        if (count < lens.threshold) return (bytes4(keccak256("InsufficientSigners()")), bytes32(0));
        digest = hashAttestation(att, lens);
        if (consumed[digest]) return (bytes4(keccak256("Replayed()")), digest);
        address last;
        for (uint256 i; i < count; ++i) {
            address rec = recover(digest, signatures[i]);
            if (rec == address(0)) return (bytes4(keccak256("InvalidSignature()")), digest);
            if (rec <= last) return (bytes4(keccak256("SignersNotSorted()")), digest);
            if (!isSigner[rec]) return (bytes4(keccak256("UnknownSigner()")), digest);
            last = rec;
        }
    }
}
