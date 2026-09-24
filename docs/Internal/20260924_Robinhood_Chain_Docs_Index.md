# Robinhood Chain Official Docs Index (Internal)

**Base URL:** https://docs.robinhood.com/chain/  
**Crawl date:** 2026-09-24  
**Pages crawled:** 19  
**Note:** Not the root [docs.robinhood.com](https://docs.robinhood.com/) Crypto Trading API.

| Path | Title | One-line summary |
|------|-------|------------------|
| [/chain/](https://docs.robinhood.com/chain/) | About Robinhood Chain | Permissionless Arbitrum L2 for RWAs; ETH gas; FCFS sequencing; ecosystem partner table |
| [/chain/connecting](https://docs.robinhood.com/chain/connecting) | Connecting | Chain IDs 4663/46630; Alchemy RPC recommended; public endpoints; bridge entry |
| [/chain/add-network-to-wallet](https://docs.robinhood.com/chain/add-network-to-wallet) | Add network to wallet | Robinhood Wallet + third-party wallet network config |
| [/chain/bridging](https://docs.robinhood.com/chain/bridging) | Bridging | Canonical Arbitrum bridge + LayerZero, CCIP, Relay, **Across**, LiFi/0x |
| [/chain/stock-tokens](https://docs.robinhood.com/chain/stock-tokens) | Stock Tokens | Tokenised debt securities (RHJ); primary permissioned, DEX secondary |
| [/chain/building-with-stock-tokens](https://docs.robinhood.com/chain/building-with-stock-tokens) | Building with Stock Tokens | ERC-20 patterns + Chainlink feeds; `uiMultiplier()` for corporate actions |
| [/chain/stock-token-apis](https://docs.robinhood.com/chain/stock-token-apis) | Stock Token APIs | Read-only REST at `api.robinhood.com/rhj/` |
| [/chain/differences-from-ethereum](https://docs.robinhood.com/chain/differences-from-ethereum) | Differences from Ethereum | ArbSys block numbers; sequencer screening; FCFS ordering; 96KB contract limit |
| [/chain/gas-and-fees](https://docs.robinhood.com/chain/gas-and-fees) | Gas & Fees | L2 execution + L1 data fee; ETH native token |
| [/chain/transaction-finality](https://docs.robinhood.com/chain/transaction-finality) | Transaction Finality | Soft sequencer confirm → hard Ethereum finality |
| [/chain/contracts](https://docs.robinhood.com/chain/contracts) | Token Contracts | Stock token + ETF contract addresses |
| [/chain/protocol-contracts](https://docs.robinhood.com/chain/protocol-contracts) | Protocol Contracts | L1/L2 bridge, gateway, Arb precompile addresses |
| [/chain/deploy-smart-contracts](https://docs.robinhood.com/chain/deploy-smart-contracts) | Deploy a Contract | Foundry/Hardhat deploy + Blockscout verify |
| [/chain/account-abstraction](https://docs.robinhood.com/chain/account-abstraction) | Account Abstraction | ERC-4337 + EIP-7702; Alchemy primary, **ZeroDev** alternative; EP 0.6/0.7/0.8 addresses |
| [/chain/cross-chain-messaging](https://docs.robinhood.com/chain/cross-chain-messaging) | Cross-Chain Messaging | L1↔L2 retryable tickets via Arbitrum SDK; 7-day challenge for L2→L1 |
| [/chain/oracles-and-price-feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) | Oracles & Price Feeds | Chainlink AggregatorV3; stock feeds 24/5; sequencer uptime check |
| [/chain/data-streams](https://docs.robinhood.com/chain/data-streams) | Data Streams | Chainlink pull-based sub-second market data |
| [/chain/lighter-domains](https://docs.robinhood.com/chain/lighter-domains) | Lighter Domains | Independent Lighter instances with separate execution/liquidity |
| [/chain/run-a-full-node](https://docs.robinhood.com/chain/run-a-full-node) | Run a full node | Arbitrum Nitro node deployment and sync |

## Key constants (SSOT)

| Property | Mainnet | Testnet |
|----------|---------|---------|
| Chain ID | 4663 | 46630 |
| Currency | ETH | ETH |
| Explorer | robinhoodchain.blockscout.com | explorer.testnet.chain.robinhood.com |
| Public RPC | rpc.mainnet.chain.robinhood.com | rpc.testnet.chain.robinhood.com |
| Alchemy RPC | robinhood-mainnet.g.alchemy.com/v2/{KEY} | robinhood-testnet.g.alchemy.com/v2/{KEY} |
| EntryPoint v0.7 | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 | same |
| ZeroDev RPC pattern | rpc.zerodev.app/api/v3/{PROJECT}/chain/4663 | — |
| Builder email | chain-developers-group@robinhood.com | — |

## Sidebar sections not crawled separately

All sidebar links under `/chain/` were covered in this crawl. No additional hidden pages discovered.
