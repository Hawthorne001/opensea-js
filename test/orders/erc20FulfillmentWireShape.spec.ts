import { describe, expect, test } from "vitest"
import {
  getErc20Payment,
  getFulfillerConduitKey,
} from "../../src/orders/erc20Fulfillment"
import { readOpenApiSpec } from "../utils/openapiSpec"
import { preflightInput, REAL_PAYLOADS } from "./erc20FulfillmentFixtures"

/**
 * Check on the field names the ERC20 preflight looks for.
 *
 * opensea-sdk#1997, and monorepo #638 before it, were reported by a member of
 * the public: the preflight read `inputData.basicOrderParameters` while the API
 * sends the flattened struct as `inputData.parameters`. The unit fixtures were
 * hand-written with the same wrong name, so every test agreed with the code and
 * the guard did nothing in production for months.
 *
 * A field name is only correct relative to the wire, so check it against the
 * wire. Two independent sources are used: the OpenAPI spec vendored at
 * `packages/api-types/opensea-api.json`, which enumerates the seven `input_data`
 * variants the fulfillment endpoints can return, and the captured responses in
 * `test/fixtures/fulfillment/`.
 *
 * Scope. This covers the TOP-LEVEL keys of `input_data` only, which is the
 * level the reported bug lived at. Nested field names (`basicOrderType`,
 * `considerationAmount`, `numerator`, `consideration[].startAmount`) are not
 * checked against the spec, because `FulfillOrder.order` there points at the
 * REST `Order` envelope rather than the Seaport order struct the endpoint
 * actually sends, so a nested walk reports a difference that is a spec defect
 * rather than an SDK one. Nested names are covered behaviourally instead, by
 * running the captured payloads through the preflight in
 * `erc20FulfillmentRealPayloads.spec.ts`.
 */

const SOURCE = "src/orders/erc20Fulfillment.ts"

/**
 * Top-level `input_data` keys the preflight reads that the API does not send,
 * mapped to why they are still read. Entries are tolerated aliases, not a list
 * of names to grow: the shipped bug is exactly what an undocumented name looks
 * like before anyone notices.
 */
const TOLERATED_ALIASES: Record<string, string> = {
  basicOrderParameters:
    "Legacy alias kept so an older or non-OpenSea caller passing the pre-#638 " +
    "shape still gets a preflight. The API itself sends `parameters`.",
}

type SchemaNode = {
  properties?: Record<string, unknown>
  allOf?: SchemaNode[]
  oneOf?: { $ref?: string }[]
}

/**
 * The `input_data` union members the OpenAPI spec declares, and every property
 * name across them.
 *
 * The variants are read out of `TransactionData.input_data.oneOf` rather than
 * named here, so a new call shape the API starts returning is picked up without
 * this test being edited.
 */
function specInputData(): { keys: Set<string>; variants: string[] } {
  const schemas = readOpenApiSpec().components.schemas as Record<
    string,
    SchemaNode
  >

  const variants = (
    schemas.TransactionData?.properties?.input_data as SchemaNode | undefined
  )?.oneOf
    ?.map(ref => ref.$ref?.split("/").pop())
    .filter((name): name is string => Boolean(name))

  const keys = new Set<string>()
  for (const variant of variants ?? []) {
    const schema = schemas[variant]
    if (!schema) continue
    for (const node of [schema, ...(schema.allOf ?? [])]) {
      for (const property of Object.keys(node.properties ?? {})) {
        keys.add(property)
      }
    }
  }
  return { keys, variants: variants ?? [] }
}

/**
 * Top-level `input_data` keys the preflight reads, observed rather than parsed.
 *
 * Each probe is wrapped in a Proxy that records every string property read on
 * the top-level object, then handed to both entry points. This watches what the
 * code does, so it survives a rename, an extracted helper, bracket notation, or
 * a computed key. Reading the names out of the source text would not.
 *
 * The empty probe is what makes the set complete. On a real payload each lookup
 * short-circuits as soon as it finds a match, so the later branches are never
 * entered; an input that matches nothing drives every branch to its last resort
 * and reveals the whole set.
 */
function preflightInputDataKeys(): Set<string> {
  const seen = new Set<string>()
  const record = (property: string | symbol) => {
    if (typeof property === "string") {
      seen.add(property)
    }
  }
  // `get` covers a direct read. `ownKeys` and `has` cover the two other ways to
  // reach a key: enumerating the object, and testing for one with `in`. Without
  // those traps a refactor to `Object.keys(inputData)` would read every key and
  // this would observe none of them.
  const recording = (target: Record<string, unknown>) =>
    new Proxy(target, {
      get(object, property, receiver) {
        record(property)
        return Reflect.get(object, property, receiver)
      },
      has(object, property) {
        record(property)
        return Reflect.has(object, property)
      },
      ownKeys(object) {
        const keys = Reflect.ownKeys(object)
        for (const key of keys) {
          record(key)
        }
        return keys
      },
    })

  const probes: Record<string, unknown>[] = [
    {},
    ...REAL_PAYLOADS.map(
      payload => preflightInput(payload.fixture) as Record<string, unknown>,
    ),
  ]
  for (const probe of probes) {
    getErc20Payment(recording(probe))
    getFulfillerConduitKey(recording(probe))
  }
  return seen
}

/** Top-level `input_data` keys observed across the captured responses. */
function capturedInputDataKeys(): Set<string> {
  const keys = new Set<string>()
  for (const payload of REAL_PAYLOADS) {
    for (const key of Object.keys(
      payload.fixture.response.fulfillment_data.transaction.input_data,
    )) {
      keys.add(key)
    }
  }
  return keys
}

describe("ERC20 preflight wire shape", () => {
  test("reads exactly these top-level input_data keys", () => {
    // The inventory the two checks below run against, written out so it is
    // visible in one place and so a key appearing or disappearing is a
    // deliberate edit rather than a silent change in what gets checked. It also
    // guards against the Proxy observing nothing, which would make everything
    // below pass empty.
    expect(
      [...preflightInputDataKeys()].sort(),
      `top-level input_data keys observed while running ${SOURCE}`,
    ).toEqual([
      "advancedOrder",
      "basicOrderParameters",
      "fulfillerConduitKey",
      "order",
      "parameters",
    ])
  })

  test("the spec and the fixtures both carry something to check against", () => {
    // Vacuity guard for the other two inputs: an empty spec lookup or a missing
    // fixture would make the checks below pass without comparing anything.
    const { keys, variants } = specInputData()
    expect(variants.length, "input_data variants in the OpenAPI spec").toBe(7)
    expect(keys.size, "properties across those variants").toBeGreaterThan(5)
    expect(REAL_PAYLOADS.length, "captured fulfillment responses").toBe(4)
  })

  test("every input_data key the preflight reads is one the API documents", () => {
    const documented = specInputData().keys
    const undocumented = [...preflightInputDataKeys()]
      .filter(key => !documented.has(key))
      .filter(key => !(key in TOLERATED_ALIASES))
      .sort()

    expect(
      undocumented,
      `${SOURCE} reads top-level input_data keys that no input_data ` +
        "variant in the OpenAPI spec declares. Either the name is wrong, as " +
        "`basicOrderParameters` was in opensea-sdk#1997, or it is a " +
        "deliberate alias and belongs in TOLERATED_ALIASES with a reason.",
    ).toEqual([])
  })

  test("every documented key is either read or knowingly ignored", () => {
    // The other direction. A key the API sends and the preflight never looks at
    // is fine as long as it is a shape the preflight does not claim to handle,
    // so this only reports what the captured responses actually contain.
    const read = preflightInputDataKeys()
    const unread = [...capturedInputDataKeys()].filter(key => !read.has(key))

    // `criteriaResolvers` and `recipient` ride along with every advanced order
    // and say nothing about the payment; the preflight ignores them on purpose.
    expect(
      unread.sort(),
      `${SOURCE} never reads a top-level input_data key that the captured ` +
        "responses carry. If it is a key the preflight should be reading, this " +
        "is the reported bug again: the name in the code and the name on the " +
        "wire have drifted apart.",
    ).toEqual(["criteriaResolvers", "recipient"])
  })

  test("`basicOrderParameters` appears in no captured response", () => {
    // The premise behind the alias entry above. If the API ever starts sending
    // this name, it stops being an alias and TOLERATED_ALIASES should go.
    expect(
      capturedInputDataKeys().has("basicOrderParameters"),
      "a captured response carries `basicOrderParameters`. Either the API " +
        "changed, or a fixture was hand-edited to match the code, which is " +
        "the mistake these fixtures exist to prevent.",
    ).toBe(false)
    expect(
      capturedInputDataKeys().has("parameters"),
      "no captured response carries `parameters`, so the basic-order fixture " +
        "is missing or no longer holds a basic order",
    ).toBe(true)
  })
})
