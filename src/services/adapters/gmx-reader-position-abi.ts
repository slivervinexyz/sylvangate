/** GMX v2 Reader ABI slice — getPosition / getAccountPositions. */
import type { Address, Hex } from "viem";

const GMX_READER_POSITION_TUPLE_COMPONENTS = [
  {
    name: "addresses",
    type: "tuple",
    components: [
      { name: "account", type: "address" },
      { name: "market", type: "address" },
      { name: "collateralToken", type: "address" },
    ],
  },
  {
    name: "numbers",
    type: "tuple",
    components: [
      { name: "sizeInUsd", type: "uint256" },
      { name: "sizeInTokens", type: "uint256" },
      { name: "collateralAmount", type: "uint256" },
      { name: "pendingImpactAmount", type: "int256" },
      { name: "borrowingFactor", type: "uint256" },
      { name: "fundingFeeAmountPerSize", type: "uint256" },
      { name: "longTokenClaimableFundingAmountPerSize", type: "uint256" },
      { name: "shortTokenClaimableFundingAmountPerSize", type: "uint256" },
      { name: "increasedAtTime", type: "uint256" },
      { name: "decreasedAtTime", type: "uint256" },
    ],
  },
  {
    name: "flags",
    type: "tuple",
    components: [{ name: "isLong", type: "bool" }],
  },
];

export const GMX_READER_POSITION_ABI = [
  {
    name: "getPosition",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dataStore", type: "address" },
      { name: "key", type: "bytes32" },
    ],
    outputs: [{ type: "tuple", components: GMX_READER_POSITION_TUPLE_COMPONENTS }],
  },
  {
    name: "getAccountPositions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dataStore", type: "address" },
      { name: "account", type: "address" },
      { name: "start", type: "uint256" },
      { name: "end", type: "uint256" },
    ],
    outputs: [{ type: "tuple[]", components: GMX_READER_POSITION_TUPLE_COMPONENTS }],
  },
] as const;

export type GmxReaderPositionTuple = {
  addresses: { account: Address; market: Address; collateralToken: Address };
  numbers: {
    sizeInUsd: bigint;
    sizeInTokens: bigint;
    collateralAmount: bigint;
    pendingImpactAmount: bigint;
    borrowingFactor: bigint;
    fundingFeeAmountPerSize: bigint;
    longTokenClaimableFundingAmountPerSize: bigint;
    shortTokenClaimableFundingAmountPerSize: bigint;
    increasedAtTime: bigint;
    decreasedAtTime: bigint;
  };
  flags: { isLong: boolean };
};

export type GmxReaderPosition = {
  account: Address;
  market: Address;
  collateralToken: Address;
  sizeInUsd: bigint;
  sizeInTokens: bigint;
  collateralAmount: bigint;
  isLong: boolean;
  positionKey: Hex;
};
