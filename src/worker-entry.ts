import type { Env } from "./env";
import { WRK_ERR_CRON_FAILED } from "./worker/worker-error-codes";
import { handleWorkerFetch } from "./worker-fetch";
import { runScheduledJobs } from "./worker-scheduled";

/**
 * Lean Workers entry — fetch + scheduled only (no SDK re-exports).
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return handleWorkerFetch(request, env, ctx);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    try {
      await runScheduledJobs(env, controller.cron);
    } catch (err) {
      console.error(`[bedelta-living-water] ${WRK_ERR_CRON_FAILED}`, err);
    }
    void ctx;
  },
} satisfies ExportedHandler<Env>;
