/**
 * v1.5 stub — TWAP / VWAP Engine V2 with 30-path routing slots (mainnet upgrade reserved).
 */

export const TWAP_PATH_SLOT_COUNT = 30 as const;

export type TwapPathVenue =
  | "hyperliquid"
  | "jupiter"
  | "gmx"
  | "dydx"
  | "internal_buffer";

export interface TwapPathRoute {
  /** 1..TWAP_PATH_SLOT_COUNT */
  pathId: number;
  venue: TwapPathVenue;
  weightBps: number;
  maxSliceUsd: number;
  vwapAnchor: boolean;
}

export interface TwapPlanInput {
  symbol: string;
  totalNotionalUsd: number;
  horizonMs: number;
  preferVwap: boolean;
}

export interface TwapSliceResult {
  pathId: number;
  filledUsd: number;
  status: "STAGED" | "SKIPPED" | "STUB";
}

/**
 * Abstract 30-path TWAP/VWAP planner — concrete venue adapters plug in later.
 */
export abstract class TWAPEngineV2 {
  readonly pathSlots: typeof TWAP_PATH_SLOT_COUNT = TWAP_PATH_SLOT_COUNT;

  abstract planRoutes(input: TwapPlanInput): TwapPathRoute[];

  abstract executeSlice(
    route: TwapPathRoute,
    sliceUsd: number,
  ): Promise<TwapSliceResult>;

  /** Allocate equal residual weight across unused path ids (stub helper). */
  protected fillIdlePaths(
    active: TwapPathRoute[],
    defaultVenue: TwapPathVenue = "internal_buffer",
  ): TwapPathRoute[] {
    const used = new Set(active.map((r) => r.pathId));
    const out = [...active];
    for (let id = 1; id <= TWAP_PATH_SLOT_COUNT; id += 1) {
      if (used.has(id)) continue;
      out.push({
        pathId: id,
        venue: defaultVenue,
        weightBps: 0,
        maxSliceUsd: 0,
        vwapAnchor: false,
      });
    }
    return out.sort((a, b) => a.pathId - b.pathId);
  }
}

/** Dark-staging stub — three live-weight paths + 27 idle slots. */
export class TwapEngineV2Stub extends TWAPEngineV2 {
  planRoutes(input: TwapPlanInput): TwapPathRoute[] {
    const notion = Math.max(0, input.totalNotionalUsd);
    void input.symbol;
    void input.horizonMs;
    const primary: TwapPathRoute[] = [
      {
        pathId: 1,
        venue: "hyperliquid",
        weightBps: input.preferVwap ? 4_500 : 5_500,
        maxSliceUsd: notion * 0.2,
        vwapAnchor: input.preferVwap,
      },
      {
        pathId: 2,
        venue: "jupiter",
        weightBps: 2_500,
        maxSliceUsd: notion * 0.15,
        vwapAnchor: false,
      },
      {
        pathId: 3,
        venue: "gmx",
        weightBps: input.preferVwap ? 3_000 : 2_000,
        maxSliceUsd: notion * 0.15,
        vwapAnchor: input.preferVwap,
      },
    ];
    return this.fillIdlePaths(primary);
  }

  async executeSlice(
    route: TwapPathRoute,
    sliceUsd: number,
  ): Promise<TwapSliceResult> {
    if (route.weightBps <= 0 || sliceUsd <= 0) {
      return { pathId: route.pathId, filledUsd: 0, status: "SKIPPED" };
    }
    return {
      pathId: route.pathId,
      filledUsd: Math.min(sliceUsd, route.maxSliceUsd),
      status: "STUB",
    };
  }
}

/**
 * Phase-4 weapon — all 30 path slots carry live weight (equal residual split).
 * Smaller maxSliceUsd → finer icebergs vs Base 3-path stub.
 */
export class TwapEngineV2Full30 extends TWAPEngineV2 {
  planRoutes(input: TwapPlanInput): TwapPathRoute[] {
    const notion = Math.max(0, input.totalNotionalUsd);
    const perBps = Math.floor(10_000 / TWAP_PATH_SLOT_COUNT);
    const venues: TwapPathVenue[] = [
      "hyperliquid",
      "jupiter",
      "gmx",
      "dydx",
      "internal_buffer",
    ];
    const routes: TwapPathRoute[] = [];
    let bpsLeft = 10_000;
    for (let id = 1; id <= TWAP_PATH_SLOT_COUNT; id += 1) {
      const weightBps =
        id === TWAP_PATH_SLOT_COUNT ? bpsLeft : Math.min(perBps, bpsLeft);
      bpsLeft -= weightBps;
      routes.push({
        pathId: id,
        venue: venues[(id - 1) % venues.length]!,
        weightBps,
        maxSliceUsd: notion / TWAP_PATH_SLOT_COUNT,
        vwapAnchor: input.preferVwap && id % 5 === 1,
      });
    }
    return routes;
  }

  async executeSlice(
    route: TwapPathRoute,
    sliceUsd: number,
  ): Promise<TwapSliceResult> {
    if (route.weightBps <= 0 || sliceUsd <= 0) {
      return { pathId: route.pathId, filledUsd: 0, status: "SKIPPED" };
    }
    return {
      pathId: route.pathId,
      filledUsd: Math.min(sliceUsd, route.maxSliceUsd),
      status: "STUB",
    };
  }
}
