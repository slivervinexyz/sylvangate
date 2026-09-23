/** GET /api/yield/triangle — Worker-edge stub. */
import { CORS_JSON_HEADERS } from "../../services/config";

export function handleYieldTriangleRequestLean(request: Request): Response {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "ETH").toUpperCase();
  return new Response(
    JSON.stringify({
      success: true,
      symbol,
      ingressChain: "ARBITRUM",
      yieldTriangle: { baseApy: 0, hedgeApy: 0, netApy: 0 },
      gateStatus: "STANDBY",
      source: "worker-edge-stub",
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: CORS_JSON_HEADERS },
  );
}
