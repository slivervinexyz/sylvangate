import { readActiveSystemState } from "../../core/state";
import {
  assertSeverGenerationUnchanged,
  readSeverGeneration,
} from "../../core/signing-sever-latch";
import {
  auditSessionKeyNonceState,
  handleInvalidSessionKeyNonce,
  resolveSessionKeyNonce,
} from "./nonce-auto-healing";
import {
  assertSessionKeyExecutionGates,
  severSigningChannel,
} from "./session-key-gates";
import {
  buildConnectionId,
  buildSessionKeyEip712Stub,
  stubSignSessionKeyPayload,
} from "./session-key-eip712";
import { assertSessionKeyStubAllowed } from "./session-key-stub-guard";
import {
  DefenseMatrixError,
  type SessionKeyOrderPayload,
  type SignAndExecuteOptions,
  type SigningResult,
} from "./session-key-types";

/**
 * @deprecated Sign and execute (stub) — use `executeHlSessionKeyOrder` for live HL trading.
 * Physical gates run first; any trip severs the signing channel immediately.
 */
export async function signAndExecuteOrder(
  payload: SessionKeyOrderPayload,
  options: SignAndExecuteOptions = {},
): Promise<SigningResult> {
  const state = options.systemState ?? readActiveSystemState();
  const genAtEntry = readSeverGeneration();

  try {
    assertSessionKeyExecutionGates(
      payload,
      state,
      options.maxPositionUsd,
      {
        leverage: options.leverage,
        contractTarget: options.contractTarget,
        hlAction: options.hlAction,
        profile: options.profile,
      },
    );
    assertSeverGenerationUnchanged(genAtEntry);

    const nonceAudit = auditSessionKeyNonceState();
    if (!nonceAudit.ok) {
      throw new DefenseMatrixError(
        "SESSION_KEY_NONCE_AUDIT_FAILED",
        "Session Key nonce audit failed — signing channel revoked",
        nonceAudit.reasons,
        403,
      );
    }

    const nonce = options.nonce ?? resolveSessionKeyNonce();
    const connectionId = await buildConnectionId(payload, nonce);
    const eip712 = buildSessionKeyEip712Stub(payload, nonce, connectionId);
    assertSeverGenerationUnchanged(genAtEntry);

    if (options.dryRun) {
      return {
        success: true,
        signatureHash: null,
        errorReason: null,
      };
    }

    assertSessionKeyStubAllowed();
    assertSeverGenerationUnchanged(genAtEntry);

    const signatureHash = await stubSignSessionKeyPayload(eip712);
    assertSeverGenerationUnchanged(genAtEntry);

    return {
      success: true,
      signatureHash,
      errorReason: null,
    };
  } catch (err) {
    if (err instanceof DefenseMatrixError) {
      throw err;
    }

    if (
      err instanceof Error &&
      err.message === "SESSION_KEY_SEVER_GENERATION_RACE"
    ) {
      severSigningChannel();
      throw new DefenseMatrixError(
        "SESSION_KEY_SEVER_RACE",
        "Signing channel severed during in-flight authorization",
        ["SESSION_KEY_SEVER_GENERATION_RACE"],
        403,
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    const nonceHeal = handleInvalidSessionKeyNonce(message);
    if (!nonceHeal.ok) {
      throw new DefenseMatrixError(
        "SESSION_KEY_INVALID_NONCE_HEAL",
        "Invalid Session Key nonce — local state reset and revocation lock applied",
        nonceHeal.reasons,
        403,
      );
    }

    severSigningChannel();
    throw new DefenseMatrixError(
      "SESSION_KEY_HARDLOCK_INTERCEPTED",
      err instanceof Error ? err.message : String(err),
      [],
      403,
    );
  }
}
