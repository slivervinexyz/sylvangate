// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {DefenseMatrixBitmap} from "./libs/DefenseMatrixBitmap.sol";

/// @title SliverVineRiskOracleV2 — single-slot defenseState + EIP-712 MatrixReport
contract SliverVineRiskOracleV2 {
    error SignerZero();
    error SloZero();
    error SloTimeout();
    error InvalidStatus();
    error InvalidSigner();

    address public immutable offlineSigner;
    uint256 public immutable sloWindowSec;
    bytes32 public defenseState;

    bytes32 public constant ERR_SLO_TIMEOUT = keccak256("SLO_TIMEOUT");
    bytes32 public constant ERR_INVALID_SIGNER = keccak256("INVALID_SIGNER");

    bytes32 private constant _MATRIX_TYPEHASH =
        keccak256("MatrixReport(bytes32 defenseState,uint8 statusCode,uint256 timestamp)");
    bytes32 private immutable _DOMAIN;

    event MatrixReportApplied(bytes32 indexed defenseState, uint8 statusCode, uint256 timestamp, address indexed reporter);
    event EmergencyJumped(uint8 indexed statusCode, uint256 timestamp, address indexed reporter);
    event ErrorTriggered(bytes32 indexed code, address indexed actor);

    constructor(address offlineSigner_, uint256 sloWindowSec_) {
        if (offlineSigner_ == address(0)) revert SignerZero();
        if (sloWindowSec_ == 0) revert SloZero();
        offlineSigner = offlineSigner_;
        sloWindowSec = sloWindowSec_;
        _DOMAIN = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("SliverVineExoMesh"),
                keccak256("2"),
                block.chainid,
                address(this)
            )
        );
        defenseState = DefenseMatrixBitmap.pack(
            0,
            DefenseMatrixBitmap.STATUS_SAFE,
            false,
            block.timestamp,
            DefenseMatrixBitmap.SCHEMA_VERSION
        );
    }

    function applySignedMatrixReport(
        bytes32 newDefenseState,
        uint8 newStatusCode,
        uint256 timestamp,
        bytes calldata signature
    ) external {
        if (block.timestamp > timestamp + sloWindowSec) {
            emit ErrorTriggered(ERR_SLO_TIMEOUT, msg.sender);
            revert SloTimeout();
        }
        if (
            newStatusCode != DefenseMatrixBitmap.STATUS_SAFE
                && newStatusCode != DefenseMatrixBitmap.STATUS_WARNING
                && newStatusCode != DefenseMatrixBitmap.STATUS_SHUTDOWN
        ) {
            revert InvalidStatus();
        }
        if (DefenseMatrixBitmap.statusCode(newDefenseState) != newStatusCode) revert InvalidStatus();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _DOMAIN,
                keccak256(abi.encode(_MATRIX_TYPEHASH, newDefenseState, newStatusCode, timestamp))
            )
        );
        if (_recover(digest, signature) != offlineSigner) {
            emit ErrorTriggered(ERR_INVALID_SIGNER, msg.sender);
            revert InvalidSigner();
        }

        defenseState = newDefenseState;
        emit MatrixReportApplied(newDefenseState, newStatusCode, timestamp, msg.sender);
        if (newStatusCode == DefenseMatrixBitmap.STATUS_SHUTDOWN) {
            emit EmergencyJumped(newStatusCode, timestamp, msg.sender);
        }
    }

    function statusCode() external view returns (uint8) {
        return DefenseMatrixBitmap.statusCode(defenseState);
    }

    function isSystemFlushed() external view returns (bool) {
        return DefenseMatrixBitmap.isSystemFlushed(defenseState);
    }

    function lastTimestamp() external view returns (uint256) {
        return DefenseMatrixBitmap.lastTimestamp(defenseState);
    }

    function STATUS_SHUTDOWN() external pure returns (uint8) {
        return DefenseMatrixBitmap.STATUS_SHUTDOWN;
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }
}
