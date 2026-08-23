/**
 * Kept in step with `inferPrimaryType` in @opensea/wallet-adapters
 * (`src/bridges/ethers.ts`). The two are deliberately separate copies: the sdk
 * does not depend on wallet-adapters, and adding that edge would couple the
 * sdk's release to it for one pure function. Change both together.
 */
/**
 * Infer the EIP-712 primary type: the struct that no other struct references,
 * which is the root of the type graph.
 *
 * Taking the first key in `types` instead is wrong whenever a dependency is
 * declared before the root, and it fails silently by signing the wrong struct.
 * ethers resolves this the same way.
 *
 * Refuses rather than guessing when the graph is circular or has more than one
 * root. Both are invalid EIP-712 and ethers rejects them itself ("circular type
 * reference", "ambiguous primary types or unused types"), so throwing costs
 * nothing where the signer validates and prevents a wrong signature where it
 * does not.
 */
export function inferPrimaryType(types: Record<string, unknown>): string {
  const named = Object.keys(types).filter(t => t !== "EIP712Domain")
  if (named.length === 0) {
    return ""
  }

  const referenced = new Set<string>()
  for (const name of named) {
    const fields = types[name]
    if (!Array.isArray(fields)) continue
    for (const field of fields) {
      // Strips trailing array suffixes, including repeated ones: Person[],
      // Person[2] and Mail[2][] all reduce to the struct name. EIP-712 field
      // types are an atomic type, an array of those, or a struct name, so there
      // is no further nesting to unwrap. Solidity tuple syntax is not part of
      // the format.
      const base = String((field as { type?: unknown }).type).replace(
        /(\[\d*\])+$/,
        "",
      )
      if (base in types) referenced.add(base)
    }
  }

  const roots = named.filter(t => !referenced.has(t))
  if (roots.length === 0) {
    throw new Error(
      `Cannot infer EIP-712 primaryType: every type is referenced by another, so the type graph is circular (${named.join(", ")}). Pass primaryType explicitly.`,
    )
  }
  if (roots.length > 1) {
    throw new Error(
      `Cannot infer EIP-712 primaryType: ${roots.join(", ")} are all unreferenced, so the root is ambiguous. Pass primaryType explicitly.`,
    )
  }
  return roots[0]
}
