import { describe, expect, test, vi } from "vitest"
import { ZERO_ADDRESS } from "../../src/constants"
import { OrderSide } from "../../src/types"
import { sdk } from "../utils/sdk"

describe("SDK: _getPriceParameters", () => {
  test("throws the intended validation error when amount is null", async () => {
    await expect(
      (sdk as any)._getPriceParameters(OrderSide.LISTING, ZERO_ADDRESS, null),
    ).rejects.toThrow("Starting price must be a number >= 0")
  })

  test("uses payment token decimals and rejects excess precision", async () => {
    vi.spyOn(sdk.api, "getPaymentToken").mockResolvedValue({
      decimals: 6,
    } as never)
    const mirrorAddress = "0x779ded0c9e1022225f8e0630b35a9b54be713736"

    await expect(
      (sdk as any)._getPriceParameters(OrderSide.OFFER, mirrorAddress, "1.5"),
    ).resolves.toEqual({ basePrice: 1500000n })
    await expect(
      (sdk as any)._getPriceParameters(
        OrderSide.OFFER,
        mirrorAddress,
        "1.0000001",
      ),
    ).rejects.toThrow("Too many decimal places")
  })
})
