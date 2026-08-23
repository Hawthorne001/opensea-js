/**
 * Helpers for ERC20-denominated listing fulfillment.
 *
 * When a listing is priced in an ERC20 token instead of the native currency,
 * `transaction.value` is `0` and Seaport pulls the payment from the buyer with
 * `transferFrom`. That only works if the buyer has already approved the spender,
 * so the fulfillment reverts with a bare "execution reverted" when they haven't.
 * These helpers read the payment token and amount out of the API's fulfillment
 * input data so the SDK can check the allowance before spending gas.
 */

/** Seaport `ItemType` for an ERC20 item. 0 is native, and anything >= 2 is an NFT. */
const ITEM_TYPE_ERC20 = 1

/**
 * Seaport `BasicOrderRouteType` values where the fulfiller pays with an ERC20
 * token: `ERC20_TO_ERC721` (2) and `ERC20_TO_ERC1155` (3). Routes 0-1 are
 * native-priced listings; routes 4-5 are offer fulfillments, where the fulfiller
 * provides the NFT and the ERC20 comes from the offerer instead.
 */
const ERC20_PAYMENT_ROUTES = new Set([2, 3])

/** A `bytes32(0)` conduit key means Seaport transfers directly, with no conduit. */
export const ZERO_CONDUIT_KEY = `0x${"0".repeat(64)}`

export type Erc20Payment = {
  /** Payment token contract address. */
  token: string
  /** Total amount the fulfiller owes, in the token's base units. */
  amount: bigint
}

type ConsiderationItemLike = {
  itemType?: unknown
  token?: unknown
  startAmount?: unknown
  endAmount?: unknown
}

/**
 * Coerce a value an RPC adapter may return as a bigint, a decimal string, or a
 * number into a bigint. Returns null for anything else.
 */
export function toBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value)
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return BigInt(value.trim())
  }
  return null
}

function toNumber(value: unknown): number | null {
  const asBigInt = toBigInt(value)
  return asBigInt === null ? null : Number(asBigInt)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/**
 * Sum the ERC20 consideration items of a listing, which together are what the
 * fulfiller pays (seller proceeds plus marketplace and creator fees).
 *
 * Returns null unless every consideration item is the same ERC20 token. A native
 * item means the listing is native-priced, an NFT item means this is an offer
 * fulfillment rather than a purchase, and mixed tokens are not something we can
 * express as a single allowance.
 */
function sumErc20Consideration(consideration: unknown): Erc20Payment | null {
  if (!Array.isArray(consideration) || consideration.length === 0) {
    return null
  }

  let token: string | null = null
  let total = 0n

  for (const rawItem of consideration as ConsiderationItemLike[]) {
    if (!isRecord(rawItem)) {
      return null
    }
    const itemType = toNumber(rawItem.itemType)
    if (itemType !== ITEM_TYPE_ERC20) {
      // Native payment, an NFT in the consideration, or an unreadable item type.
      return null
    }
    const itemToken = rawItem.token
    if (typeof itemToken !== "string") {
      return null
    }
    if (token === null) {
      token = itemToken
    } else if (token.toLowerCase() !== itemToken.toLowerCase()) {
      return null
    }
    const amount = toBigInt(rawItem.startAmount)
    if (amount === null) {
      return null
    }
    // A time-interpolated item (declining or ascending price) is charged at a
    // value between startAmount and endAmount, so startAmount is only an upper
    // bound and there is no confident figure to check a balance against.
    const endAmount = toBigInt(rawItem.endAmount)
    if (endAmount === null || endAmount !== amount) {
      return null
    }
    total += amount
  }

  return token === null ? null : { token, amount: total }
}

/**
 * Sum the ERC20 payment for a basic order, whose consideration is flattened into
 * `considerationAmount` plus one entry per `additionalRecipients` fee.
 */
function basicOrderErc20Payment(
  basicOrderParameters: unknown,
): Erc20Payment | null {
  if (!isRecord(basicOrderParameters)) {
    return null
  }

  const basicOrderType = toNumber(basicOrderParameters.basicOrderType)
  if (basicOrderType === null) {
    return null
  }
  // Four order types share each route: full/partial x open/restricted.
  if (!ERC20_PAYMENT_ROUTES.has(Math.floor(basicOrderType / 4))) {
    return null
  }

  const token = basicOrderParameters.considerationToken
  if (typeof token !== "string") {
    return null
  }

  let total = toBigInt(basicOrderParameters.considerationAmount)
  if (total === null) {
    return null
  }

  const additionalRecipients = basicOrderParameters.additionalRecipients
  if (additionalRecipients !== undefined) {
    if (!Array.isArray(additionalRecipients)) {
      return null
    }
    for (const recipient of additionalRecipients) {
      if (!isRecord(recipient)) {
        return null
      }
      const amount = toBigInt(recipient.amount)
      if (amount === null) {
        return null
      }
      total += amount
    }
  }

  return { token, amount: total }
}

/**
 * Top-level `input_data` keys that can carry the flattened basic-order struct,
 * in precedence order.
 *
 * `parameters` is the name the API sends, per the `FulfillBasicOrder` schema in
 * the OpenAPI spec. `basicOrderParameters` is a tolerated alias and appears in
 * no real response; reading only that name is what made this preflight inert in
 * production (opensea-sdk#1997).
 */
const BASIC_ORDER_STRUCT_KEYS = ["parameters", "basicOrderParameters"] as const

/**
 * Find the flattened basic-order struct in a fulfillment response.
 *
 * `basicOrderType` is the discriminator, because only the flattened
 * basic-order struct carries it. An `OrderComponents`-shaped `parameters` from
 * a standard `fulfillOrder` response has `offer` and `consideration` arrays
 * instead, so it cannot be mistaken for a basic order.
 */
function findBasicOrderStruct(
  inputData: Record<string, unknown>,
): Record<string, unknown> | null {
  for (const key of BASIC_ORDER_STRUCT_KEYS) {
    const candidate = inputData[key]
    if (isRecord(candidate) && candidate.basicOrderType !== undefined) {
      return candidate
    }
  }
  return null
}

/**
 * Whether an advanced order's numerator/denominator fraction is a full fill.
 * A full fill is the only case where summing the consideration items'
 * `startAmount`s is the exact payment: for a partial fill Seaport scales each
 * item by the fraction and requires exact divisibility, which is not modelled
 * here. Returns false for a missing, unparsable, non-positive, or unequal
 * fraction, so the caller fails open and skips the preflight.
 */
function isFullFillFraction(order: Record<string, unknown>): boolean {
  const numerator = toBigInt(order.numerator)
  const denominator = toBigInt(order.denominator)
  if (numerator === null || denominator === null) {
    return false
  }
  return numerator > 0n && numerator === denominator
}

/**
 * Read the ERC20 payment a fulfiller owes from the `inputData` of an OpenSea
 * fulfillment response.
 *
 * Returns null whenever the payment is not a single ERC20 amount we can read
 * with confidence, including native-priced listings and offer fulfillments.
 * Callers must treat null as "no preflight possible" and submit the transaction
 * unchanged, so an unfamiliar response shape can never block a working purchase.
 */
export function getErc20Payment(inputData: unknown): Erc20Payment | null {
  if (!isRecord(inputData)) {
    return null
  }

  const basicOrder = findBasicOrderStruct(inputData)
  if (basicOrder) {
    return basicOrderErc20Payment(basicOrder)
  }

  const order = isRecord(inputData.advancedOrder)
    ? inputData.advancedOrder
    : isRecord(inputData.order)
      ? inputData.order
      : null
  if (!order || !isRecord(order.parameters)) {
    return null
  }

  // An AdvancedOrder may carry a numerator/denominator fraction for a partial
  // fill. Seaport applies that fraction to each consideration item, so the
  // summed full-order consideration is only the real payment for a full fill.
  // For anything else, fail open rather than falsely blocking a purchase.
  if (isRecord(inputData.advancedOrder) && !isFullFillFraction(order)) {
    return null
  }

  return sumErc20Consideration(order.parameters.consideration)
}

/**
 * Read the fulfiller's conduit key, which decides who the buyer must approve:
 * the resolved conduit for a non-zero key, or Seaport itself for `bytes32(0)`.
 * Returns null when the response does not carry one.
 */
export function getFulfillerConduitKey(inputData: unknown): string | null {
  if (!isRecord(inputData)) {
    return null
  }
  const direct = inputData.fulfillerConduitKey
  if (typeof direct === "string") {
    return direct
  }
  // A basic order carries its conduit key inside the struct, not at the top
  // level. Reading the amount without this would resolve the spender to Seaport
  // for an order the buyer approved the conduit for, and the preflight would
  // then report a working purchase as unapproved.
  const basicOrder = findBasicOrderStruct(inputData)
  if (basicOrder) {
    const fromBasicOrder = basicOrder.fulfillerConduitKey
    if (typeof fromBasicOrder === "string") {
      return fromBasicOrder
    }
  }
  return null
}

/** Whether a conduit key means "transfer directly from Seaport, no conduit". */
export function isZeroConduitKey(conduitKey: string | null): boolean {
  if (!conduitKey) {
    return true
  }
  return conduitKey.toLowerCase() === ZERO_CONDUIT_KEY
}
