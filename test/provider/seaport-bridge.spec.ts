import { describe, expect, it, vi } from "vitest"
import { createSeaportBridge } from "../../src/provider/seaport-bridge"

describe("ViemSignerBridge: typed-data primaryType", () => {
  function bridgeWithSpy() {
    const signTypedData = vi.fn().mockResolvedValue("0xsignature")
    const bridge = createSeaportBridge({
      publicClient: {
        transport: { url: "http://127.0.0.1:8545" },
        waitForTransactionReceipt: vi.fn(),
      } as never,
      walletClient: {
        account: { address: "0x0000000000000000000000000000000000000001" },
        signTypedData,
      } as never,
    })
    if (!("signTypedData" in bridge)) {
      throw new Error("expected the bridge to expose a signer")
    }
    return { bridge: bridge as { signTypedData: Function }, signTypedData }
  }

  const DOMAIN = {
    name: "Seaport",
    version: "1.6",
    chainId: 1,
    verifyingContract: "0x0000000000000000000000000000000000000002",
  }

  it("signs the root struct when a dependency is declared before it", async () => {
    const { bridge, signTypedData } = bridgeWithSpy()

    await bridge.signTypedData(
      DOMAIN,
      {
        OrderComponents: [{ name: "offerer", type: "address" }],
        BulkOrder: [{ name: "tree", type: "OrderComponents" }],
      },
      { tree: { offerer: "0x0000000000000000000000000000000000000003" } },
    )

    expect(signTypedData.mock.calls[0][0].primaryType).toBe("BulkOrder")
  })

  it("refuses to guess when two structs both qualify as root", async () => {
    const { bridge, signTypedData } = bridgeWithSpy()

    await expect(
      bridge.signTypedData(
        DOMAIN,
        {
          Alpha: [{ name: "n", type: "string" }],
          Beta: [{ name: "n", type: "string" }],
        },
        { n: "x" },
      ),
    ).rejects.toThrow(/ambiguous/)
    expect(signTypedData).not.toHaveBeenCalled()
  })
})
