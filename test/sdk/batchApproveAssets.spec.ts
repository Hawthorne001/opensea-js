import { describe, expect, test, vi } from "vitest"
import { AssetsManager } from "../../src/sdk/assets"
import type { SDKContext } from "../../src/sdk/context"
import { Chain, EventType, TokenStandard } from "../../src/types"

const TOKEN = "0x0f5d2fb29fb7d3cfee444a200298f468908cc942"
const FROM = "0x0000000000000000000000000000000000000001"

/**
 * batchApproveAssets only touches a handful of context members, so build the
 * minimum and cast. Allowance reads return 0 so every asset looks unapproved.
 */
function harness() {
  const sendTransaction = vi.fn().mockResolvedValue({ hash: "0xtest" })
  const writeContract = vi.fn().mockResolvedValue({ hash: "0xmulticall" })
  const encodeFunctionData = vi.fn().mockReturnValue("0xapproval")
  const confirmTransaction = vi.fn().mockResolvedValue(undefined)

  const context = {
    chain: Chain.Mainnet,
    wallet: { signer: { sendTransaction } },
    contractCaller: {
      readContract: vi.fn().mockResolvedValue(0n),
      writeContract,
      encodeFunctionData,
    },
    confirmTransaction,
    requireAccountIsAvailable: vi.fn().mockResolvedValue(undefined),
    dispatch: vi.fn(),
    logger: vi.fn(),
  } as unknown as SDKContext

  return {
    manager: new AssetsManager(context),
    sendTransaction,
    writeContract,
    encodeFunctionData,
    confirmTransaction,
  }
}

const erc20 = (tokenAddress: string, amount: string) => ({
  asset: { tokenAddress, tokenId: null, tokenStandard: TokenStandard.ERC20 },
  amount,
})

describe("AssetsManager: batchApproveAssets", () => {
  test("sends one approval for the same ERC20 contract, matching case-insensitively", async () => {
    const h = harness()

    await h.manager.batchApproveAssets({
      assets: [erc20(TOKEN, "1"), erc20(TOKEN.toUpperCase(), "2")],
      fromAddress: FROM,
    })

    // One approval, so it goes direct rather than through Multicall3.
    expect(h.encodeFunctionData).toHaveBeenCalledTimes(1)
    expect(h.sendTransaction).toHaveBeenCalledTimes(1)
    expect(h.writeContract).not.toHaveBeenCalled()
    expect(h.confirmTransaction).toHaveBeenCalledWith(
      "0xtest",
      EventType.ApproveAllAssets,
      "Approving asset for transfer",
    )
  })

  test("still sends one approval per distinct ERC20 contract", async () => {
    const h = harness()
    const other = "0x1111111111111111111111111111111111111111"

    await h.manager.batchApproveAssets({
      assets: [erc20(TOKEN, "1"), erc20(other, "2")],
      fromAddress: FROM,
    })

    expect(h.encodeFunctionData).toHaveBeenCalledTimes(2)
    // Two approvals batch through Multicall3 instead of going direct.
    expect(h.writeContract).toHaveBeenCalledTimes(1)
    expect(h.sendTransaction).not.toHaveBeenCalled()
  })
})
