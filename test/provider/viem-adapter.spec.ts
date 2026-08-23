import { describe, expect, it, vi } from "vitest"
import { createViemWallet } from "../../src/provider/viem-adapter"

describe("createViemWallet: typed-data domain", () => {
  function walletWithSpy() {
    const signTypedData = vi.fn().mockResolvedValue("0xsignature")
    const wallet = createViemWallet({
      publicClient: { waitForTransactionReceipt: vi.fn() } as never,
      walletClient: {
        account: { address: "0x0000000000000000000000000000000000000001" },
        signTypedData,
      } as never,
    })
    if (!("signer" in wallet)) {
      throw new Error("expected the viem wallet to expose a signer")
    }
    return { signer: wallet.signer, signTypedData }
  }

  it("omits chainId rather than passing NaN when the domain has none", async () => {
    const { signer, signTypedData } = walletWithSpy()

    await signer.signTypedData(
      {
        name: "OpenSea",
        version: "1",
        verifyingContract: "0x0000000000000000000000000000000000000002",
      } as never,
      { Test: [{ name: "value", type: "string" }] },
      { value: "hello" },
    )

    const { domain } = signTypedData.mock.calls[0][0]
    expect(domain.chainId).toBeUndefined()
    expect(Number.isNaN(domain.chainId)).toBe(false)
  })

  it("still forwards a chainId that is present", async () => {
    const { signer, signTypedData } = walletWithSpy()

    await signer.signTypedData(
      {
        name: "OpenSea",
        version: "1",
        chainId: 1,
        verifyingContract: "0x0000000000000000000000000000000000000002",
      } as never,
      { Test: [{ name: "value", type: "string" }] },
      { value: "hello" },
    )

    expect(signTypedData.mock.calls[0][0].domain.chainId).toBe(1)
  })
})

describe("createViemWallet: typed-data primaryType", () => {
  function walletWithSpy() {
    const signTypedData = vi.fn().mockResolvedValue("0xsignature")
    const wallet = createViemWallet({
      publicClient: { waitForTransactionReceipt: vi.fn() } as never,
      walletClient: {
        account: { address: "0x0000000000000000000000000000000000000001" },
        signTypedData,
      } as never,
    })
    if (!("signer" in wallet)) {
      throw new Error("expected the viem wallet to expose a signer")
    }
    return { signer: wallet.signer, signTypedData }
  }

  const DOMAIN = {
    name: "OpenSea",
    version: "1",
    chainId: 1,
    verifyingContract: "0x0000000000000000000000000000000000000002",
  } as never

  it("signs the root struct when a dependency is declared before it", async () => {
    const { signer, signTypedData } = walletWithSpy()

    await signer.signTypedData(
      DOMAIN,
      {
        Person: [{ name: "name", type: "string" }],
        Mail: [
          { name: "from", type: "Person" },
          { name: "contents", type: "string" },
        ],
      },
      { from: { name: "A" }, contents: "hi" },
    )

    expect(signTypedData.mock.calls[0][0].primaryType).toBe("Mail")
  })

  it("refuses to guess when two structs both qualify as root", async () => {
    const { signer, signTypedData } = walletWithSpy()

    await expect(
      signer.signTypedData(
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
