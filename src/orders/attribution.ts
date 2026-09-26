/** A 4-byte hex string, the only shape the attribution suffix takes. */
const CALLDATA_SUFFIX_PATTERN = /^0x[0-9a-f]{8}$/i

/**
 * Append the OpenSea attribution suffix to ABI-encoded calldata.
 *
 * The fulfillment endpoints return `calldata_suffix` alongside the transaction
 * they describe: the first four bytes of `keccak256("api.opensea.io")`, which
 * OpenSea's own fills carry as trailing calldata. Seaport reads its arguments
 * from offsets and ignores trailing bytes, so the suffix attributes the fill
 * without affecting execution.
 *
 * This matters because the SDK does not submit the API's calldata. It re-encodes
 * the call from `input_data` and signs that, which drops anything the API had
 * appended, so the suffix has to be re-attached here or the fill lands
 * unattributed.
 *
 * A missing or malformed suffix is ignored rather than raised. Attribution is
 * optional by design and must never be the reason a fill fails.
 */
export function appendCalldataSuffix(
  calldata: string,
  suffix: string | null | undefined,
): string {
  if (!suffix || !CALLDATA_SUFFIX_PATTERN.test(suffix)) {
    return calldata
  }
  return calldata + suffix.slice(2)
}
