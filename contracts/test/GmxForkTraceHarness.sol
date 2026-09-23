// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {GmxForkRevertDecoder} from "./GmxForkRevertDecoder.sol";
import {GmxForkRevertAnalyze} from "./GmxForkRevertAnalyze.sol";
import {GmxForkTraceJsonWriter} from "./GmxForkTraceJsonWriter.sol";

/// @notice Shared fork trace probe runner for micro-fill and GM withdraw fixtures.
abstract contract GmxForkTraceHarness is Test {
    using stdJson for string;
    using GmxForkRevertDecoder for bytes;
    using GmxForkRevertAnalyze for bytes;

    address internal constant ROUTER = 0x7dE39FF2e232A2203196788d37e234cF8F1b83f1;
    address internal constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address internal constant GM_TOKEN = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
    address internal constant WALLET_B = 0xbd65d785Dac74EBa9efFdB357b2dC52fCC26EC7F;
    string internal constant ARTIFACT = "artifacts/gmx_fork_trace.json";
    string internal constant MICRO_FILL_ARTIFACT = "artifacts/gmx_micro_fill_fork_trace.json";

    function _runForkTrace(
        string memory fixtureRelPath,
        string memory artifactRelPath,
        string[3] memory legNames,
        bool requireGmBalance
    ) internal {
        (address eoa, bytes memory data, uint256 value, bytes[] memory legs, uint256 gmRequired) =
            _loadFixture(string.concat(vm.projectRoot(), "/", fixtureRelPath));

        if (eoa.balance < value) vm.deal(eoa, value + 1 ether);

        GmxForkTraceJsonWriter.TraceReport memory report;
        report.router = ROUTER;
        report.eoa = eoa;
        report.fixturePath = fixtureRelPath;
        report.msgValue = value;
        report.ethBalance = eoa.balance;
        report.usdcBalance = IERC20(USDC).balanceOf(eoa);
        report.usdcAllowance = IERC20(USDC).allowance(eoa, ROUTER);
        report.gmTokenBalance = IERC20(GM_TOKEN).balanceOf(eoa);
        report.gmTokenAmount = gmRequired;
        if (requireGmBalance) {
            require(eoa == WALLET_B, "GMX_FORK_EOA");
            require(report.gmTokenBalance >= gmRequired, "GMX_FORK_GM_BALANCE");
        }

        vm.startPrank(eoa);
        uint256 snap = vm.snapshotState();
        report = _probeLegs(report, legs, value, legNames);
        vm.revertToState(snap);
        report = _probeFunding(report, legs, value, legNames[2]);
        vm.revertToState(snap);
        report.multicall = _routerProbe("multicall", value, data);
        vm.stopPrank();

        _logBalances(eoa, value, report.gmTokenBalance);
        if (report.multicall.ok) console2.log("[gmx-fork] multicall SUCCESS");
        GmxForkTraceJsonWriter.write(string.concat(vm.projectRoot(), "/", artifactRelPath), report);
        console2.log("[gmx-fork] wrote", artifactRelPath);
    }

    function _routerProbe(string memory label, uint256 value, bytes memory data)
        internal
        returns (GmxForkTraceJsonWriter.ProbeResult memory probe)
    {
        probe.label = label;
        uint256 gasBefore = gasleft();
        bytes memory returndata;
        (probe.ok, returndata) = ROUTER.call{value: value}(data);
        probe.gasUsed = gasBefore - gasleft();
        if (!probe.ok) {
            probe.revertInfo = returndata.analyze();
            returndata.logReturndata(label);
        }
    }

    function _appendProbe(
        GmxForkTraceJsonWriter.TraceReport memory report,
        GmxForkTraceJsonWriter.ProbeResult memory probe
    ) internal pure returns (GmxForkTraceJsonWriter.TraceReport memory) {
        report.probes[report.probeCount] = probe;
        report.probeCount++;
        return report;
    }

    function _probeLegs(
        GmxForkTraceJsonWriter.TraceReport memory report,
        bytes[] memory legs,
        uint256 fee,
        string[3] memory names
    ) internal returns (GmxForkTraceJsonWriter.TraceReport memory) {
        for (uint256 i = 0; i < legs.length; i++) {
            if (i == 2) {
                report = _appendProbe(report, _routerProbe(string.concat("leg ", names[i]), 0, legs[i]));
                continue;
            }
            report = _appendProbe(report, _routerProbe(string.concat("leg ", names[i]), i == 0 ? fee : 0, legs[i]));
        }
        return report;
    }

    function _probeFunding(
        GmxForkTraceJsonWriter.TraceReport memory report,
        bytes[] memory legs,
        uint256 fee,
        string memory createLeg
    ) internal returns (GmxForkTraceJsonWriter.TraceReport memory) {
        bytes[] memory fund = new bytes[](2);
        fund[0] = legs[0];
        fund[1] = legs[1];
        report = _appendProbe(
            report, _routerProbe("fundMulticall", fee, abi.encodeWithSignature("multicall(bytes[])", fund))
        );
        report = _appendProbe(report, _routerProbe(string.concat(createLeg, " after funding"), 0, legs[2]));
        return report;
    }

    function _loadFixture(string memory path)
        internal
        view
        returns (address eoa, bytes memory data, uint256 value, bytes[] memory legs, uint256 gmRequired)
    {
        string memory json = vm.readFile(path);
        eoa = json.readAddress(".eoa");
        data = json.readBytes(".multicallData");
        value = json.readUint(".msgValue");
        gmRequired = json.keyExists(".marketTokenAmount") ? json.readUint(".marketTokenAmount") : 0;
        string[] memory hexLegs = json.readStringArray(".calls");
        legs = new bytes[](hexLegs.length);
        for (uint256 i = 0; i < hexLegs.length; i++) {
            legs[i] = vm.parseBytes(hexLegs[i]);
        }
    }

    function _logBalances(address eoa, uint256 value, uint256 gmBal) internal view {
        console2.log("[gmx-fork] EOA", eoa);
        console2.log("[gmx-fork] ETH", eoa.balance);
        console2.log("[gmx-fork] USDC", IERC20(USDC).balanceOf(eoa));
        console2.log("[gmx-fork] GM", gmBal);
        console2.log("[gmx-fork] allowance(router)", IERC20(USDC).allowance(eoa, ROUTER));
        console2.log("[gmx-fork] msg.value", value);
    }
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}
