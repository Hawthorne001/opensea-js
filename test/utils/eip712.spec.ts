import { describe, expect, test } from "vitest"
import { inferPrimaryType } from "../../src/utils/eip712"

const PERSON = [
  { name: "name", type: "string" },
  { name: "wallet", type: "address" },
]

describe("inferPrimaryType", () => {
  test("returns the root when a dependency is declared before it", () => {
    // The bug: taking the first key signs "Person" here.
    expect(
      inferPrimaryType({
        Person: PERSON,
        Mail: [
          { name: "from", type: "Person" },
          { name: "to", type: "Person" },
          { name: "contents", type: "string" },
        ],
      }),
    ).toBe("Mail")
  })

  test("returns the root when it is already declared first", () => {
    expect(
      inferPrimaryType({
        Mail: [{ name: "from", type: "Person" }],
        Person: PERSON,
      }),
    ).toBe("Mail")
  })

  test("ignores EIP712Domain when picking the root", () => {
    expect(
      inferPrimaryType({
        EIP712Domain: [{ name: "name", type: "string" }],
        Person: PERSON,
        Mail: [{ name: "from", type: "Person" }],
      }),
    ).toBe("Mail")
  })

  test("resolves a struct referenced through an array", () => {
    expect(
      inferPrimaryType({
        Person: PERSON,
        Group: [{ name: "members", type: "Person[]" }],
      }),
    ).toBe("Group")
  })

  test("resolves a struct referenced through a fixed and nested array", () => {
    expect(
      inferPrimaryType({
        Person: PERSON,
        Pair: [{ name: "pair", type: "Person[2]" }],
      }),
    ).toBe("Pair")
    expect(
      inferPrimaryType({
        Person: PERSON,
        Grid: [{ name: "rows", type: "Person[2][]" }],
      }),
    ).toBe("Grid")
  })

  test("returns an empty string when only EIP712Domain is declared", () => {
    expect(
      inferPrimaryType({ EIP712Domain: [{ name: "name", type: "string" }] }),
    ).toBe("")
  })

  test("refuses an ambiguous graph rather than guessing", () => {
    expect(() =>
      inferPrimaryType({
        Alpha: [{ name: "n", type: "string" }],
        Beta: [{ name: "n", type: "string" }],
      }),
    ).toThrow(/ambiguous/)
  })

  test("refuses a circular graph rather than guessing", () => {
    expect(() =>
      inferPrimaryType({ Person: [{ name: "friend", type: "Person" }] }),
    ).toThrow(/circular/)
  })
})

// The same function exists in @opensea/wallet-adapters, which the sdk does not
// depend on. This table is the shared contract between the two copies; the
// matching suite there covers the same cases, so a change to one that is not
// made to the other shows up as a diff between these two files.
describe("inferPrimaryType parity contract with @opensea/wallet-adapters", () => {
  const CASES: Array<[string, Record<string, unknown>, string | RegExp]> = [
    [
      "dependency first",
      { Person: PERSON, Mail: [{ name: "f", type: "Person" }] },
      "Mail",
    ],
    [
      "root first",
      { Mail: [{ name: "f", type: "Person" }], Person: PERSON },
      "Mail",
    ],
    [
      "array reference",
      { Person: PERSON, Group: [{ name: "m", type: "Person[]" }] },
      "Group",
    ],
    [
      "nested array reference",
      { Person: PERSON, Grid: [{ name: "r", type: "Person[2][]" }] },
      "Grid",
    ],
    ["domain only", { EIP712Domain: [{ name: "name", type: "string" }] }, ""],
    [
      "ambiguous",
      {
        A: [{ name: "n", type: "string" }],
        B: [{ name: "n", type: "string" }],
      },
      /ambiguous/,
    ],
    ["circular", { Person: [{ name: "friend", type: "Person" }] }, /circular/],
  ]

  test.each(CASES)("%s", (_label, types, expected) => {
    if (expected instanceof RegExp) {
      expect(() => inferPrimaryType(types)).toThrow(expected)
    } else {
      expect(inferPrimaryType(types)).toBe(expected)
    }
  })
})
