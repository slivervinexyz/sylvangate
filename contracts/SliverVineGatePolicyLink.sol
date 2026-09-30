// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

interface ISliverVineGateAdmin {
    function admin() external view returns (address);
}

/// @notice On-chain PolicyGuard binding for immutable bootstrap SliverVineGate (no native setter).
contract SliverVineGatePolicyLink {
    error NotGateAdmin();
    error ZeroAddress();

    address public immutable gate;
    address public policyGuard;

    event PolicyGuardLinked(address indexed gate, address indexed policyGuard, address indexed by);

    constructor(address gate_) {
        if (gate_ == address(0)) revert ZeroAddress();
        gate = gate_;
    }

    function setPolicyGuard(address next) external {
        if (next == address(0)) revert ZeroAddress();
        if (msg.sender != ISliverVineGateAdmin(gate).admin()) revert NotGateAdmin();
        policyGuard = next;
        emit PolicyGuardLinked(gate, next, msg.sender);
    }
}
