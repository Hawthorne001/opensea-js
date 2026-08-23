import { camelizeKeysDeep } from "../../src/utils/case"
import advancedErc20 from "../fixtures/fulfillment/advanced-order-erc20.json"
import advancedNative from "../fixtures/fulfillment/advanced-order-native.json"
import basicErc20 from "../fixtures/fulfillment/basic-order-erc20.json"
import basicNative from "../fixtures/fulfillment/basic-order-native.json"

/**
 * Captured `POST /api/v2/listings/fulfillment_data` responses, shared by the
 * ERC20 preflight suites.
 *
 * Each file holds one response body verbatim, plus a `_capture` block recording
 * the request that produced it and the listing's price as reported by a second,
 * unrelated endpoint (`GET /api/v2/orders/chain/{chain}/protocol/{addr}/{hash}`).
 * That price is the oracle the payment tests assert against, so the expected
 * total is not a number someone typed while reading the same struct the code
 * under test reads.
 */

/** `price` as the orders endpoint returns it, verbatim. */
type ListingPrice = {
  current: { currency: string; decimals: number; value: string }
}

export type FulfillmentFixture = {
  _capture: {
    description: string
    collection: string
    chain: string
    order_hash: string
    listing_price: ListingPrice
    request: {
      method: string
      path: string
      body: Record<string, unknown>
    }
  }
  response: {
    protocol: string
    fulfillment_data: {
      transaction: {
        function: string
        to: string
        value: string
        input_data: Record<string, unknown>
      }
      orders: {
        parameters: {
          consideration: {
            itemType: number
            token: string
            startAmount: string
            endAmount: string
          }[]
        }
      }[]
    }
  }
}

export type RealPayload = {
  /** Fixture file basename, used in test names. */
  name: string
  fixture: FulfillmentFixture
  /**
   * Payment token address for an ERC20-priced listing, or null when the
   * listing is native-priced and the preflight must skip it. Stated here rather
   * than read out of the payload, so the expectation does not come from the
   * same bytes the code under test parses. `expectedCurrency` pins it to the
   * symbol the price oracle reports.
   */
  expectedToken: string | null
  expectedCurrency: string
}

export const REAL_PAYLOADS: RealPayload[] = [
  {
    name: "basic-order-erc20",
    fixture: basicErc20 as unknown as FulfillmentFixture,
    // USDC on Polygon.
    expectedToken: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
    expectedCurrency: "USDC",
  },
  {
    name: "basic-order-native",
    fixture: basicNative as unknown as FulfillmentFixture,
    expectedToken: null,
    expectedCurrency: "ETH",
  },
  {
    name: "advanced-order-erc20",
    fixture: advancedErc20 as unknown as FulfillmentFixture,
    // WETH on Polygon.
    expectedToken: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
    expectedCurrency: "WETH",
  },
  {
    name: "advanced-order-native",
    fixture: advancedNative as unknown as FulfillmentFixture,
    expectedToken: null,
    expectedCurrency: "ETH",
  },
]

/**
 * The `inputData` the SDK hands the preflight, produced the way production
 * produces it: the raw body run through the fetcher's `camelizeKeysDeep`.
 *
 * Reading `input_data` straight off the fixture would skip that step and leave
 * the snake_case-to-camelCase boundary untested, which is one key rename away
 * from the same class of bug.
 */
export function preflightInput(fixture: FulfillmentFixture): unknown {
  return camelizeKeysDeep(fixture.response).fulfillmentData.transaction
    .inputData
}

/** One captured payload by fixture basename. Throws rather than returning
 * undefined, so a renamed fixture fails where it is looked up. */
export function payloadNamed(name: string): RealPayload {
  const payload = REAL_PAYLOADS.find(entry => entry.name === name)
  if (!payload) {
    throw new Error(`No captured fulfillment payload named ${name}`)
  }
  return payload
}
