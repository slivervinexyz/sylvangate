// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {SliverVineGate} from "../src/SliverVineGate.sol";

/// @dev Nightly Echidna property harness. Admin/guardian are outside default senders.
contract GateEchidnaProperties {
    SliverVineGate internal immutable gate;

    constructor() {
        address[] memory signers = new address[](1);
        signers[0] = address(0x10000);
        gate = new SliverVineGate(signers, 1, address(0x20000), address(0x30000));
    }

    function echidna_threshold_positive() public view returns (bool) {
        return gate.threshold() > 0;
    }

    function echidna_signer_count_one() public view returns (bool) {
        return gate.signerCount() == 1;
    }

    function echidna_not_halted() public view returns (bool) {
        return !gate.halted();
    }
}
