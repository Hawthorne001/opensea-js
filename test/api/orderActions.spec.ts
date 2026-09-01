import { beforeEach, describe, expect, test, type vi } from "vitest"
import { ListingsAPI } from "../../src/api/listings"
import { OffersAPI } from "../../src/api/offers"
import { OrdersAPI } from "../../src/api/orders"
import { Chain } from "../../src/types"
import { createMockFetcher } from "../fixtures/fetcher"

describe("API: order actions", () => {
  let mockPost: ReturnType<typeof vi.fn>
  let listingsAPI: ListingsAPI
  let offersAPI: OffersAPI
  let ordersAPI: OrdersAPI

  beforeEach(() => {
    const { fetcher, mockPost: postMock } = createMockFetcher()
    mockPost = postMock
    listingsAPI = new ListingsAPI(fetcher)
    offersAPI = new OffersAPI(fetcher, Chain.Solana)
    ordersAPI = new OrdersAPI(fetcher, Chain.Solana)
  })

  test("creates listing fulfillment actions", async () => {
    const request = {
      listing: {
        hash: "solana-listing-id",
        chain: "solana",
        protocolAddress: "AuctionHouse1111111111111111111111111111111",
      },
      fulfiller: { address: "BuyerBase58Address" },
      recipient: "RecipientBase58Address",
      includeOptionalCreatorFees: false,
    }
    const response = { steps: [{ svmBuyItemsAction: {} }] }
    mockPost.mockResolvedValue(response)

    await expect(
      listingsAPI.createListingFulfillmentActions(request),
    ).resolves.toBe(response)
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/listings/fulfillment/actions",
      request,
    )
  })

  test("creates offer actions", async () => {
    const request = {
      item: {
        chain: "solana",
        contract: "MintBase58Address",
        tokenId: "TokenAccountBase58Address",
      },
      address: "MakerBase58Address",
      quantity: 1,
      price: {
        amount: "1.5",
        currency: "So11111111111111111111111111111111111111112",
      },
      useCreatorFee: true,
    }
    const response = { steps: [{ svmCreateOfferAction: {} }] }
    mockPost.mockResolvedValue(response)

    await expect(offersAPI.createOfferActions(request)).resolves.toBe(response)
    expect(mockPost).toHaveBeenCalledWith("/api/v2/offers/actions", request)
  })

  test("creates offer fulfillment actions", async () => {
    const request = {
      offer: {
        hash: "solana-offer-id",
        chain: "solana",
        protocolAddress: "AuctionHouse1111111111111111111111111111111",
      },
      fulfiller: { address: "SellerBase58Address" },
      consideration: {
        assetContractAddress: "MintBase58Address",
        tokenId: "TokenAccountBase58Address",
      },
      unitsToFill: 1,
      includeOptionalCreatorFees: false,
    }
    const response = { steps: [{ svmAcceptOfferAction: {} }] }
    mockPost.mockResolvedValue(response)

    await expect(
      offersAPI.createOfferFulfillmentActions(request),
    ).resolves.toBe(response)
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/offers/fulfillment/actions",
      request,
    )
  })

  test("creates cancellation actions using an order identifier", async () => {
    const request = { address: "MakerBase58Address" }
    const response = { steps: [{ svmCancelOrdersAction: {} }] }
    mockPost.mockResolvedValue(response)

    await expect(
      ordersAPI.createCancelOrderActions(
        "AuctionHouse1111111111111111111111111111111",
        "solana-order-id",
        request,
      ),
    ).resolves.toBe(response)
    expect(mockPost).toHaveBeenCalledWith(
      "/api/v2/orders/chain/solana/protocol/AuctionHouse1111111111111111111111111111111/solana-order-id/cancel/actions",
      request,
    )
  })
})
