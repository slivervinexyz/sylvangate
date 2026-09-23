// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

/// @dev Asymmetric authority: halt immediate; unhalt / signer / admin are timelocked.
abstract contract SliverVineGateAuth {
    error NotGuardian();
    error NotAdmin();
    error NotPendingAdmin();
    error ZeroAddress();
    error ThresholdOutOfRange();
    error SignerAlreadyPresent();
    error SignerAbsent();
    error InitialSignersNotSorted();
    error NoPendingChange();
    error ChangeAlreadyPending();
    error TimelockNotElapsed();
    error NotHalted();
    error AlreadyHalted();
    error UnhaltNotScheduled();

    uint64 public constant UNHALT_DELAY = 1 hours;
    uint64 public constant SIGNER_TIMELOCK = 24 hours;
    uint256 public constant MAX_SIGNATURES = 16;

    mapping(address => bool) public isSigner;
    uint8 public signerCount;
    uint8 public threshold;
    bool public halted;
    address public guardian;
    address public admin;
    address public pendingAdmin;
    address public policyGuard;
    uint64 public unhaltEta;

    struct PendingSignerChange {
        address signer;
        bool add;
        uint8 newThreshold;
        uint64 eta;
    }

    PendingSignerChange public pendingChange;

    event GateHalted(address indexed by);
    event UnhaltScheduled(address indexed by, uint64 eta);
    event GateUnhalted(address indexed by);
    event SignerChangeProposed(address indexed signer, bool add, uint8 newThreshold, uint64 eta);
    event SignerChangeExecuted(address indexed signer, bool add, uint8 newThreshold);
    event SignerChangeCancelled(address indexed signer, bool add);
    event AdminTransferProposed(address indexed from, address indexed to);
    event AdminTransferred(address indexed from, address indexed to);
    event GuardianChanged(address indexed from, address indexed to);
    event PolicyGuardSet(address indexed previous, address indexed next);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function _initAuth(address[] memory initialSigners, uint8 initialThreshold, address guardian_, address admin_)
        internal
    {
        if (guardian_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        uint256 n = initialSigners.length;
        if (n == 0 || n > MAX_SIGNATURES) revert ThresholdOutOfRange();
        address last = address(0);
        for (uint256 i; i < n; ++i) {
            address s = initialSigners[i];
            if (s == address(0)) revert ZeroAddress();
            if (s <= last) revert InitialSignersNotSorted();
            last = s;
            isSigner[s] = true;
        }
        if (initialThreshold == 0 || initialThreshold > n) revert ThresholdOutOfRange();
        signerCount = uint8(n);
        threshold = initialThreshold;
        guardian = guardian_;
        admin = admin_;
    }

    function halt() external {
        if (msg.sender != guardian && msg.sender != admin) revert NotGuardian();
        if (halted) revert AlreadyHalted();
        halted = true;
        unhaltEta = 0;
        emit GateHalted(msg.sender);
    }

    function cancelSignerChange() external {
        if (msg.sender != guardian && msg.sender != admin) revert NotGuardian();
        PendingSignerChange memory p = pendingChange;
        if (p.eta == 0) revert NoPendingChange();
        delete pendingChange;
        emit SignerChangeCancelled(p.signer, p.add);
    }

    function scheduleUnhalt() external onlyAdmin {
        if (!halted) revert NotHalted();
        unhaltEta = uint64(block.timestamp) + UNHALT_DELAY;
        emit UnhaltScheduled(msg.sender, unhaltEta);
    }

    function executeUnhalt() external onlyAdmin {
        if (!halted) revert NotHalted();
        uint64 eta = unhaltEta;
        if (eta == 0) revert UnhaltNotScheduled();
        if (block.timestamp < eta) revert TimelockNotElapsed();
        halted = false;
        unhaltEta = 0;
        emit GateUnhalted(msg.sender);
    }

    function proposeSignerChange(address signer, bool add, uint8 newThreshold) external onlyAdmin {
        if (signer == address(0)) revert ZeroAddress();
        if (pendingChange.eta != 0) revert ChangeAlreadyPending();
        if (add && isSigner[signer]) revert SignerAlreadyPresent();
        if (!add && !isSigner[signer]) revert SignerAbsent();
        uint256 resulting = add ? signerCount + 1 : signerCount - 1;
        if (newThreshold == 0 || newThreshold > resulting) revert ThresholdOutOfRange();
        uint64 eta = uint64(block.timestamp) + SIGNER_TIMELOCK;
        pendingChange = PendingSignerChange(signer, add, newThreshold, eta);
        emit SignerChangeProposed(signer, add, newThreshold, eta);
    }

    function executeSignerChange() external onlyAdmin {
        PendingSignerChange memory p = pendingChange;
        if (p.eta == 0) revert NoPendingChange();
        if (block.timestamp < p.eta) revert TimelockNotElapsed();
        if (p.add && isSigner[p.signer]) revert SignerAlreadyPresent();
        if (!p.add && !isSigner[p.signer]) revert SignerAbsent();
        uint8 resulting = p.add ? signerCount + 1 : signerCount - 1;
        if (p.newThreshold == 0 || p.newThreshold > resulting) revert ThresholdOutOfRange();
        isSigner[p.signer] = p.add;
        signerCount = resulting;
        threshold = p.newThreshold;
        delete pendingChange;
        emit SignerChangeExecuted(p.signer, p.add, p.newThreshold);
    }

    function proposeAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        pendingAdmin = newAdmin;
        emit AdminTransferProposed(admin, newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert NotPendingAdmin();
        address prev = admin;
        admin = msg.sender;
        pendingAdmin = address(0);
        emit AdminTransferred(prev, msg.sender);
    }

    function setGuardian(address newGuardian) external onlyAdmin {
        if (newGuardian == address(0)) revert ZeroAddress();
        address prev = guardian;
        guardian = newGuardian;
        emit GuardianChanged(prev, newGuardian);
    }

    /// @notice Bind an ERC-8196 PolicyGuard (V2) for settlement-plane pre-screen references.
    function setPolicyGuard(address newPolicyGuard) external onlyAdmin {
        if (newPolicyGuard == address(0)) revert ZeroAddress();
        address prev = policyGuard;
        policyGuard = newPolicyGuard;
        emit PolicyGuardSet(prev, newPolicyGuard);
    }
}
