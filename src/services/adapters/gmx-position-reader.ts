/** GMX v2 Reader — on-chain position preflight for MarketDecrease sizing. */
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { GMX_V2_DATASTORE, GMX_V2_READER_ARBITRUM } from "../../adapters/gmx";
import type { GmxV2UnsignedOrderPayload } from "./gmx-v2-adapter.types";
import {
  GMX_READER_POSITION_ABI,
  type GmxReaderPosition,
  type GmxReaderPositionTuple,
} from "./gmx-reader-position-abi";

export type { GmxReaderPosition } from "./gmx-reader-position-abi";

export function hashGmxPositionKey(
  account: Address,
  market: Address,
  collateralToken: Address,
  isLong: boolean,
): Hex {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("address, address, address, bool"), [
      getAddress(account),
      getAddress(market),
      getAddress(collateralToken),
      isLong,
    ]),
  );
}

function mapReaderPosition(key: Hex, row: GmxReaderPositionTuple): GmxReaderPosition {
  return {
    account: getAddress(row.addresses.account),
    market: getAddress(row.addresses.market),
    collateralToken: getAddress(row.addresses.collateralToken),
    sizeInUsd: row.numbers.sizeInUsd,
    sizeInTokens: row.numbers.sizeInTokens,
    collateralAmount: row.numbers.collateralAmount,
    isLong: row.flags.isLong,
    positionKey: key,
  };
}

export async function fetchGmxPositionFromReader(
  client: Pick<PublicClient, "readContract">,
  input: {
    account: Address;
    market: Address;
    collateralToken: Address;
    isLong: boolean;
    dataStore?: Address;
    reader?: Address;
  },
): Promise<GmxReaderPosition | null> {
  const dataStore = (input.dataStore ?? GMX_V2_DATASTORE) as Address;
  const reader = (input.reader ?? GMX_V2_READER_ARBITRUM) as Address;
  const key = hashGmxPositionKey(input.account, input.market, input.collateralToken, input.isLong);
  const row = await client.readContract({
    address: reader,
    abi: GMX_READER_POSITION_ABI,
    functionName: "getPosition",
    args: [dataStore, key],
  }) as GmxReaderPositionTuple;
  if (row.numbers.sizeInUsd <= 0n) return null;
  return mapReaderPosition(key, row);
}

export async function fetchGmxAccountPositionsFromReader(
  client: Pick<PublicClient, "readContract">,
  account: Address,
  end = 32,
): Promise<GmxReaderPosition[]> {
  const rows = await client.readContract({
    address: GMX_V2_READER_ARBITRUM as Address,
    abi: GMX_READER_POSITION_ABI,
    functionName: "getAccountPositions",
    args: [GMX_V2_DATASTORE as Address, account, 0n, BigInt(end)],
  }) as GmxReaderPositionTuple[];
  return rows
    .filter((row) => row.numbers.sizeInUsd > 0n)
    .map((row) => mapReaderPosition(
      hashGmxPositionKey(
        row.addresses.account,
        row.addresses.market,
        row.addresses.collateralToken,
        row.flags.isLong,
      ),
      row,
    ));
}

export async function resolveGmxDecreasePositionPreflight(
  client: Pick<PublicClient, "readContract">,
  input: {
    account: Address;
    market: Address;
    collateralToken: Address;
    isLong: boolean;
  },
): Promise<GmxReaderPosition> {
  const direct = await fetchGmxPositionFromReader(client, input);
  if (direct) return direct;
  const positions = await fetchGmxAccountPositionsFromReader(client, input.account);
  const hit = positions.find((p) =>
    getAddress(p.market) === getAddress(input.market)
    && getAddress(p.collateralToken) === getAddress(input.collateralToken)
    && p.isLong === input.isLong
    && p.sizeInUsd > 0n,
  );
  if (!hit) {
    throw new Error(
      `GMX_POSITION_NOT_FOUND: no open position for ${input.account} market=${input.market} collateral=${input.collateralToken} isLong=${input.isLong}`,
    );
  }
  return hit;
}

export function applyGmxDecreasePositionSizing(
  payload: GmxV2UnsignedOrderPayload,
  position: GmxReaderPosition,
): GmxV2UnsignedOrderPayload {
  if (position.sizeInUsd <= 0n) throw new Error("GMX_DECREASE_SIZE_ZERO: position sizeInUsd is 0");
  return {
    ...payload,
    isLong: position.isLong,
    numbers: {
      ...payload.numbers,
      sizeDeltaUsd: position.sizeInUsd.toString(),
      initialCollateralDeltaAmount: "0",
    },
  };
}
