import { describe, expect, it } from "vitest";
import {
  findActiveRegisteredSessionKeyAgent,
  isSessionKeyAgentRegisteredOnL2,
  registerAgentWithL2IndexingAwait,
  registerApprovedAgentOnHlExchange,
} from "../../../src/adapters/hl/hl-agent-registration";
import {
  MASTER_WALLET,
  mockIndexedAgentFetch,
  SAMPLE_AGENT,
} from "./hl-agent-registration-lib/fixtures";

describe("hl-agent-registration — registration flow", () => {
  it("findActiveRegisteredSessionKeyAgent matches active BeDeltaAgent", () => {
    const agent = findActiveRegisteredSessionKeyAgent(
      [
        {
          name: "BeDeltaAgent",
          address: SAMPLE_AGENT.agentAddress,
          validUntil: Date.now() + 60_000,
        },
      ],
      SAMPLE_AGENT.agentAddress,
    );
    expect(agent?.name).toBe("BeDeltaAgent");
  });

  it("isSessionKeyAgentRegisteredOnL2 reads extraAgents info endpoint", async () => {
    const fetchFn = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { type?: string };
      expect(body.type).toBe("extraAgents");
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            name: "BeDeltaAgent",
            address: SAMPLE_AGENT.agentAddress,
            validUntil: Date.now() + 60_000,
          },
        ],
      } as Response;
    };

    const registered = await isSessionKeyAgentRegisteredOnL2(
      MASTER_WALLET,
      SAMPLE_AGENT.agentAddress,
      { fetchFn },
    );
    expect(registered?.name).toBe("BeDeltaAgent");
  });

  it("registerAgentWithL2IndexingAwait skips when HL reports agent already used", async () => {
    const fetchFn = mockIndexedAgentFetch({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ status: "err", response: "Extra agent already used" }),
    });

    const result = await registerAgentWithL2IndexingAwait(SAMPLE_AGENT, {
      fetchFn,
      masterWalletAddress: MASTER_WALLET,
    });
    expect(result).toEqual({ skippedRegistration: true });
  });

  it("registerAgentWithL2IndexingAwait throws raw HL error when API wallet missing", async () => {
    const fetchFn = async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: "err",
            response: "User or API Wallet 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 does not exist.",
          }),
      }) as Response;

    await expect(
      registerAgentWithL2IndexingAwait(SAMPLE_AGENT, {
        fetchFn,
        masterWalletAddress: MASTER_WALLET,
      }),
    ).rejects.toThrow("User or API Wallet");
  });

  it("registerApprovedAgentOnHlExchange POSTs approveAgent payload", async () => {
    let postedBody: unknown;
    const fetchFn = async (_url: string, init?: RequestInit) => {
      postedBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "ok" }),
      } as Response;
    };

    await registerApprovedAgentOnHlExchange(SAMPLE_AGENT, { fetchFn });
    expect(postedBody).toMatchObject({
      nonce: SAMPLE_AGENT.nonce,
      action: { type: "approveAgent", agentName: "BeDeltaAgent" },
      signature: { r: expect.stringMatching(/^0x/), s: expect.stringMatching(/^0x/) },
    });
    expect((postedBody as { action: { agentName: string } }).action.agentName.length).toBeLessThanOrEqual(16);
  });

  it("registerApprovedAgentOnHlExchange coerces invalid agentName to BeDeltaAgent", async () => {
    let postedBody: unknown;
    const fetchFn = async (_url: string, init?: RequestInit) => {
      postedBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "ok" }),
      } as Response;
    };

    await registerApprovedAgentOnHlExchange(
      {
        ...SAMPLE_AGENT,
        action: { ...SAMPLE_AGENT.action, agentName: "BeDeltaSessionKey" },
      },
      { fetchFn },
    );
    expect((postedBody as { action: { agentName: string } }).action.agentName).toBe(
      "BeDeltaAgent",
    );
  });
});
