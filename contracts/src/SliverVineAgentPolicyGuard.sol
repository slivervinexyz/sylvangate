// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

/**
 * @title  SliverVineAgentPolicyGuard
 * @notice Lean ERC-8196 (Emerging Draft) agent-policy pre-screen.
 *         Complements SliverVineGate consume-once attestation — no custody, no proxy.
 * @dev    EIP-712 domain name/version match `SliverVineGate` (`SliverVineExoMesh` / `1`).
 *         Hot-path risk math stays on Edge (`checkSoilResistance()`, p50 ~106µs).
 */
contract SliverVineAgentPolicyGuard {
    error ZeroAgentId();
    error ZeroNotional();
    error PolicyExpired();
    error PolicyInactive();
    error ZeroGuardian();
    error NotGuardian();
    error AlreadyTerminated();

    bytes32 private constant _EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _NAME_HASH = keccak256("SliverVineExoMesh");
    bytes32 private constant _VERSION_HASH = keccak256("1");
    bytes32 public constant AGENT_POLICY_TYPEHASH =
        keccak256("AgentPolicy(bytes32 agentId,uint256 maxNotional,uint256 ttl)");

    address public immutable guardian;
    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    address private immutable _cachedThis;

    /// @notice One-way circuit breaker. Starts true; `terminatePolicy` is irreversible.
    bool public isPolicyActive;

    event AgentPolicyValidated(
        bytes32 indexed digest, bytes32 indexed agentId, uint256 maxNotional, uint256 ttl
    );
    event AgentPolicyTerminated(address indexed by);

    constructor(address guardian_) {
        if (guardian_ == address(0)) revert ZeroGuardian();
        guardian = guardian_;
        isPolicyActive = true;
        _cachedChainId = block.chainid;
        _cachedThis = address(this);
        _cachedDomainSeparator = _buildDomainSeparator();
    }

    /// @notice View pre-screen: active breaker, non-zero agent/notional, `ttl` = unix expiry.
    function checkAgentPolicy(bytes32 agentId, uint256 maxNotional, uint256 ttl)
        public
        view
        returns (bytes32 digest)
    {
        if (!isPolicyActive) revert PolicyInactive();
        if (agentId == bytes32(0)) revert ZeroAgentId();
        if (maxNotional == 0) revert ZeroNotional();
        if (block.timestamp > ttl) revert PolicyExpired();
        digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator(), _structHash(agentId, maxNotional, ttl)));
    }

    /// @notice Settlement-plane record of a passing ERC-8196 pre-screen (emits; not the Edge hot path).
    function validateAgentPolicy(bytes32 agentId, uint256 maxNotional, uint256 ttl)
        external
        returns (bytes32 digest)
    {
        digest = checkAgentPolicy(agentId, maxNotional, ttl);
        emit AgentPolicyValidated(digest, agentId, maxNotional, ttl);
    }

    function terminatePolicy() external {
        if (msg.sender != guardian) revert NotGuardian();
        if (!isPolicyActive) revert AlreadyTerminated();
        isPolicyActive = false;
        emit AgentPolicyTerminated(msg.sender);
    }

    function domainSeparator() public view returns (bytes32) {
        if (block.chainid == _cachedChainId && address(this) == _cachedThis) {
            return _cachedDomainSeparator;
        }
        return _buildDomainSeparator();
    }

    function _structHash(bytes32 agentId, uint256 maxNotional, uint256 ttl) private pure returns (bytes32) {
        return keccak256(abi.encode(AGENT_POLICY_TYPEHASH, agentId, maxNotional, ttl));
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(_EIP712_DOMAIN_TYPEHASH, _NAME_HASH, _VERSION_HASH, block.chainid, address(this)));
    }
}
