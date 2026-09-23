// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

/// @title SliverVineRiskOracle — ERC-7579 Pre-Execution Hook (ZeroDev Kernel v3 risk circuit)
/// @notice Stateless circuit breaker (EIP-712 + timestamp + status mask) evaluated before UserOp ingress.
contract SliverVineRiskOracle {
    error SignerZero();
    error SloZero();
    error SloTimeout();
    error InvalidStatus();
    error InvalidSigner();

    address public immutable offlineSigner;
    bool public isSystemFlushed;
    uint8 public statusCode;
    uint256 public lastTimestamp;
    uint256 public immutable sloWindowSec;

    uint8 public constant STATUS_SAFE = 0;
    uint8 public constant STATUS_WARNING = 1;
    uint8 public constant STATUS_SHUTDOWN = 3;

    bytes32 public constant ERR_SLO_TIMEOUT = keccak256("SLO_TIMEOUT");
    bytes32 public constant ERR_INVALID_SIGNER = keccak256("INVALID_SIGNER");

    bytes32 private constant _TYPEHASH = keccak256("RiskReport(uint8 statusCode,uint256 timestamp)");
    bytes32 private immutable _DOMAIN;

    event StatusRefreshed(uint8 indexed statusCode, uint256 timestamp, address indexed reporter);
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
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function applySignedReport(uint8 newStatusCode, uint256 timestamp, bytes calldata signature) external {
        if (block.timestamp > timestamp + sloWindowSec) {
            emit ErrorTriggered(ERR_SLO_TIMEOUT, msg.sender);
            revert SloTimeout();
        }
        if (newStatusCode != STATUS_SAFE && newStatusCode != STATUS_WARNING && newStatusCode != STATUS_SHUTDOWN) {
            revert InvalidStatus();
        }
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _DOMAIN,
                keccak256(abi.encode(_TYPEHASH, newStatusCode, timestamp))
            )
        );
        if (_recover(digest, signature) != offlineSigner) {
            emit ErrorTriggered(ERR_INVALID_SIGNER, msg.sender);
            revert InvalidSigner();
        }
        statusCode = newStatusCode;
        lastTimestamp = timestamp;
        emit StatusRefreshed(newStatusCode, timestamp, msg.sender);
        if (newStatusCode == STATUS_SHUTDOWN) {
            isSystemFlushed = true;
            emit EmergencyJumped(newStatusCode, timestamp, msg.sender);
        }
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
