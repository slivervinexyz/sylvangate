/** Topology node domain labels + role/scenario i18n lookups. */

export const TOPOLOGY_DOMAIN_I18N: Readonly<Record<string, string>> = {
  NODE_ALPHA: "Physical Protection",
  NODE_SIGMA: "High-Speed Sweep",
  NODE_DELTA: "Liquidity Cushion",
  NODE_THETA: "Hard Armor",
  NODE_OMEGA: "Unidirectional State",
  NODE_KAPPA: "Anti-MEV Counter",
  NODE_LAMBDA: "Dynamic Spread",
  NODE_ZETA: "Roadmap Lane",
};

export const ROLE_I18N: Readonly<Record<string, string>> = {
  RETAIL: "Retail $1k",
  PRO_TRADER: "Pro $50k",
  DAPP_INTEGRATOR: "DApp $200k",
  INSTITUTION: "Institution $2M",
};

export const SCENARIO_I18N: Readonly<Record<string, string>> = {
  NORMAL_RANGING: "Normal Ranging",
  HIGH_VOLATILITY_SQUEEZE: "High-Vol Squeeze",
  PREDATORY_MEV_ATTACK: "Predatory MEV",
  FLASH_CRASH_BLACK_SWAN: "Flash Crash / Black Swan",
  LIQUIDITY_HOLE_VACUUM: "Liquidity Vacuum",
  ORACLE_RPC_DISTORTION: "Oracle/RPC Distortion",
};
