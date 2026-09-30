<!-- SSOT snippet — copy into public docs; keep in sync -->
```text
┌─────────────────────┐       ┌──────────────────────────┐       ┌─────────────────────┐
│   HOME · 4663       │  ──►  │  DECISION (off-chain)    │  ──►  │   DEST · 42161      │
│   Robinhood Chain   │       │  SylvanGate SDK          │       │   Arbitrum One      │
├─────────────────────┤       ├──────────────────────────┤       ├─────────────────────┤
│ Kernel UserOp       │       │ SylvanGateGuard          │       │ GM pool metadata    │
│ SVESC attestation   │       │ checkAirlockThreshold      │       │ (planned yield dest)│
│ (on-chain)          │       │ assertUnidirectionalBridge│     │ (not 4663 RPC call) │
└─────────────────────┘       └──────────────────────────┘       └─────────────────────┘
```

**Flow:** `4663 → 42161` outbound only · `42161 → 4663` fail-closed · `lostUsd ≡ 0` · Decision layer = **zero-gas** pre-sign (no Cloudflare Worker required).
