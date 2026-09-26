import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OpenSeaAPI } from "../../src/api/api"
import type { WalletAuthFetcher } from "../../src/api/fetcher"
import { WalletAuthAPI } from "../../src/api/walletAuth"

describe("WalletAuthAPI", () => {
  const get = vi.fn().mockResolvedValue({})
  const request = vi.fn().mockResolvedValue({})
  const api = new WalletAuthAPI({
    get,
    request,
  } as unknown as WalletAuthFetcher)

  beforeEach(() => {
    get.mockClear()
    request.mockClear()
  })

  it("routes every scoped write helper to the documented method and path", async () => {
    const body = {} as never
    const cases: [string, string, () => Promise<unknown>][] = [
      ["POST", "/api/v2/watchlist", () => api.addWatchlistEntry(body)],
      ["DELETE", "/api/v2/watchlist", () => api.removeWatchlistEntry(body)],
      [
        "POST",
        "/api/v2/accounts/alice%2Fexample/follow",
        () => api.followAccount("alice/example"),
      ],
      [
        "DELETE",
        "/api/v2/accounts/alice%2Fexample/follow",
        () => api.unfollowAccount("alice/example"),
      ],
      [
        "POST",
        "/api/v2/accounts/alice%2Fexample/watch",
        () => api.watchAccount("alice/example"),
      ],
      [
        "DELETE",
        "/api/v2/accounts/alice%2Fexample/watch",
        () => api.unwatchAccount("alice/example"),
      ],
      ["POST", "/api/v2/saved-tools", () => api.saveTool(body)],
      [
        "DELETE",
        "/api/v2/saved-tools?tool_id=tool%2F1&registry_chain=base&registry_addr=0xabc&toolkit_name=my+tools",
        () =>
          api.removeSavedTool({
            toolId: "tool/1",
            registryChain: "base",
            registryAddr: "0xabc",
            toolkitName: "my tools",
          }),
      ],
      [
        "POST",
        "/api/v2/orders/chain/base/protocol/0xabc/order-1/cancel",
        () => api.cancelOrder("base", "0xabc", "order-1", body),
      ],
      [
        "POST",
        "/api/v2/orders/chain/base/protocol/0xabc/order-1/cancel",
        () => api.cancelOrder("base", "0xabc", "order-1"),
      ],
      [
        "POST",
        "/api/v2/drops/my%20drop",
        () => api.saveDropEdits("my drop", body),
      ],
      [
        "POST",
        "/api/v2/drops/drop/prereveal-item",
        () => api.savePrerevealDropItem("drop", body),
      ],
      [
        "POST",
        "/api/v2/drops/drop/items",
        () => api.saveSelfMintDropItem("drop", body),
      ],
      [
        "PUT",
        "/api/v2/drops/drop/items/1",
        () => api.updateSelfMintDropItem("drop", 1, body),
      ],
      [
        "PATCH",
        "/api/v2/drops/drop/items/1",
        () => api.updateDropItem("drop", 1, body),
      ],
      [
        "POST",
        "/api/v2/drops/drop/items/media",
        () => api.createDropItemMediaUpload("drop", body),
      ],
      [
        "POST",
        "/api/v2/drops/drop/items/media/save",
        () => api.saveDropItemMedia("drop", body),
      ],
      [
        "POST",
        "/api/v2/drops/drop/allowlist",
        () => api.createDropAllowlistUpload("drop"),
      ],
      [
        "POST",
        "/api/v2/drops/drop/allowlist/validate",
        () => api.validateDropAllowlist("drop", body),
      ],
      [
        "POST",
        "/api/v2/drops/my%20drop/items/manifest",
        () => api.createDropCollectionManifestUpload("my drop"),
      ],
      [
        "POST",
        "/api/v2/drops/my%20drop/publish",
        () => api.buildDropPublishTransaction("my drop"),
      ],
      [
        "POST",
        "/api/v2/drops/my%20drop/unpublish",
        () => api.buildDropUnpublishTransaction("my drop"),
      ],
      [
        "POST",
        "/api/v2/drops/my%20drop/metadata/ipfs",
        () => api.uploadDropMetadataToIpfs("my drop"),
      ],
      [
        "PATCH",
        "/api/v2/collections/collection",
        () => api.modifyCollection("collection", body),
      ],
      [
        "PATCH",
        "/api/v2/collections/collection/metadata",
        () => api.updateCollectionMetadata("collection", body),
      ],
      [
        "PATCH",
        "/api/v2/collections/collection/visibility",
        () => api.setCollectionVisibility("collection", body),
      ],
      [
        "POST",
        "/api/v2/collections/collection/images/banner?content_type=image%2Fpng",
        () =>
          api.createCollectionImageUpload("collection", "banner", "image/png"),
      ],
      ["PATCH", "/api/v2/profile", () => api.updateProfileSettings(body)],
      [
        "POST",
        "/api/v2/profile/username",
        () => api.claimProfileUsername(body),
      ],
      [
        "POST",
        "/api/v2/profile/images",
        () => api.createProfileImageUpload(body),
      ],
      ["POST", "/api/v2/profile/nft-pfp", () => api.setProfileNftPfp(body)],
      ["DELETE", "/api/v2/profile/nft-pfp", () => api.clearProfileNftPfp()],
      ["POST", "/api/v2/profile/shelves", () => api.createProfileShelf(body)],
      [
        "PATCH",
        "/api/v2/profile/shelves",
        () => api.reorderProfileShelves(body),
      ],
      [
        "PATCH",
        "/api/v2/profile/shelves/shelf-1",
        () => api.updateProfileShelf("shelf-1", body),
      ],
      [
        "DELETE",
        "/api/v2/profile/shelves/shelf-1",
        () => api.deleteProfileShelf("shelf-1"),
      ],
      ["POST", "/api/v2/accounts/wallets/siwx", () => api.linkWallet(body)],
      [
        "DELETE",
        "/api/v2/accounts/wallets/0xabc",
        () => api.unlinkWallet("0xabc"),
      ],
      [
        "PUT",
        "/api/v2/accounts/wallets/0xabc/private",
        () => api.makeWalletPrivate("0xabc"),
      ],
      [
        "DELETE",
        "/api/v2/accounts/wallets/0xabc/private",
        () => api.makeWalletPublic("0xabc"),
      ],
      ["PUT", "/api/v2/accounts/agent", () => api.declareAgentAccount()],
      [
        "DELETE",
        "/api/v2/accounts/agent",
        () => api.withdrawAgentAccountDeclaration(),
      ],
      [
        "POST",
        "/api/v2/accounts/agent-relationships",
        () => api.proposeAgentRelationship(body),
      ],
      [
        "POST",
        "/api/v2/accounts/agent-relationships/confirm",
        () => api.confirmAgentRelationship(body),
      ],
      [
        "DELETE",
        "/api/v2/accounts/agent-relationships?counterparty_address=0xabc&caller_role=AGENT",
        () =>
          api.revokeAgentRelationship({
            counterpartyAddress: "0xabc",
            callerRole: "AGENT",
          }),
      ],
    ]

    for (const [method, path, run] of cases) {
      request.mockClear()
      await run()
      expect(request.mock.calls[0]?.slice(0, 2)).toEqual([method, path])
    }
  })

  it("forwards the request body and returns the response for nft pfp helpers", async () => {
    // camelCase, matching SetNftPfpRequest in the OpenAPI spec. This fixture
    // used to be snake_case, which is why the body-casing bug went unnoticed —
    // see walletAuthCasing.spec.ts.
    const settings = {
      contractAddress: "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d",
      tokenId: "1",
      chain: "ethereum",
    }
    request.mockResolvedValueOnce(settings)
    await expect(api.setProfileNftPfp(settings as never)).resolves.toBe(
      settings,
    )
    expect(request).toHaveBeenLastCalledWith(
      "POST",
      "/api/v2/profile/nft-pfp",
      settings,
      undefined,
      { snakeizeBody: false },
    )

    request.mockResolvedValueOnce({ success: true })
    await expect(api.clearProfileNftPfp()).resolves.toEqual({ success: true })
    expect(request).toHaveBeenLastCalledWith(
      "DELETE",
      "/api/v2/profile/nft-pfp",
    )
  })

  it("routes scoped reads with query support", async () => {
    await api.getDropEligibility("drop")
    expect(get).toHaveBeenLastCalledWith("/api/v2/drops/drop/eligibility")

    await api.getFavorites("0xabc", { limit: 1 })
    expect(get).toHaveBeenLastCalledWith("/api/v2/account/0xabc/favorites", {
      limit: 1,
    })

    await api.getTokenWatchlist("0xabc")
    expect(get).toHaveBeenLastCalledWith(
      "/api/v2/account/0xabc/token_watchlist",
    )

    await api.getPerpetualWatchlist("0xabc")
    expect(get).toHaveBeenLastCalledWith(
      "/api/v2/account/0xabc/perpetual_watchlist",
    )

    await api.getAccountRelationship("alice/example")
    expect(get).toHaveBeenLastCalledWith(
      "/api/v2/accounts/alice%2Fexample/relationship",
    )

    await api.getAccountFollowing("alice", { limit: 10, cursor: "next" })
    expect(get).toHaveBeenLastCalledWith("/api/v2/accounts/alice/following", {
      limit: 10,
      cursor: "next",
    })

    await api.getAccountFollowers("alice", { limit: 20 })
    expect(get).toHaveBeenLastCalledWith("/api/v2/accounts/alice/followers", {
      limit: 20,
    })

    await api.getDropMetadataIpfsProgress("my drop", "run/1")
    expect(get).toHaveBeenLastCalledWith(
      "/api/v2/drops/my%20drop/metadata/ipfs/run%2F1",
    )

    await api.listSavedTools({ toolkitName: "trading", limit: 5 })
    expect(get).toHaveBeenLastCalledWith("/api/v2/saved-tools", {
      toolkitName: "trading",
      limit: 5,
    })
  })

  it("sends the drop publish, unpublish and IPFS writes without a body", async () => {
    const calls: [string, () => Promise<unknown>][] = [
      [
        "/api/v2/drops/drop/publish",
        () => api.buildDropPublishTransaction("drop"),
      ],
      [
        "/api/v2/drops/drop/unpublish",
        () => api.buildDropUnpublishTransaction("drop"),
      ],
      [
        "/api/v2/drops/drop/metadata/ipfs",
        () => api.uploadDropMetadataToIpfs("drop"),
      ],
    ]
    for (const [path, run] of calls) {
      request.mockClear()
      await run()
      // No body and no options, so the default camelized response applies.
      expect(request).toHaveBeenLastCalledWith("POST", path)
    }
  })

  describe("agent accounts", () => {
    it("sends the caller's own side in the propose and confirm bodies", async () => {
      const proposal = {
        counterpartyAddress: "0xowner",
        callerRole: "AGENT",
      } as const

      await api.proposeAgentRelationship(proposal)
      expect(request).toHaveBeenLastCalledWith(
        "POST",
        "/api/v2/accounts/agent-relationships",
        proposal,
      )

      await api.confirmAgentRelationship(proposal)
      expect(request).toHaveBeenLastCalledWith(
        "POST",
        "/api/v2/accounts/agent-relationships/confirm",
        proposal,
      )
    })

    it("puts revoke arguments in the query string, not a DELETE body", async () => {
      await api.revokeAgentRelationship({
        counterpartyAddress: "0xagent",
        callerRole: "OWNER",
      })

      const [method, path, body] = request.mock.calls.at(-1) ?? []
      expect(method).toBe("DELETE")
      expect(path).toBe(
        "/api/v2/accounts/agent-relationships?counterparty_address=0xagent&caller_role=OWNER",
      )
      // fetch, OkHttp and urllib all drop DELETE bodies, so there must not be one.
      expect(body).toBeUndefined()
    })

    it("percent-encodes revoke query values", async () => {
      await api.revokeAgentRelationship({
        counterpartyAddress: "0x a&b",
        callerRole: "AGENT",
      })

      expect(request.mock.calls.at(-1)?.[1]).toBe(
        "/api/v2/accounts/agent-relationships?counterparty_address=0x+a%26b&caller_role=AGENT",
      )
    })

    it("serializes a counterparty account id in the revoke query", async () => {
      await api.revokeAgentRelationship({
        counterpartyAccountId: "acct_1",
        callerRole: "OWNER",
      })

      expect(request.mock.calls.at(-1)?.[1]).toBe(
        "/api/v2/accounts/agent-relationships?counterparty_account_id=acct_1&caller_role=OWNER",
      )
    })

    it("reads the caller's own relationships over GET", async () => {
      await api.listOwnAgentRelationships()
      expect(get).toHaveBeenLastCalledWith(
        "/api/v2/accounts/agent-relationships",
      )
    })

    it("declares and withdraws without a request body", async () => {
      await api.declareAgentAccount()
      expect(request).toHaveBeenLastCalledWith("PUT", "/api/v2/accounts/agent")

      await api.withdrawAgentAccountDeclaration()
      expect(request).toHaveBeenLastCalledWith(
        "DELETE",
        "/api/v2/accounts/agent",
      )
    })
  })
})

describe("drop IPFS metadata responses", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("camelizes the upload id and progress fields at the fetch boundary", async () => {
    const responses: unknown[] = [
      { workflow_execution_id: "run-1" },
      {
        status: "failed",
        media_upload_progress: 100,
        metadata_upload_progress: 40,
        failure_reason: "pin failed",
      },
    ]
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(responses.shift()), { status: 200 }),
      ),
    )
    const api = new OpenSeaAPI({ apiKey: "key", authToken: "jwt" })

    const started = await api.walletAuth.uploadDropMetadataToIpfs("drop")
    const progress = await api.walletAuth.getDropMetadataIpfsProgress(
      "drop",
      started.workflowExecutionId,
    )

    expect(started).toEqual({ workflowExecutionId: "run-1" })
    expect(progress).toEqual({
      status: "failed",
      mediaUploadProgress: 100,
      metadataUploadProgress: 40,
      failureReason: "pin failed",
    })
  })
})
