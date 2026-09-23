import type {
  ExchangeAdapter,
  MarketDataSnapshot,
  OrderPayload,
  OrderPayloadInput,
  OrderSlippageInput,
  OrderSlippageResult,
} from "./exchange-adapter";
import { evaluateOrderSlippage } from "./exchange-adapter";
import { HL_EXCHANGE_URL } from "../../config/constants";
import type { HyperliquidParseBundle } from "./hl-types";
import { UA_HEADERS } from "./hl-adapter-class-lib/hl-adapter-class-helpers";
import { fetchHyperliquidClassifiedBundle } from "./hl-adapter-class-lib/hl-adapter-class-fetch";

export class HyperliquidAdapter implements ExchangeAdapter {
  readonly id = "hyperliquid" as const;
  readonly displayName = "Hyperliquid";

  private lastBundle: HyperliquidParseBundle | null = null;

  getLastBundle(): HyperliquidParseBundle | null {
    return this.lastBundle;
  }

  async fetchMarketData(): Promise<MarketDataSnapshot> {
    const bundle = await this.fetchClassifiedBundle();
    return bundle.snapshot;
  }

  async fetchClassifiedBundle(): Promise<HyperliquidParseBundle> {
    const bundle = await fetchHyperliquidClassifiedBundle(this.lastBundle);
    this.lastBundle = bundle;
    return bundle;
  }

  calculateOrderSlippage(input: OrderSlippageInput): OrderSlippageResult {
    return evaluateOrderSlippage(input);
  }

  buildOrderPayload(input: OrderPayloadInput): OrderPayload {
    const isBuy = input.side === "buy";
    const size = input.sizeUsd;
    const price = input.limitPrice ?? 0;
    const symbol = input.symbol.toUpperCase();

    return {
      exchangeId: "hyperliquid",
      symbol,
      side: input.side,
      endpoint: HL_EXCHANGE_URL,
      method: "POST",
      headers: { "Content-Type": "application/json", ...UA_HEADERS },
      body: {
        type: "order",
        orders: [
          {
            a: symbol,
            b: isBuy,
            p: String(price),
            s: String(size),
            r: input.reduceOnly ?? false,
            t: { limit: { tif: "Ioc" } },
          },
        ],
      },
    };
  }
}

export const hyperliquidAdapter = new HyperliquidAdapter();
