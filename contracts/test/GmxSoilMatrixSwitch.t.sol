// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SliverVineRiskOracleV2} from "../SliverVineRiskOracleV2.sol";
import {GmxSoilMatrixSwitch} from "../GmxSoilMatrixSwitch.sol";
import {DefenseMatrixBitmap} from "../libs/DefenseMatrixBitmap.sol";

contract GmxSoilMatrixSwitchTest is Test {
    uint256 internal signerPk = 0xA11CE;
    address internal signer;
    SliverVineRiskOracleV2 internal oracle;
    GmxSoilMatrixSwitch internal gate;

    bytes32 private constant _MATRIX_TYPEHASH =
        keccak256("MatrixReport(bytes32 defenseState,uint8 statusCode,uint256 timestamp)");

    function setUp() public {
        signer = vm.addr(signerPk);
        vm.warp(1_700_000_000);
        oracle = new SliverVineRiskOracleV2(signer, 300);
        gate = new GmxSoilMatrixSwitch(address(oracle));
    }

    function _domainSeparator(address verifyingContract) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("SliverVineExoMesh"),
                keccak256("2"),
                block.chainid,
                verifyingContract
            )
        );
    }

    function _signMatrix(bytes32 defenseState, uint8 statusCode, uint256 timestamp) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(_MATRIX_TYPEHASH, defenseState, statusCode, timestamp));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(address(oracle)), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _apply(bytes32 defenseState, uint8 statusCode, uint256 timestamp) internal {
        oracle.applySignedMatrixReport(defenseState, statusCode, timestamp, _signMatrix(defenseState, statusCode, timestamp));
    }

    function test_GateMatrix_PassesOnCleanState() public view {
        gate.gateMatrix(bytes32(0));
    }

    function test_GateMatrix_RevertsOnEdgeTrip() public {
        bytes32 tripped = DefenseMatrixBitmap.pack(
            DefenseMatrixBitmap.EDGE_TRIP_MASK & (1 << 0),
            DefenseMatrixBitmap.STATUS_SAFE,
            false,
            block.timestamp,
            DefenseMatrixBitmap.SCHEMA_VERSION
        );
        _apply(tripped, DefenseMatrixBitmap.STATUS_SAFE, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(GmxSoilMatrixSwitch.MatrixTripped.selector, tripped));
        gate.gateMatrix(bytes32(0));
    }

    function test_GateMatrix_RevertsOnShutdownStatus() public {
        bytes32 shutdown = DefenseMatrixBitmap.pack(
            0,
            DefenseMatrixBitmap.STATUS_SHUTDOWN,
            true,
            block.timestamp,
            DefenseMatrixBitmap.SCHEMA_VERSION
        );
        _apply(shutdown, DefenseMatrixBitmap.STATUS_SHUTDOWN, block.timestamp);
        vm.expectRevert(GmxSoilMatrixSwitch.SloTimeout.selector);
        gate.gateMatrix(bytes32(0));
    }

    function test_GateMatrix_RevertsOnStaleTimestamp() public {
        bytes32 stale = DefenseMatrixBitmap.pack(
            0,
            DefenseMatrixBitmap.STATUS_SAFE,
            false,
            block.timestamp - 400,
            DefenseMatrixBitmap.SCHEMA_VERSION
        );
        _apply(stale, DefenseMatrixBitmap.STATUS_SAFE, block.timestamp);
        vm.expectRevert(GmxSoilMatrixSwitch.SloTimeout.selector);
        gate.gateMatrix(bytes32(0));
    }

    function test_GateMatrix_WireDigestMismatch() public {
        bytes32 digest = keccak256("wire-a");
        gate.setExpectedWireDigest(address(this), digest);
        vm.expectRevert(GmxSoilMatrixSwitch.WireDigestMismatch.selector);
        gate.gateMatrix(keccak256("wire-b"));
    }

    function test_GateMatrix_WireDigestMatch() public {
        bytes32 digest = keccak256("wire-ok");
        gate.setExpectedWireDigest(address(this), digest);
        gate.gateMatrix(digest);
    }

    function test_GateMatrix_SingleSloadGasBudget() public {
        uint256 gasBefore = gasleft();
        this.exposedGateMatrix();
        uint256 used = gasBefore - gasleft();
        assertLt(used, 15_000, "gateMatrix external view should stay under 15k gas");
    }

    function exposedGateMatrix() external view {
        gate.gateMatrix(bytes32(0));
    }

    function test_Bitmap_PackUnpackRoundTrip() public pure {
        bytes32 state = DefenseMatrixBitmap.pack(1 << 6, 1, true, 1_700_000_000, 1);
        assertEq(DefenseMatrixBitmap.trippedRoots(state), 1 << 6);
        assertEq(DefenseMatrixBitmap.statusCode(state), 1);
        assertTrue(DefenseMatrixBitmap.isSystemFlushed(state));
        assertEq(DefenseMatrixBitmap.lastTimestamp(state), 1_700_000_000);
        assertEq(DefenseMatrixBitmap.schemaVersion(state), 1);
        assertTrue(DefenseMatrixBitmap.edgeTripped(state));
    }
}
