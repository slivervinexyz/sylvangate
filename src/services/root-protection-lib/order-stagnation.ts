/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2026 SilverVine Labs. All Rights Reserved.
 */

export const PENDING_ORDER_STAGNATION_MS = 1500;

export interface PendingOrderState {
  orderId: string;
  pendingSince: number;
  acknowledged?: boolean;
}

export interface StagnationResult {
  stagnated: boolean;
  canceledOrderIds: string[];
  locked: boolean;
  reason?: string;
}

/** Force dynamic stagnation timeout on unacknowledged pending orders — auto-cancel + lock. */
export function evaluatePendingOrderStagnation(
  orders: PendingOrderState[],
  now = Date.now(),
): StagnationResult {
  const stale = orders.filter(
    (o) => !o.acknowledged && now - o.pendingSince >= PENDING_ORDER_STAGNATION_MS,
  );

  if (stale.length === 0) {
    return { stagnated: false, canceledOrderIds: [], locked: false };
  }

  return {
    stagnated: true,
    canceledOrderIds: stale.map((o) => o.orderId),
    locked: true,
    reason: `PENDING_STAGNATION_${PENDING_ORDER_STAGNATION_MS}ms`,
  };
}
