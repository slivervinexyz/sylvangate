// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {SliverVineAgentPolicyGuardV2} from "../src/SliverVineAgentPolicyGuardV2.sol";
import {GmxMulticallDecodeLib} from "../src/libs/GmxMulticallDecodeLib.sol";
import {GmxRiskInvariantLib} from "../src/libs/GmxRiskInvariantLib.sol";

contract PolicyGuardGmxWireTest is Test {
    using stdJson for string;

    SliverVineAgentPolicyGuardV2 internal guard;
    address internal guardian = address(0xA11CE);

    bytes32 internal constant AGENT = keccak256("agent-gmx-wire");
    uint256 internal constant NOTIONAL = 5_000e6;

    function setUp() public {
        vm.warp(1_700_000_000);
        guard = new SliverVineAgentPolicyGuardV2(guardian, address(0));
    }

    function _loadFixture() internal returns (bytes memory multicallData, GmxRiskInvariantLib.GmxWireContext memory ctx) {
        string memory raw = vm.readFile("contracts/test/fixtures/gmx-gm-deposit-multicall.json");
        multicallData = raw.readBytes(".multicallData");
        ctx = GmxRiskInvariantLib.GmxWireContext({
            expectedMarketTokens: raw.readUint(".expectedMarketTokens"),
            expectedLongTokenAmount: 0,
            expectedShortTokenAmount: 0,
            slippageBps: uint16(raw.readUint(".slippageBps")),
            poolLongUsd: raw.readUint(".poolLongUsd"),
            poolShortUsd: raw.readUint(".poolShortUsd"),
            maxImbalanceDeltaBps: 3_500
        });
    }

    function test_InvariantLib_MirrorsExecutionFeeFloor() public pure {
        assertTrue(GmxRiskInvariantLib.validateExecutionFeeWei(1e15));
        assertFalse(GmxRiskInvariantLib.validateExecutionFeeWei(1e15 - 1));
    }

    function test_InvariantLib_MinOutputSlippageMath() public pure {
        assertEq(GmxRiskInvariantLib.minOutputAmount(1_000_000, 100), 990_000);
        assertEq(GmxRiskInvariantLib.minOutputAmount(0, 30), 0);
    }

    function test_InvariantLib_PoolImbalanceGuard() public pure {
        assertTrue(GmxRiskInvariantLib.auditPoolWeightsImbalance(5_200_000, 4_800_000, 3_500));
        assertFalse(GmxRiskInvariantLib.auditPoolWeightsImbalance(7_000_000, 3_000_000, 3_500));
    }

    function test_DecodeLib_ParsesDepositFixture() public {
        (bytes memory multicallData,) = _loadFixture();
        GmxMulticallDecodeLib.ParsedGmxWire memory wire = this.decodeMulticall(multicallData);
        assertEq(uint8(wire.kind), uint8(GmxMulticallDecodeLib.WireKind.Deposit));
        assertEq(wire.executionFee, 1e15);
        assertEq(wire.minMarketTokens, 9_900_000);
        assertEq(wire.legCount, 3);
    }

    function test_CollectErrors_LowExecutionFee() public pure {
        GmxMulticallDecodeLib.ParsedGmxWire memory wire = GmxMulticallDecodeLib.ParsedGmxWire({
            kind: GmxMulticallDecodeLib.WireKind.Deposit,
            executionFee: 1,
            minMarketTokens: 9_900_000,
            minLongTokenAmount: 0,
            minShortTokenAmount: 0,
            legCount: 3
        });
        GmxRiskInvariantLib.GmxWireContext memory ctx;
        uint256 errMask = GmxRiskInvariantLib.collectWireErrors(wire, ctx);
        assertEq(errMask, GmxRiskInvariantLib.ERR_EXECUTION_FEE);
    }

    function test_PolicyGuard_PassesHealthyDepositWire() public {
        (bytes memory multicallData, GmxRiskInvariantLib.GmxWireContext memory ctx) = _loadFixture();
        uint256 ttl = block.timestamp + 30;
        bytes32 digest = guard.checkAgentPolicyWithGmxWire(AGENT, NOTIONAL, ttl, multicallData, ctx);
        assertTrue(digest != bytes32(0));
    }

    function test_PolicyGuard_RevertsOnSlippageFloorBreach() public {
        (bytes memory multicallData, GmxRiskInvariantLib.GmxWireContext memory ctx) = _loadFixture();
        ctx.expectedMarketTokens = 11_000_000;
        ctx.slippageBps = 100;
        uint256 ttl = block.timestamp + 30;
        vm.expectRevert(
            abi.encodeWithSelector(
                SliverVineAgentPolicyGuardV2.GmxInvariantTripped.selector, GmxRiskInvariantLib.ERR_MIN_MARKET_TOKENS
            )
        );
        guard.checkAgentPolicyWithGmxWire(AGENT, NOTIONAL, ttl, multicallData, ctx);
    }

    function test_PolicyGuard_RevertsOnPoolImbalance() public {
        (bytes memory multicallData, GmxRiskInvariantLib.GmxWireContext memory ctx) = _loadFixture();
        ctx.poolLongUsd = 7_000_000;
        ctx.poolShortUsd = 3_000_000;
        uint256 ttl = block.timestamp + 30;
        vm.expectRevert(
            abi.encodeWithSelector(
                SliverVineAgentPolicyGuardV2.GmxInvariantTripped.selector, GmxRiskInvariantLib.ERR_POOL_IMBALANCE
            )
        );
        guard.checkAgentPolicyWithGmxWire(AGENT, NOTIONAL, ttl, multicallData, ctx);
    }

    function test_PolicyGuard_RevertsOnReorderedLegs() public {
        (bytes memory multicallData, GmxRiskInvariantLib.GmxWireContext memory ctx) = _loadFixture();
        bytes memory reordered = _swapDepositLegs(multicallData);
        uint256 ttl = block.timestamp + 30;
        vm.expectRevert(GmxMulticallDecodeLib.LegOrder.selector);
        guard.checkAgentPolicyWithGmxWire(AGENT, NOTIONAL, ttl, reordered, ctx);
    }

    function decodeMulticall(bytes calldata data)
        external
        pure
        returns (GmxMulticallDecodeLib.ParsedGmxWire memory)
    {
        return GmxMulticallDecodeLib.parseMulticall(data);
    }

    function _swapDepositLegs(bytes memory data) private pure returns (bytes memory) {
        // Swap bytes[0] and bytes[1] offsets in the multicall header (words at 68 and 100).
        for (uint256 i; i < 32; ++i) {
            (bytes1 a, bytes1 b) = (data[68 + i], data[100 + i]);
            data[68 + i] = b;
            data[100 + i] = a;
        }
        return data;
    }
}
