import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Locate the OpenAPI spec shipped by `@opensea/api-types`.
 *
 * `node_modules/@opensea/api-types/opensea-api.json` comes first because it is
 * the only location that exists in **both** contexts these suites run in: a
 * workspace symlink in the monorepo, and the installed package on the public
 * `opensea-sdk` mirror, where `packages/api-types/` doesn't exist at all and
 * api-types is an ordinary npm dependency. (`opensea-api.json` is in the
 * package's `files`, so it ships.) The monorepo paths stay as a fallback for
 * a checkout whose deps aren't installed.
 *
 * Deliberately not `import.meta.url`: `tsconfig.check.json` compiles the tests
 * under a module setting that disallows it.
 *
 * Getting this wrong has a price. sdk@11.7.1 was tagged and then failed to
 * publish because a spec lookup only resolved inside the monorepo.
 */
export function findSpecPath(): string {
  let dir = process.cwd()
  for (let depth = 0; depth < 5; depth++) {
    for (const relative of [
      "node_modules/@opensea/api-types/opensea-api.json",
      "packages/api-types/opensea-api.json",
      "../api-types/opensea-api.json",
    ]) {
      const candidate = resolve(dir, relative)
      if (existsSync(candidate)) return candidate
    }
    dir = resolve(dir, "..")
  }
  throw new Error("Could not locate opensea-api.json")
}

export type OpenApiSpec = {
  components: { schemas: Record<string, unknown> }
  paths: Record<string, Record<string, unknown>>
}

/** Parse the spec located by {@link findSpecPath}. */
export function readOpenApiSpec(): OpenApiSpec {
  return JSON.parse(readFileSync(findSpecPath(), "utf8")) as OpenApiSpec
}
