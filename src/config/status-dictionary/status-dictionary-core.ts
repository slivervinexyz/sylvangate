/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 *
 * Status dictionary table payload — imported by statusDictionary.ts façade.
 */

import { STATUS_DICTIONARY_DEMO_HUB } from "./status-dictionary-demo-hub";
import { STATUS_DICTIONARY_ROOTS } from "./status-dictionary-roots";
import { STATUS_DICTIONARY_STEP1 } from "./status-dictionary-step1";
import { STATUS_DICTIONARY_TELEMETRY } from "./status-dictionary-telemetry";

export const STATUS_DICTIONARY = {
  ...STATUS_DICTIONARY_STEP1,
  ...STATUS_DICTIONARY_ROOTS,
  ...STATUS_DICTIONARY_DEMO_HUB,
  ...STATUS_DICTIONARY_TELEMETRY,
} as const;
