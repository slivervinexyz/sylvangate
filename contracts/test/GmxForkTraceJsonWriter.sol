// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.28;

import {stdJson} from "forge-std/StdJson.sol";
import {GmxForkRevertAnalyze} from "./GmxForkRevertAnalyze.sol";

/// @notice Serialize GMX fork probe results to `artifacts/gmx_fork_trace.json`.
library GmxForkTraceJsonWriter {
    using stdJson for string;

    struct ProbeResult {
        string label;
        bool ok;
        uint256 gasUsed;
        GmxForkRevertAnalyze.ForkRevertInfo revertInfo;
    }

    struct TraceReport {
        address eoa;
        address router;
        string fixturePath;
        uint256 msgValue;
        uint256 ethBalance;
        uint256 usdcBalance;
        uint256 usdcAllowance;
        uint256 gmTokenBalance;
        uint256 gmTokenAmount;
        uint256 probeCount;
        ProbeResult[8] probes;
        ProbeResult multicall;
    }

    function write(string memory path, TraceReport memory report) internal {
        string memory rootKey = "gmxForkTraceRoot";

        string memory metaKey = "gmxForkTraceMeta";
        metaKey.serialize("chainId", block.chainid);
        metaKey.serialize("blockNumber", block.number);
        metaKey.serialize("router", report.router);
        metaKey.serialize("eoa", report.eoa);
        metaKey.serialize("fixture", report.fixturePath);
        string memory metaFinal = metaKey.serialize("msgValue", report.msgValue);
        rootKey.serialize("meta", metaFinal);

        string memory balKey = "gmxForkTraceBalances";
        balKey.serialize("ethWei", report.ethBalance);
        balKey.serialize("usdc", report.usdcBalance);
        balKey.serialize("gmToken", report.gmTokenBalance);
        balKey.serialize("gmTokenAmount", report.gmTokenAmount);
        string memory balFinal = balKey.serialize("usdcAllowanceRouter", report.usdcAllowance);
        rootKey.serialize("balances", balFinal);

        for (uint256 i = 0; i < report.probeCount; i++) {
            string memory probeFinal = _buildProbeJson(report.probes[i], i);
            rootKey.serialize(string.concat("probes[", _dec(i), "]"), probeFinal);
        }

        string memory mcFinal = _buildProbeJson(report.multicall, 999);
        string memory finalJson = rootKey.serialize("multicall", mcFinal);
        finalJson.write(path);
    }

    function _buildProbeJson(ProbeResult memory probe, uint256 salt) private returns (string memory) {
        string memory probeKey = string.concat("gmxProbe", _dec(salt));
        probeKey.serialize("label", probe.label);
        probeKey.serialize("ok", probe.ok);
        string memory probeFinal = probeKey.serialize("gasUsed", probe.gasUsed);
        if (!probe.ok) {
            string memory revKey = string.concat("gmxRevert", _dec(salt));
            GmxForkRevertAnalyze.ForkRevertInfo memory r = probe.revertInfo;
            revKey.serialize("selector", r.selectorHex);
            revKey.serialize("errorName", r.errorName);
            revKey.serialize("decoded", r.decoded);
            revKey.serialize("argsJson", r.argsJson);
            revKey.serialize("returndataHex", r.returndataHex);
            string memory revFinal = revKey.serialize("returndataLen", r.returndataLen);
            probeFinal = probeKey.serialize("revert", revFinal);
        }
        return probeFinal;
    }

    function _dec(uint256 value) private pure returns (string memory) {
        if (value == 999) return "mc";
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
