import { parseIngressChain, queryYieldTriangle } from "../../services/yield-router";
import { resolveYieldIngressChain, applyEngineModeResponseHeaders, parseEngineModeHeader } from "../../middleware/engine-mode-router";

const SYMBOL_PATTERN = /^[A-Za-z0-9]{2,12}$/;

/**
 * GET /api/yield/triangle?symbol=ETH&ingressChain=SOLANA|ARBITRUM&stakedHype=1000
 * Read-path yield triangle with 2PC gate status + HYPE staking discount.
 */
export async function handleYieldTriangleRequest(
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const rawSymbol = url.searchParams.get("symbol") ?? "ETH";
  const symbol = rawSymbol.trim().toUpperCase();
  const ingressChain = parseIngressChain(
    resolveYieldIngressChain(request, url.searchParams.get("ingressChain")),
  );
  const stakedRaw = url.searchParams.get("stakedHype");
  const stakedParsed =
    stakedRaw !== null && stakedRaw !== ""
      ? Math.max(0, parseFloat(stakedRaw))
      : 0;
  const stakedHypeAmount = Number.isFinite(stakedParsed) ? stakedParsed : 0;

  if (!SYMBOL_PATTERN.test(symbol)) {
    return Response.json(
      { error: "INVALID_SYMBOL", symbol: rawSymbol },
      { status: 400 },
    );
  }

  try {
    const payload = await queryYieldTriangle(symbol, {
      ingressChain,
      stakedHypeAmount,
    });
    return applyEngineModeResponseHeaders(
      Response.json(payload, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=5",
        },
      }),
      parseEngineModeHeader(request),
    );
  } catch (err) {
    return Response.json(
      {
        error: "YIELD_TRIANGLE_FAILED",
        symbol,
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
