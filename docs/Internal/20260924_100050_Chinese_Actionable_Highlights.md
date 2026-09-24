# 中文精華 — 真係有用比我哋 Robinhood Sentinel Escort SKU

**來源：** Arbitrum Open House × Robinhood Chain（Gaetan, ~51min）  
**對照 repo：** [`README.md`](../../README.md) · `@slivervine/robinhood-sentinel-escort`  
**日期：** 2026-09-24

> 呢條片係 **ecosystem / GTM session**，冇講 Kernel、UserOp、4663。下面只抽 **同我哋 codebase 有直接關係** 嘅 actionable 精華。

---

## 即刻要做（Buildathon / Judge）

1. **Open House Singapore 申請截止 10月4日** — 片尾 Benjamin 明講；top teams 去 Founder House Singapore（10月23–25日）同 Robinhood 一齊。我哋 pitch 要 fit **RWA + democratizing finance**，唔係 generic DeFi meme。
2. **話術三條對齊 README Hero paths：**
   - **Hero 1 Kernel Escort** `4663 → 42161` — Gaetan 強調 Arbitrum 係 core technical partner；我哋 outbound escort 係順勢，唔係自創 narrative。
   - **Hero 2 Permissioned Airlock** — 佢講 sanctioned wallet addresses、stock tokens 地域限制（US/CA/UK/CH 禁）；我哋 `AML_INBOUND_TO_ROBINHOOD_BLOCKED` 係 **chain-id boundary predicate**，唔係 sanctions scanner — judge 問就要 honest footnote。
   - **Hero 3 SHA-256 Audit Cert** — 佢唔會俾 legal advice，叫你去睇 official docs + prospectus；我哋 `buildRobinhoodAuditSnapshot` 係 **immutable decision artifact**，呢個 positioning 啱。
3. **Run demo 順序：** `pnpm demo:robinhood-sentinel` → 三條 hero 一次過；live-fire 指去 `docs/logging/ROBINHOOD_LIVEFIRE_ARTIFACTS.md`，唔好 claim 片入面嘅 $75B DEX volume。
4. **唔好求 Robinhood retweet** — Gaetan 明講 public company liability，99% 項目唔會 social endorse。轉向 **technical + Open House merit track**。

---

## 話術對齊（Audio → Code）

| 佢哋講乜 | 我哋點接 |
|---------|---------|
| 「10-year strategic pillar，唔係 6-month experiment」 | Chain escort 係 long-horizon infra；`treasury-escort-router.ts` decision layer `contractDeployed: false` 要講清楚係 **decision-ready, not deployed vault** |
| 「98% on-chain addresses 唔係 app 用戶」 | 外部 builder / institution 會直接 interact chain — 我哋 **outbound escort + inbound block** 係 institutional guard，唔係 retail wallet plugin |
| Robinhood Earn → Morpho / USDG lending | 呼應 `quoteRChainYieldToArbitrumGm()` — Robinhood idle/RWA capital → **42161 GM pool** yield path |
| 「7-day liquidity 係最大 challenge」 | 呼應 `across-ingress-bridge.ts`：`IN_FLIGHT_BRIDGE_CAPITAL`、pending capital **`lostUsd ≡ 0`** — capital in-flight 唔 book phantom loss |
| Hyperdash-class orderflow / liquidation visibility（4663 缺口） | 呼應 Blueprint 3：`buildRobinhoodAuditSnapshot` + `[HYPERDASH-RISK-FEED]` 格式化 — **decision-only**，無 UI ship；public 見 README Complement — Treasury Escort & Audit Terminal |
| Primary market permissioned，DEX permissionless（合規前提下） | 呼應 **unidirectional bridge** — inbound `42161→4663` fail-closed；outbound only |
| Partner MetaMask / 其他 non-custodial wallet | **唔等於** 我哋 SKU 係 EIP-1193 middleware — README honest footnote：B1/B3 係 **decision probe · 0 broadcast** |
| 「No foundation, no token, no grants」 — 只 support Open House selected builders | 我哋 SKU 定位：**institutional escort decision layer**，唔靠 grant tokenomics story |

---

## 技術修正（Audio vs Code — 避免 judge 捉到）

| 風險 | 正確說法 |
|------|---------|
| 片冇提 4663 / 46630 / ZeroDev | 唔好暗示 Robinhood official 認證我哋 Kernel integration；用 **live-fire archived tx** + explorer links（README table） |
| `pnpm demo:robinhood-sentinel` = policy replay | 同 README honest footnotes 一致；**唔係** re-broadcast archived txs |
| A-Tier2-mainnet `bridgeDeployed: false` stub attestation | 唔好 claim production cross-chain bridge buffer |
| Inbound block = chain-id predicate | 唔好話做咗 AML/KYC scanning — code 係 `AML_INBOUND_TO_ROBINHOOD_BLOCKED` policy code |
| Stock token 做 DeFi collateral（周末 price frozen） | Gaetan **拒絕答 legal** — 我哋唔好 extend 到 stock-token lending；stay in **treasury escort + ingress gate** lane |
| B3 treasury probe `RWA_YIELD_SOURCE_CHAIN_UNSUPPORTED` | Inbound misuse case — 同「permissioned primary market」narrative 一致 |

---

## 可以借嚟加強 pitch 嘅數字（唔係我哋 claim）

用呢啲做 **market context**，唔好當我哋 metrics：

- ~$75B monthly DEX volume、~$1.6B TVL、~200 stock tokens
- ~27M funded app accounts vs 98% external on-chain addresses
- ~40% new dev teams on RH chain（Alchemy Sep week 1 — 佢 cite tweet）
- 6–10 weeks weekend liquidity improvement（issuer/LP layer — confidential roadmap）

---

## 忽略（同 SKU 無關）

- NFT / OpenSea / gacha 項目
- Perps + Hyperliquid 細節
- 長尾股票 tokenization request 流程
- Robinhood 點解唔 retweet 你（GTM frustration，唔影響 escort logic）
- New York / Texas Earn 排除（US product，唔影響 4663→42161 escort）
- 「Irishman Foundation」— ASR 錯，實際係 **Arbitrum Foundation** Open House

---

## 建議 Judge 30 秒版（中文草稿）

> SliverVine Robinhood Sentinel Escort 係 Robinhood Chain（4663）上面嘅 **ZeroDev Kernel outbound intent gate**：資金只可以 **fail-closed 單向** escort 去 Arbitrum One（42161），inbound 喺 protocol layer 被 `AML_INBOUND_TO_ROBINHOOD_BLOCKED` 截斷；pending bridge capital 用 `lostUsd ≡ 0` invariant。三條 hero：`pnpm demo:robinhood-sentinel` — escort replay、airlock block、SHA-256 audit certificate；mainnet live-fire tx 有 archived explorer 證據，demo 唔 re-broadcast。

---

## 官方 Docs SSOT 對照

> **SSOT：** [docs.robinhood.com/chain/](https://docs.robinhood.com/chain/)（唔係 root Crypto Trading API）  
> **Crawl 日期：** 2026-09-24 · **19 pages**

| 官方 Docs 頁 | 我哋 Code Module | 對齊狀態 |
|-------------|-----------------|---------|
| [Connecting](https://docs.robinhood.com/chain/connecting/) — Chain ID **4663** / **46630**，ETH gas，Alchemy RPC | `src/sdk/constants.ts` · `across-ingress-bridge-types.ts` | ✅ Chain ID SSOT 一致 |
| [Account Abstraction](https://docs.robinhood.com/chain/account-abstraction/) — **ZeroDev** + **EntryPoint v0.7** on 4663；Alchemy Gas Manager 亦 official | `zerodev-aa-constants.ts` · `rchain-alchemy-paymaster.ts` · live-fire probes | ✅ **EP0.7 + ZeroDev on 4663 係 official**（唔再係「我哋自己 claim」） |
| [Bridging](https://docs.robinhood.com/chain/bridging/) — **Across** 列為 intents-based bridge（seconds） | `across-ingress-bridge.ts` | ⚠️ 官方講 **入** chain；我哋 model **出** chain only + inbound fail-closed |
| [Differences from Ethereum](https://docs.robinhood.com/chain/differences-from-ethereum/) — sequencer-level **sanctioned address screening** | Hero 2 `AML_INBOUND_TO_ROBINHOOD_BLOCKED` | ⚠️ 官方係 **sequencer 真 screening**；我哋係 **chain-id boundary predicate** — judge 要 honest footnote |
| [Stock Tokens](https://docs.robinhood.com/chain/stock-tokens/) · [Building with Stock Tokens](https://docs.robinhood.com/chain/building-with-stock-tokens/) | `treasury-escort-router.ts`（GM yield path） | ⚠️ 官方 focus RWA primary/DEX；我哋 **唔做** stock-token collateral / lending |
| [Protocol Contracts](https://docs.robinhood.com/chain/protocol-contracts/) · [Cross-Chain Messaging](https://docs.robinhood.com/chain/cross-chain-messaging/) | `across-ingress-bridge.ts`（route state machine） | ⚠️ 官方係 **L1↔L2 canonical**；我哋 escort target 係 **4663→42161**（唔係 Ethereum L1） |
| [Oracles & Price Feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds/) | — | ❌ 我哋 SKU 冇 integrate Chainlink stock feeds |
| [Deploy Smart Contracts](https://docs.robinhood.com/chain/deploy-smart-contracts/) | — | ℹ️ Foundry/Hardhat 標準 deploy；同 escort decision layer 無直接關係 |

**官方 EntryPoint v0.7（4663）：** `0x0000000071727De22E5E9d8BAf0edAc6f37da032` — 同 `viem/account-abstraction` `entryPoint07Address` 一致（`zerodev-aa-constants.ts`）。

---

## 三條 Link 實用評分

| Link | 用途 | 評分 | 備註 |
|------|------|------|------|
| [Explore — robinhood.com/chain/ecosystem](https://robinhood.com/chain/ecosystem) | GTM / partner map（Morpho、Uniswap、LayerZero、TRM Labs） | **6/10** | Pitch **market context** 有用；技術 SSOT 唔喺呢度 |
| [Build — docs.robinhood.com/chain/connecting/](https://docs.robinhood.com/chain/connecting/) | Chain ID、RPC、AA、bridging 入口 | **10/10** | **必讀 SSOT**；validate 4663/46630、Alchemy endpoint、Across partner list |
| [chain-developers-group@robinhood.com](mailto:chain-developers-group@robinhood.com) | Issues / builder outreach | **7/10** | Official support channel；唔會俾 legal advice（同 Gaetan Q&A 一致） |

---

## 官方有、我哋冇

- **EIP-7702** — existing EOA delegate to smart contract code（[AA page](https://docs.robinhood.com/chain/account-abstraction/)）
- **Canonical L1↔L2 bridge** — Arbitrum bridge ~10 min deposit / ~7 day withdrawal（[Bridging](https://docs.robinhood.com/chain/bridging/)）
- **LayerZero / CCIP / Relay** — 其他 official bridge routes
- **Chainlink stock token price feeds** + `oraclePaused()` corporate-action handling（[Oracles](https://docs.robinhood.com/chain/oracles-and-price-feeds/)）
- **Stock Token REST APIs** — `api.robinhood.com/rhj/`（[Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis/)）
- **Sequencer sanctions screening**（TRM Labs ecosystem partner）— 真 compliance layer，唔係我哋 predicate
- **Alchemy `@alchemy/wallet-apis`** official quickstart（我哋用 `alchemy_requestGasAndPaymasterAndData` probe path）
- **Full node** deployment guide

---

## 我哋有、官方冇

- **Unidirectional outbound escort** `4663 → 42161` only（inbound `42161→4663` fail-closed）
- **`AML_INBOUND_TO_ROBINHOOD_BLOCKED`** protocol-layer intent gate
- **`lostUsd ≡ 0`** + `IN_FLIGHT_BRIDGE_CAPITAL` pending capital invariant
- **`buildRobinhoodAuditSnapshot`** SHA-256 immutable decision artifact（Hero 3）
- **`treasury-escort-router.ts`** Robinhood idle capital → Arbitrum GM yield **decision** path
- **SliverVine ExoMesh** gate / live-fire archived tx evidence（`ROBINHOOD_LIVEFIRE_ARTIFACTS.md`）

---

## 技術修正（官方 Docs 驗證後）

| 之前講法 | 官方 Docs 驗證後 |
|---------|----------------|
| 「片冇提 4663 / ZeroDev」 | ✅ [Account Abstraction](https://docs.robinhood.com/chain/account-abstraction/) **明確寫** ZeroDev on chain 4663 + KERNEL_V3_1 + EP0.7 |
| Across 只係我哋自己揀 | ✅ [Bridging](https://docs.robinhood.com/chain/bridging/) **official list Across** 為 partner bridge |
| Inbound block = AML scanner | ❌ 官方 screening 喺 **sequencer**；我哋 `AML_INBOUND_*` 仍然只係 **chain-id predicate** |
| Explorer URL | 官方用 `robinhoodchain.blockscout.com`；live-fire 用 `explorer.chain.robinhood.com` — 兩個都存在，cite tx 時跟 artifact 實際 link |

---

## 檔案索引

| 檔案 | 用途 |
|------|------|
| [`20260924_100050_Full_English_Transcript.md`](./20260924_100050_Full_English_Transcript.md) | 完整英文字幕 |
| [`20260924_100050_English_Highlights.md`](./20260924_100050_English_Highlights.md) | English 精華 |
| [`20260924_100050_transcript_raw.json`](./20260924_100050_transcript_raw.json) | Raw segments JSON |
| [`20260924_Robinhood_Chain_Docs_Index.md`](./20260924_Robinhood_Chain_Docs_Index.md) | 官方 docs crawl index（19 pages） |
| [`Blueprint1_Pons_Launchpad_4663.md`](./Blueprint1_Pons_Launchpad_4663.md) | Blueprint 1 Complement — Pons launchpad DEX guard @ 4663 |
| [`Blueprint3_Hyperdash_Risk_Terminal_4663.md`](./Blueprint3_Hyperdash_Risk_Terminal_4663.md) | Blueprint 3 Complement — Treasury escort + SHA-256 audit → Hyperdash-style risk feed @ 4663 |

---

*Cross-ref modules: `across-ingress-bridge.ts` · `robinhood-audit-snapshot.ts` · `treasury-escort-router.ts` · `zerodev-aa/*` · `rchain-alchemy-paymaster.ts` · `ROBINHOOD_LIVEFIRE_ARTIFACTS.md` · [docs.robinhood.com/chain/](https://docs.robinhood.com/chain/)*
