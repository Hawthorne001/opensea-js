# @opensea/sdk

## 12.0.1

### Patch Changes

- bbbbfea: Pin the wire shape of the agent handshake bodies.

  `proposeAgentRelationship` and `confirmAgentRelationship` take camelCase, like every other default-path write, and `Fetcher.request` converts to the snake_case the API requires. That was already the behavior, but nothing tested it end to end: the existing specs stub the fetcher, so they show the body being handed straight to `request` and never show the conversion. Reading the method alone, a caller can reasonably conclude they must supply `{counterparty_address, caller_role}` themselves, and the API answers a camelCase body with 400 "Missing required field 'counterparty_address'", which does not name the real problem.

  The new test drives the real fetcher and asserts the exact bytes. No behavior change.

- 34d3a50: `cancelOrders` no longer rejects a batch whose orders name the same Seaport protocol address in different letter cases. The addresses were grouped in a `Set` keyed on the raw string, so one protocol counted as several. Thanks to @Mabolla (ProjectOpenSea/opensea-sdk#1999).
- 34d3a50: Providers: infer the EIP-712 primary type as the root of the type graph instead of taking the first key in `types`. Both the viem adapter and the seaport bridge signed the wrong struct when a dependency was declared before the root, and neither refused an ambiguous or circular type set. Both now share one helper and throw rather than guess, matching what ethers does with the same input. Thanks to @Mabolla (ProjectOpenSea/opensea-sdk#1998, #2000).
- 3cc8640: The wire-shape guard added in #646 observes which `input_data` keys the ERC20
  preflight reads by handing it a recording Proxy. That Proxy only had a `get`
  trap, so a refactor to `Object.keys(inputData)` or an `in` test would have
  reached a key without the guard seeing it. It now traps `ownKeys` and `has` too.

  Tests only, no behaviour change.

- ea967e2: The ERC20 fulfillment preflight is now tested against captured
  `POST /api/v2/listings/fulfillment_data` responses rather than a hand-written
  guess at their shape. Four response bodies are committed verbatim, covering both
  call shapes a single-listing fulfillment can return and both an ERC20-priced and
  a native-priced form of each, and the expected payment total comes from the
  listing price a separate endpoint reports.

  A new `erc20FulfillmentWireShape` suite checks every top-level `input_data` key
  the preflight reads against the `input_data` variants declared in the OpenAPI
  spec, so a name the API does not send has to be justified as a deliberate alias
  instead of silently disabling the guard, which is what shipped in #638.

  No behaviour change and no change to the public API. The keys the check inspects
  are observed at runtime through a recording Proxy rather than read out of the
  source text, so a rename or an extracted helper cannot quietly narrow what gets
  checked.

## 12.0.0

### Major Changes

- 75aa2c2: **Breaking:** removes the retired wallet-level agent designation.

  SDK: `WalletAuthAPI.markWalletAsAgent` and `WalletAuthAPI.removeWalletAgentDesignation` are gone. CLI: `opensea accounts mark-agent` and `opensea accounts remove-agent`, along with `client.accounts.markAgent` and `client.accounts.removeAgent` on `OpenSeaCLI`.

  The endpoints they called, `PUT` and `DELETE /api/v2/accounts/wallets/{wallet}/agent`, no longer exist. os2-core removed them in ProjectOpenSea/os2-core#52946: over the 7 days before that, every `PUT` was rejected with 403 by a kill switch and no wallet's agent flag changed at all. Keeping the methods would mean shipping calls that 404.

  An agent is an account, not a flag on a wallet. Use `declareAgentAccount`, `withdrawAgentAccountDeclaration`, and the `proposeAgentRelationship` / `confirmAgentRelationship` / `revokeAgentRelationship` handshake, or the `opensea agent` command group. Both are unchanged by this release.

  `WalletAgentStatusResponse` is no longer re-exported from the CLI's `types/api`, since the schema goes away with the next spec sync.

### Minor Changes

- 6c0ee99: Add SDK and CLI support for agent accounts, so an agent can declare itself and complete the ownership handshake without hand-rolling HTTP.

  An agent is an account, not a flag on a wallet. Ownership is a relationship between two accounts, mutually confirmed. It is a declaration, not an authorization: naming an account as your agent grants it no ability to act for you. It is self-reported and OpenSea does not verify it. An agent can have no owner at all, and at most one confirmed owner. Either side may withdraw or revoke at any time, which deletes the relationship. Only confirmed relationships are public.

  SDK, on `WalletAuthAPI`: `declareAgentAccount`, `withdrawAgentAccountDeclaration`, `proposeAgentRelationship`, `confirmAgentRelationship`, `revokeAgentRelationship`, and `listOwnAgentRelationships`. `AccountsAPI.getAgentProfileRelationships` already covered the public read.

  CLI, a new `agent` group: `declare`, `withdraw`, `propose`, `confirm`, `revoke`, `list`, and `profile`, plus a matching `client.agent` namespace on `OpenSeaCLI`.

  The scopes differ, which is easy to get wrong. Every write takes `write:wallets` but listing your own relationships takes `read:wallets`, so a client driving the whole handshake must request both or the list call returns 403. `read:wallets` is now in `OPENSEA_SCOPES`, so the default OAuth grant carries it.

  The OpenAPI snapshot is refreshed to generate all of this. That also picks up `read:wallets` in `AuthScope`, which was already live in the scope registry but missing from the committed snapshot, so `scripts/check-auth-scope-drift.mjs` was failing on main beforehand.

  `AgentProfileRelationshipsResponse` no longer surfaces `agent_owner_profile` or `public_agent_wallets`. Both read the retired wallet-level designation, are permanently null and empty, and are removed by os2-core AGE-51. Read `agentOwner` and `agents` instead.

  `markWalletAsAgent` and `removeWalletAgentDesignation` are deprecated. They set a flag on a wallet rather than declaring an account, and the server now rejects new designations; only the removal still works, so an account that set the old flag can clear it.

### Patch Changes

- ddadb41: Replace five hand-rolled API types with the generated ones from `@opensea/api-types`.

  `packages/cli/AGENTS.md` and `packages/api-types/AGENTS.md` both say never to hand-roll API request or response types, but these five predate the rule and duplicated schemas the spec already covered.

  In the SDK: `GetChainsResponse` becomes `Camelize<ChainListResponse>`, `DropMintRequest` and `DropMintResponse` become `Camelize<>` of the identically named generated schemas, `ResolveAccountResponse` becomes `Camelize<AccountResolveResponse>`, and `ValidateMetadataResponse` becomes `Camelize<>` of the generated schema, which decomposes into `ValidateMetadataAssetIdentifier`, `ValidateMetadataDetails`, `ValidateMetadataAttribute` and `MetadataIngestionError`. In the CLI: `ValidateMetadataResponse` becomes a `Schemas[...]` re-export, the one declared violation in a file that is otherwise all re-exports.

  No shape change. Each replacement was diffed field by field against the spec, including required and optional, and they match exactly, so this is types-only with no runtime or behavioral effect. Four of the five were already correct re-exports in the CLI and hand-rolled only in the SDK, so the two packages had disagreed about the same names.

- cfbb465: `onItemReceivedOffer` is now a no-op. The Stream API does not emit `item_received_offer` and never has, so the method only ever registered a handler that could not fire. Confirmed against production: four minutes on `collection:*` delivered 736k events across ten event names and this was not among them, while every other type appeared within 1.8s.

  Item-level offers arrive as `item_received_bid`, which carries an identical payload. Use `onItemReceivedBid`.

  The method stays callable so existing code compiles and runs unchanged, and it no longer opens a connection for a topic that yields nothing. `EventType.ITEM_RECEIVED_OFFER`, `ItemReceivedOfferEvent`, and `ItemReceivedOfferEventPayload` are kept for source compatibility but marked deprecated and hidden from the generated docs.

- 6e77b5e: `fulfillOrder` now appends the attribution suffix the fulfillment endpoints return, so fills built by the SDK are attributed to OpenSea onchain. They were not before: the API returns `calldata_suffix` (the first four bytes of `keccak256("api.opensea.io")`) and carries it as trailing calldata on its own transactions, but the SDK re-encodes the call from `input_data` and signed that instead, which dropped it. Seaport reads its arguments from offsets and ignores trailing bytes, so the suffix does not affect execution. A missing or malformed suffix is ignored rather than raised.

  Private listings are unaffected. They are fulfilled locally through seaport-js and never receive API calldata, so there is no suffix to re-attach. `fulfillPrivateOrder` already takes a `domain` for that purpose; `fulfillOrder` neither accepts nor forwards one, so private fills through it stay unattributed.

  `FulfillmentDataResponse` is now derived from `@opensea/api-types` instead of hand-rolled. It had drifted: no `calldataSuffix`, no `valueHex`, four `inputData` members against the spec's seven, and a basic-order member named `basicOrderParameters` where the API sends `parameters`, so that branch never matched and the fallback built the arguments instead. Same result for a single-field struct, so no behavior change there.

- f74c0be: Deduplicate Stream API payload types and logging internals without changing the public API.
- Updated dependencies [5fdac00]
  - @opensea/api-types@0.8.10

## 11.9.0

### Minor Changes

- d355093: Three fixes from community reports on the public mirror, each of which changes behavior for input that previously produced a wrong answer or an unhelpful crash.

  **`getTraits` no longer camelizes its response.** The fetcher rewrites every response's keys from snake_case to camelCase, which is right for the spec-derived endpoints and wrong for this one: its keys are the collection's own trait names and trait values. A `fur_color` trait was reported as `furColor`, and a collection with both `dark_brown` and `darkBrown` values had them merged into one entry whose count was wrong, with nothing in the response to indicate it. `RequestOptions` gains a `camelizeResponse` opt-out, honored by both reads and writes, and `getTraits` is the only caller that sets it. If you have been reading camelized trait keys since 11.0.0, they now come back as the collection authored them. (ProjectOpenSea/opensea-js#1989)

  **`parseUnits` accepts scientific notation from strings.** It only stripped exponent notation when the value was a `number`, so `parseUnits("1e-8", 18)` reached `BigInt` intact and threw `Cannot convert 1e-8000000000000000000 to a BigInt`. Any caller that stringifies an amount first hit this, including the SDK's own `wrapEth`, `unwrapWeth`, and listing/offer price paths, which all call `amount.toString()`. Expansion is now done with string math rather than `Number.prototype.toFixed`, so large values stay exact (`toFixed` corrupts above 2^53 and returns exponential notation again at or above 1e21) and a value below the token's precision throws `Too many decimal places` rather than silently truncating to zero. Malformed input now throws `Invalid decimal value` instead of a raw `SyntaxError` from `BigInt`, and an empty string throws rather than parsing as `0`. (ProjectOpenSea/opensea-js#1990)

  **Private listings reject payment items in different tokens.** `constructPrivateListingCounterOrder` checked that every payment item shared an `itemType` but not that they shared a token, then summed them into a single offer item denominated in the first item's token: 100 TOKEN_A plus 20 TOKEN_B became 120 TOKEN_A. Seaport rejected the resulting match, so the failure surfaced as an onchain revert instead of an SDK error. Token comparison is case-insensitive, so the same address in checksummed and lowercase form is still one currency. (ProjectOpenSea/opensea-js#1991)

- 8527112: Add the OpenSea Stream API client at the `@opensea/sdk/stream` subpath, replacing the standalone `@opensea/stream-js` package.

  The client speaks the Phoenix Channels wire protocol directly instead of depending on `phoenix`, so the subpath resolves to six local files and no third-party runtime code. Importing it pulls in neither ethers nor seaport. The transport sits behind an internal interface so a future Stream API v2, which will not use Phoenix framing, can be added without a breaking change.

  Migrating from `@opensea/stream-js` is mostly an import change. See `developerDocs/stream-migration.md`.

  - Node users no longer need `ws` or `node-localstorage`. Node 22+ and browsers supply a global `WebSocket`, and `sessionStorage` was only read by an unused long-poll fallback.
  - `apiKey` replaces `token` in `ClientConfig`. `token` still works and is deprecated.
  - `connectOptions` is now `StreamConnectOptions` rather than `Partial<SocketConnectOption>` from `@types/phoenix`. Options that only fed the long-poll fallback and binary serializer are gone.
  - Unsubscribing now removes a single handler instead of leaving the whole collection channel. Previously, two subscriptions on one collection meant unsubscribing from one silently stopped the other.
  - `engines.node` is raised to `>=22.0.0`. Node 20 reached end of life in April 2026.

### Patch Changes

- 8715ac2: Point the package metadata at the renamed public repo, `ProjectOpenSea/opensea-sdk`. `repository.url` and `bugs.url` both moved, so the npm page links to the right place rather than relying on GitHub's rename redirect. The npm package name is unchanged.

  Also drops the TypeDoc setup that fed the GitHub Pages site at `projectopensea.github.io/opensea-js`. Nothing published it: no workflow built the `gh-pages` branch, so the site had been serving v8.0.20 docs against a shipped 11.8.0 for months. The `docs-build` and `docs-build-md` scripts, the `typedoc` and `typedoc-plugin-markdown` devDependencies, and `.config/typedoc.json` are gone, along with the dead Coveralls badge (that project returns 403 and no CI job has uploaded coverage in a long time). Method-level reference docs live in `developerDocs/api-reference.md`.

## 11.8.0

### Minor Changes

- 59f9799: Check the payment token before fulfilling an ERC20-denominated listing. `fulfillOrder` now reads the buyer's balance and their allowance for the address Seaport pulls the payment through (the conduit registered for the fulfiller conduit key, or Seaport itself when that key is `bytes32(0)`), and throws an error naming the spender and the exact `approve` amount instead of letting the transaction revert with a bare "execution reverted". Native-priced listings and offer fulfillments are unaffected, and an unreadable response shape or a failed RPC read skips the check rather than blocking the purchase.

### Patch Changes

- c5e2906: `createListingAndValidateOnchain()`, `createOfferAndValidateOnchain()`, `buildListingOrderComponents()` and `buildOfferOrderComponents()` no longer request an EIP-712 signature. They built the order by running seaport-js `executeAllActions()`, which signs, and then discarded the signature before validating the order onchain. Callers got a wallet signature prompt for nothing, and contract accounts that cannot produce an offchain signature could not use the onchain path at all, which is the case it exists for. Token approvals still run, and each is confirmed before the order is validated.

  `validateOrderOnchain()` takes an optional third `protocolAddress` argument and rejects a protocol OpenSea does not support, matching `approveOrder()` and the fulfillment methods.

  Requires `@opensea/seaport-js` 4.2.0, which adds the `executeApprovals()` and `orderComponents` APIs this relies on.

## 11.7.3

### Patch Changes

- 4dd7c67: `cancelOrder()` now returns the cancellation transaction hash, matching `cancelOrders()`. The hash was computed internally and discarded, so callers had no way to track a single-order cancellation. Thanks to @Sertug17 for the fix (opensea-js#1982).
- 280acf2: Fix `WalletAuthAPI.linkWallet()` sending a snake_cased request body. `link_wallet_with_siwx` is camelCase on the wire and `chainArch` is required, so the default conversion renamed it to `chain_arch` and the call failed validation every time. The nested SIWX `message` keys were being renamed too, which the server needs intact to rebuild the message the wallet signed. Thanks to @crazywriter1 for the fix (opensea-js#1988).
- Updated dependencies [d88963f]
  - @opensea/api-types@0.8.8

## 11.7.2

### Patch Changes

- 23a3772: Fix the wallet-auth casing test failing on the public `opensea-js` mirror

  The spec-derived tripwire added in 11.7.1 located `opensea-api.json` at `packages/api-types/opensea-api.json`, which only exists inside the devtools monorepo. On the public mirror the SDK is synced standalone and `@opensea/api-types` is an ordinary npm dependency, so the lookup threw and failed `npm test` during the publish workflow — blocking the 11.7.1 npm release.

  It now resolves `node_modules/@opensea/api-types/opensea-api.json` first, the one path present in both layouts (a workspace symlink in the monorepo, the installed package on the mirror), keeping the monorepo paths as a fallback. No change to what the test asserts.

## 11.7.1

### Patch Changes

- 0031eed: Add SDK and CLI support for wallet visibility and agent profile relationships

  - `@opensea/sdk`: add `WalletAuthAPI.makeWalletPrivate`, `WalletAuthAPI.makeWalletPublic`, and `WalletAuthAPI.getAgentProfileRelationships`.
  - `@opensea/sdk`: export `WalletVisibilityResponse`, `AgentProfileRelationshipsResponse`, `SvmInstructionAccountResponse`, `SvmInstructionResponse`, and `SvmTransactionDetailsResponse` types.
  - `@opensea/cli`: add `accounts make-private`, `accounts make-public`, and `accounts agent-relationships` commands.
  - `@opensea/cli`: export the new wallet visibility, agent relationship, and SVM transaction detail types.

- 7d2dbef: Sync OpenAPI spec: add `stablechain` to `ChainIdentifier`, add `Chain.StableChain` (chain id 988) to the SDK and generated chain maps
- f67fbc6: Fix wallet-auth writes corrupting camelCase request bodies

  `Fetcher.request` snake_cases every body by default, but four wallet-auth endpoints declare **camelCase** properties in their OpenAPI schemas. Those calls were being sent with keys the server doesn't recognise:

  - `setProfileNftPfp` — `contractAddress` and `tokenId` are required, so the call **always failed validation**. It could never succeed.
  - `createProfileImageUpload` — `imageType` and `contentType` are required, so this **always failed** too.
  - `updateProfileSettings` — all fields optional, so the request returned 200 while silently discarding `displayName`, `externalUrl`, `profileImageToken`, and `bannerImageToken`. Only `bio` worked, because it's a single word with no casing to mangle.
  - `cancelOrder` — `offererSignature` was silently dropped, turning a signed cancel into an unsigned one.

  All four now send the body verbatim via `snakeizeBody: false`, the same opt-out the Seaport order and offer helpers already use. Endpoints whose wire format really is snake_case are unchanged.

- Updated dependencies [7d2dbef]
- Updated dependencies [8b7ddd2]
- Updated dependencies [0031eed]
  - @opensea/api-types@0.8.7

## 11.7.0

### Minor Changes

- a093a89: Add first-class SDK and CLI access to materialized token activity stats, with typed window selection and response models.

### Patch Changes

- 954d547: Add typed account agent status fields and helpers to mark or clear registered
  agent wallets from the SDK and CLI.
- Updated dependencies [954d547]
  - @opensea/api-types@0.8.6

## 11.6.0

### Minor Changes

- cba26dd: Add typed SDK and CLI support for building cross-chain drop mint transactions and polling the returned receipt request.

### Patch Changes

- Updated dependencies [cba26dd]
  - @opensea/api-types@0.8.4

## 11.5.1

### Patch Changes

- 8df1f43: Require the collection image MIME type in `walletAuth.createCollectionImageUpload` and allow body-less `walletAuth.cancelOrder` calls when no offerer signature is needed.
- 14fcba5: Add `walletAuth.setProfileNftPfp` and `walletAuth.clearProfileNftPfp` helpers for the new `POST`/`DELETE /api/v2/profile/nft-pfp` endpoints, letting an authenticated wallet set or clear an owned NFT as its profile picture.

## 11.5.0

### Minor Changes

- bf5874d: Add `getAccountTokenActivity` to `TokensAPI` and `OpenSeaAPI` for `GET /api/v2/account/{address}/token-activity`. Derive `Contract`, `TokenBalance`, `GetTrendingTokensResponse`, `GetTopTokensResponse`, `GetAccountTokensResponse`, `CollectionSearchResult`, `TokenSearchResult`, `NftSearchResult`, `AccountSearchResult`, `SearchResult`, and `SearchResponse` from `@opensea/api-types` schemas with nullable-field overrides where the live API returns `null` for optional fields.
- bf5874d: Update `Token` and `GetTokenResponse` to derive from the OpenAPI `TokenResponse` and `TokenDetailedResponse` schemas, exposing new fields including `usdPrice`, `isVerified`, `marketCapUsd`, `volume24h`, `priceChange24h`, `holdersCount`, `createdAt`, `genesisDate`, `description`, `stats`, `socials`, and `status`.

### Patch Changes

- 9bc9708: Require explicit scopes for private-key CLI login, and add typed SDK helpers for the wallet-authenticated social and saved-tools REST endpoints.

## 11.4.9

### Patch Changes

- 06e96e1: Use the current SIWE session, scoped-token creation, token-exchange, session refresh, and session-only revocation endpoints in the SDK and CLI.
- feb1446: Sync OpenAPI spec: add `/api/v2/saved-tools` (GET/POST/DELETE) beta endpoints and `read:tools`/`write:tools` auth scopes, new saved-tool schemas, and additive token fields (`is_verified`, `holders_count`, `created_at`, `genesis_date`, `description_source`, `subreddit_identifier`). Adds `OPENSEA_SCOPES.READ_TOOLS`/`WRITE_TOOLS` to the SDK.
- Updated dependencies [feb1446]
  - @opensea/api-types@0.8.2

## 11.4.8

### Patch Changes

- fa2a24e: Add the canonical `read:social` and `write:social` wallet-auth scopes.
- Updated dependencies [66396b6]
- Updated dependencies [fa2a24e]
- Updated dependencies [333104e]
- Updated dependencies [d7a44df]
  - @opensea/api-types@0.8.1

## 11.4.7

### Patch Changes

- b6abc18: Reject explicit empty OAuth scope lists to prevent the authorization server from expanding them to every account role.

## 11.4.6

### Patch Changes

- a410930: Request Zitadel's role-specific scopes so OAuth tokens are limited to the OpenSea scopes the client asked for.

## 11.4.5

### Patch Changes

- d10626b: Add an `opensea whoami` command that displays the current wallet identity,
  scope source, and expiry, with unverified JWT diagnostics available through an
  explicit flag. Expose whether OAuth scopes came from the authorization-server
  response or a JWT fallback.

## 11.4.4

### Patch Changes

- d846160: Use the current OpenSea API endpoints for SIWE login, scoped-token exchange, refresh, revocation, and wallet-link nonces.

## 11.4.3

### Patch Changes

- b64a4d5: Require complete OAuth wallet sessions, retain refresh tokens during rotation, validate the CLI auth store, and preserve case-sensitive wallet addresses.

## 11.4.2

### Patch Changes

- 5966017: Keep the default SDK test suite offline by blocking unmocked network requests and running live API and RPC checks through the integration suite.

## 11.4.1

### Patch Changes

- 71ae9ee: Keep OAuth scope status aligned with the OpenAPI scope catalog when the token endpoint omits its `scope` field.

## 11.4.0

### Minor Changes

- df2b152: Add SIWX wallet-link helpers for nonce, message, and link flows.
- 4bef9a5: Add typed `api.walletAuth` helpers for all 29 scoped wallet operations.

### Patch Changes

- 2459068: Align wallet-auth scope metadata with the production OpenAPI specification.
- 0df96eb: Enable Seaport support for Robinhood chain. Canonical Seaport 1.6 is deployed on Robinhood (chain id 4663) and configured in the marketplace backend, so the payment-token helpers no longer throw for it: offers use WETH `0x0bd7d308f8e1639fab988df18a8011f41eacad73`, listings use native ETH, and the chain uses the same default conduit as Abstract, HyperEVM, and Monad.
- Updated dependencies [df2b152]
- Updated dependencies [2459068]
- Updated dependencies [4bef9a5]
  - @opensea/api-types@0.8.0

## 11.3.0

### Minor Changes

- df2b152: Add public SIWX wallet-link support for agents: export nonce generation, message signing, and wallet-link verification helpers (`generateSiwxNonce`, `generateSiwxMessage`, and `verifyWalletLink` functions) from `src/auth/siwx.ts` for integrating keyless wallet-link flows in autonomous agent environments.

### Patch Changes

- 0df96eb: Enable Seaport support for Robinhood chain (4663): canonical Seaport 1.6 is now configured for Robinhood, enabling payment-token helpers and offer/listing generation. Robinhood uses WETH `0x0bd7d308f8e1639fab988df18a8011f41eacad73` for offers, native ETH for listings, and the same default conduit as Abstract, HyperEVM, and Monad.
- ba30caf: Fix `parseUnits` to correctly handle string inputs with scientific notation (e.g., `"1e-8"`, `"1E6"`). Previously only number-type values were normalized, causing SyntaxError for string scientific notation. Fixes ProjectOpenSea/opensea-js#1978.
- Updated dependencies [df2b152]
  - @opensea/api-types@0.7.0

## 11.2.0

### Minor Changes

- ef89be8: Add SIWE authentication helpers: `OpenSeaAuth` class with authenticate, getValidToken, and revoke methods. Support `authToken` and `authBaseUrl` in `OpenSeaAPIConfig` for wallet-authenticated endpoints.
- e61a57c: Add `OpenSeaOAuth` OAuth 2.1 helper (authorization-code + PKCE, device authorization grant, refresh, and revoke) for keyless login against the OpenSea authorization server. Exposes `OpenSeaOAuthConfig`, `OAuthToken`, and related types, plus a `decodeJwtPayload` utility for reading token claims.
- ef89be8: Add `OPENSEA_SCOPES`, `OpenSeaScope`, and `ALL_SCOPES` exports — scope constants derived from the OpenAPI spec's `AuthScope` schema (via `@opensea/api-types`), with compile-time assertions that fail the build if they drift from the spec.
- c460fc1: Add wallet trading P&L methods to `OpenSeaAPI`: `getWalletPnl`,
  `getWalletClosedPositions`, and `getWalletTokenTransfers`, with camelized
  `WalletPnlResponse`, `ClosedPositionsResponse`, and
  `PositionTokenTransfersResponse` types plus `WalletClosedPositionsArgs` /
  `WalletTokenTransfersArgs` query args.

### Patch Changes

- b816727: Add missing chain payment-token mappings for Soneium and AnimeChain, and make Solana/Hyperliquid fail fast with clear unsupported-chain errors for OpenSea Seaport offer/listing helpers. This fixes the chain helper drift tracked in ProjectOpenSea/opensea-js#1975.
- c9d8cb1: Recreate the community fixes from ProjectOpenSea/opensea-js#1974 and ProjectOpenSea/opensea-js#1976: validate `amount` before `parseUnits` in `_getPriceParameters`, and reject `cancelOrders` batches that mix protocol addresses. Also add a runtime chain-helper exhaustiveness guard so new `Chain` values are consciously categorized.
- e59df7f: Sync OpenAPI spec: add tool activity endpoint, `robinhood` chain, `source`/`collection` search filters, `calldata_suffix` on fulfillment, SIWX wallet-link endpoint (`POST /api/v2/accounts/wallets/siwx` with `LinkWalletSiwxRequest`/`WalletLinkResponse`), re-published `GET /api/v2/account/{address}/favorites`, and the new `write:wallets` auth scope (also added to the SDK's `OPENSEA_SCOPES`)
- Updated dependencies [e59df7f]
- Updated dependencies [c460fc1]
- Updated dependencies [ef89be8]
  - @opensea/api-types@0.6.0

## 11.1.2

### Patch Changes

- Updated dependencies
  - @opensea/api-types@0.5.0

## 11.1.1

### Patch Changes

- fix: correct `GetSwapQuoteArgs` to match the swap quote endpoint. `getSwapQuote` now takes `{ fromChain, fromAddress, toChain, toAddress, quantity, address, slippage?, recipient? }`, matching `GET /api/v2/swap/quote` (the previous `{ tokenIn, tokenOut, amount, chain }` shape did not map to the endpoint's query params).

## 11.1.0

### Minor Changes

- 8fa9fb5: Expose the new `token/{chain}/{address}/holders` and `token/{chain}/{address}/liquidity-pools` endpoints across SDK, CLI, and skill.

  ## SDK (`@opensea/sdk`)

  - `OpenSeaAPI.getTokenHolders(chain, address, args?)` → `TokenHoldersResponse` — paginated holders (`limit`, `cursor`, `sortBy: "QUANTITY"`, `sortDirection`) plus aggregate distribution health (`STRONG | HEALTHY | CONCERNING | BAD`).
  - `OpenSeaAPI.getTokenLiquidityPools(chain, address, args?)` → `TokenLiquidityPoolsResponse` — pools with pool type, USD reserves, bonding-curve progress, graduation flag.
  - New type exports: `TokenHoldersResponse`, `TokenHoldersArgs`, `TokenLiquidityPoolsResponse`, `TokenLiquidityPoolsArgs`.
  - New path helpers in `apiPaths.ts`: `getTokenHoldersPath`, `getTokenLiquidityPoolsPath`.

  ## CLI (`@opensea/cli`)

  - `opensea tokens holders <chain> <address> [--limit] [--next] [--sort-by] [--sort-direction]`
  - `opensea tokens liquidity-pools <chain> <address> [--limit]`
  - SDK class additions: `OpenSeaCLI.tokens.holders(...)`, `OpenSeaCLI.tokens.liquidityPools(...)`.
  - New type re-exports: `TokenHoldersResponse`, `TokenLiquidityPoolsResponse`.

  ## Skill (`@opensea/skill`)

  - `tokens/opensea-token-holders.sh <chain> <address> [limit] [cursor] [sort_by] [sort_direction]`
  - `tokens/opensea-token-liquidity-pools.sh <chain> <address> [limit]`
  - Documentation: added rows to `SKILL.md` (Investigation Scripts) and `references/rest-api.md` (Tokens).

  Bumps consume `@opensea/api-types` 0.4.3 (released alongside, see the spec-sync PR for full schema details).

### Patch Changes

- Updated dependencies [96928f4]
- Updated dependencies [90702a7]
  - @opensea/api-types@0.4.3

## 11.0.0

### Major Changes

- e7deba3: Rebuild the SDK's type layer on `@opensea/api-types` with automatic case translation at the fetcher boundary. Consumer API stays camelCase; underneath, the fetcher snakeizes outgoing query params and POST bodies and camelizes responses, so the SDK no longer ships hand-rolled response shapes.

  ## What changed

  ### Types are sourced from `@opensea/api-types`

  The Order family, NFT/Trait, Drop family, Collection, Account, Payment, Chain, Token, and event response shapes now derive directly from the generated OpenAPI types via a generic `Camelize<T>` mapper. When the API spec gains a field, the SDK type picks it up automatically — no per-endpoint converter to keep in sync. The old `utils/converters.ts` is gone.

  ### Case translation at the fetcher boundary

  `utils/case.ts` ships two utilities:

  - `camelizeKeysDeep<T>` / `Camelize<T>` — walks the API response and rewrites snake_case keys to camelCase.
  - `snakeizeKeysDeep<T>` / `Snakeize<T>` — the inverse, applied to query params and POST bodies on the way out.

  Consumers always see camelCase; the API always sees snake_case. No converter drift, no field-name typos.

  ### Narrowing intersections preserved

  Where the OpenAPI spec is too loose, the SDK still narrows:

  - `Listing.type` is the `OrderType` enum (spec ships plain `string`).
  - `Listing.status` / `Offer.status` are the `OrderStatus` enum.
  - `Order` / `Offer` / `Listing` `.protocolData` is the seaport-js `OrderWithCounter` (the SDK passes it directly to Seaport).

  ### Shape changes consumers should know about

  These come from aligning with what the API actually returns:

  - `Order.protocolData` and `Order.protocolAddress` are **optional**. They're populated on every endpoint except the profile listings/offers endpoints, where the API intentionally returns null for performance. Code that reads them unconditionally needs a guard.
  - `Order` base type no longer carries `price` — only `Offer` and `Listing` do (matching the API).
  - `Offer` and `Listing` gain `remainingQuantity` (required), `orderCreatedAt`, and `asset?: OrderAsset` (the field added in ProjectOpenSea/os2-core#42022 for profile endpoints).
  - `NFT` is now `NftDetailed` — gains `displayImageUrl`, `displayAnimationUrl`, `originalImageUrl`, `originalAnimationUrl`, `animationUrl`, `isSuspicious`, `subscription`, `owner.quantityString`. Drops stale `rarity.{score,calculatedAt,maxRank,tokensScored,rankingFeatures}` that weren't actually in the spec.
  - `TokenBalance` gains optional `status`, `baseTokenLiquidityUsd`, `quoteTokenLiquidityUsd`.
  - `RarityStrategy` is now `Camelize<Rarity>` from api-types — `{ strategyId, strategyVersion, rank? }`. The previous extra fields (`calculatedAt`, `maxRank`, `tokensScored`) were spec-incomplete patches.
  - `GetCollectionResponse` is now an alias for `OpenSeaCollection` — the previous `{ collection: OpenSeaCollection }` wrapper never matched the actual API response.
  - Acronym casing follows generic snake→camel rules: `is_nsfw` → `isNsfw` (not `isNSFW`).
  - `PaymentToken.image` (was `imageUrl`) — the spec uses `image`; the previous converter renamed it. Code reading `paymentToken.imageUrl` should switch to `paymentToken.image`.

  ### Removed

  - `utils/converters.ts` (`collectionFromJSON`, `accountFromJSON`, `paymentTokenFromJSON`, `feeFromJSON`, `rarityFromJSON`, `pricingCurrenciesFromJSON`) and the corresponding test file.

  ### Surfaces the new `Order.asset` field

  Profile endpoints (`/account/{address}/listings`, `/offers`, `/offers_received`) now expose `asset: { identifier?: string; contract: string }`, so consumers no longer have to parse Seaport `protocolData.parameters.offer[0]` to identify the NFT.

### Patch Changes

- fb03c09: Source `EventPayment`, `EventAsset`, `GetNFTResponse`, `BuildOfferResponse`, and `CancelOrderResponse` from `@opensea/api-types` instead of hand-rolling them. Same shapes consumers see today (after camelize at the fetcher), now auto-tracking the OpenAPI spec.

  - `EventPayment` → `Camelize<Payment>`
  - `EventAsset` → `Camelize<Nft>` (gains `original_image_url`, `original_animation_url`, and `traits` fields the API also returns)
  - `GetNFTResponse` → `Camelize<NftResponse>`
  - `BuildOfferResponse` → `Camelize<BuildOfferResponse>` (api-types ships this with camelCase keys natively)
  - `CancelOrderResponse` → `Camelize<CancelResponse>`

  The narrow event types (`ListingEvent`, `OfferEvent`, `TraitOfferEvent`, `CollectionOfferEvent`, `OrderEvent`, `MintEvent`, `SaleEvent`, `TransferEvent`) and `AssetEvent` union keep their existing SDK definitions — they're refinements that narrow `eventType` to specific enum values, which the api-types `OrderEvent`/`SaleEvent`/`TransferEvent` schemas don't model.

- 68b07cb: Fix critical bugs introduced by the api-types migration where unconditional body snakeize corrupted Seaport-shaped POST payloads.

  ## What was broken

  The OpenSea OpenAPI spec is **mixed-casing**: outer envelope keys are snake_case (`protocol_address`, `protocol_data`, `order_hash`) but inner Seaport struct keys are camelCase to mirror the on-chain struct (`parameters.startTime`, `parameters.endTime`, `parameters.orderType`, `parameters.zoneHash`, `parameters.conduitKey`, `parameters.totalOriginalConsiderationItems`, `parameters.offer[].itemType`, `parameters.offer[].identifierOrCriteria`, etc.). A few top-level request fields are also camelCase per spec: `CancelRequest.offererSignature`, `CriteriaObject.numericTraits`.

  The blanket `snakeizeKeysDeep(body)` at the fetcher boundary recursively rewrote every inner key to snake_case, breaking:

  - `postListing` / `postOffer` — Seaport `parameters` sent with snake_case keys the API rejected (or that no longer matched the EIP-712 signature digest).
  - `offchainCancelOrder` — `offererSignature` shipped as `offerer_signature`, silently dropping the cancel signature.
  - `buildOffer` / `postCollectionOffer` — `criteria.numericTraits` shipped as `numeric_traits`, broadening trait offers to the whole collection.

  ## Fix

  Added `snakeizeBody?: boolean` (default `true`) to the public `Fetcher.post()` method. Internal callsites whose wire bodies contain camelCase keys now pass `snakeizeBody: false` and emit bodies in exact wire shape:

  - `OrdersAPI.postListing`, `OrdersAPI.postOffer` — outer `protocol_address` snake_case; inner `parameters` preserved camelCase via spread of the Seaport `OrderWithCounter`.
  - `OrdersAPI.offchainCancelOrder` — body `{ offererSignature }` preserved.
  - `OffersAPI.buildOffer`, `OffersAPI.postCollectionOffer` — outer `protocol_address` / `protocol_data` / `offer_protection_enabled` snake_case; `criteria.numericTraits` preserved camelCase.

  The default behavior (snakeize-all) is unchanged for any caller of `api.post()` that doesn't hit a mixed-casing endpoint.

  ## Other related fixes

  - `OpenSeaAPI.requestInstantApiKey` (and the `OpenSeaSDK` passthrough) now camelizes its response — previously it called `fetch()` directly and returned snake_case despite the typed surface promising `{ apiKey, expiresAt, ... }`. JSDoc examples on both methods corrected.
  - `OpenSeaRateLimitError.responseBody` is now camelized to match the rest of the boundary contract.
  - `_fetch` error envelope is camelized before reading `.errors`, so nested snake_case keys no longer leak into thrown Error messages.
  - `camelToSnake` no longer emits a leading underscore for PascalCase / acronym keys (`URL` → `url`, `MyKey` → `my_key`). The corresponding `Snakeize<T>` type was updated to match the runtime.
  - `OpenSeaAccount.socialMediaAccounts` defends against the wire returning `null` (the previous hand-rolled converter did `?? []`; the new pipeline did not).
  - Dead-code OrderV2/Order casts dropped in `fulfillment.ts` — both branches read the same camelCase property after the migration.

  ## Tests

  Added 11 unit tests covering `snakeizeKeysDeep` (flat + nested objects, array walking, multi-segment, primitives, null/undefined, Date passthrough, top-level `offererSignature`/`protocolAddress` rewrite, position-0 guard). The previous test file imported only `camelizeKeysDeep` — the entire outbound translator had zero unit coverage, which is how these bugs slipped through.

  A new CI workflow (`.github/workflows/sdk-integration.yml`) runs the SDK integration suite nightly and on PRs labeled `run-integration`, so future fetcher-boundary regressions are caught against the live API.

- Updated dependencies [fb03c09]
  - @opensea/api-types@0.4.2

## 10.5.0

### Minor Changes

- 051b558: Surface 22 new endpoints added in `@opensea/api-types` 0.4.0 as SDK methods and CLI commands.

  **`@opensea/sdk`** — new methods on `OpenSeaAPI` (and the underlying domain clients):

  - `getTokensBatch`, `getNFTsBatch`, `getCollectionsBatch` — batch lookups
  - `createListingActions` — ordered approval + Seaport-sign actions for new listings
  - `deployDropContract`, `getDeployContractReceipt` — drop contract deployment
  - `transferAssets` — build transactions to transfer NFTs or tokens
  - `getCollectionOfferAggregates`, `getCollectionHolders`, `getCollectionFloorPrices` — collection analytics
  - `getTokenPriceHistory`, `getTokenOhlcv`, `getTokenActivity` — token analytics
  - `getNFTOwners`, `getNFTAnalytics` — NFT analytics
  - `getPortfolioStats`, `getPortfolioHistory`, `getProfileOffers`, `getProfileOffersReceived`, `getProfileListings`, `getProfileFavorites`, `getProfileCollections` — account profile

  New internal `AssetsAPI` client; new request/response types re-exported through `@opensea/sdk` (from `@opensea/api-types`).

  **`@opensea/cli`** — new commands on the existing `accounts`, `collections`, `nfts`, `tokens`, `listings`, `drops` subcommands, plus a new `assets transfer` subcommand. SDK class methods mirroring the same surface added to `OpenSeaCLI`.

  No removed endpoints; pure additive release.

## 10.4.0

### Minor Changes

- 94dbf08: Sync downstream packages to the API surface introduced in `@opensea/api-types` 0.3.0 (os2-core#40171 + #40190): drop methods backed by removed endpoints, fix POST shapes, and surface the four new endpoints (`/listings/sweep`, `/offers/collection/{slug}/nfts/{identifier}`, `/swap/execute`, `/transactions/receipt`).

  ### `@opensea/sdk` — breaking

  **Removed methods** (the underlying GET endpoints were deleted; they would return 404 against the new API):

  - `OpenSeaAPI.getOrder` / `OrdersAPI.getOrder` — was already `@deprecated`. Use `getBestOffer` / `getBestListing` for "best" or `getAllOffers` / `getAllListings` for collection-wide results.
  - `OpenSeaAPI.getOrders` / `OrdersAPI.getOrders` — was already `@deprecated`. Use `getAllOffers` / `getAllListings`.
  - `OpenSeaAPI.postOrder` / `OrdersAPI.postOrder` — was already `@deprecated`. Use `postListing` / `postOffer`.
  - `OpenSeaAPI.getNFTOffers` / `OffersAPI.getNFTOffers` — replaced by `getOffersByNFT(slug, tokenId)` (new endpoint takes a collection slug, not contract address).
  - `OpenSeaAPI.getNFTListings` / `ListingsAPI.getNFTListings` — no per-NFT all-listings endpoint exists. Use `getBestListing(slug, tokenId)` for the best, or `getAllListings(slug)` and filter client-side.
  - Helpers `getOrdersAPIPath`, `serializeOrdersQueryOptions`, `deserializeOrder` — orphaned with the methods above.
  - Types `OrderAPIOptions`, `OrdersQueryOptions`, `OrdersQueryResponse`, `OrdersPostQueryResponse`, `ListingPostQueryResponse`, `OfferPostQueryResponse`, `SerializedOrderV2`, `GetOrdersResponse` — unused after the deletions.
  - Stats fields `IntervalStat.{volume_diff, volume_change, sales_diff, average_price}` and `Stats.{market_cap, average_price}` — server stopped returning them (always `0` previously).

  **Behavior changes:**

  - `OrdersAPI.postListing` and `OrdersAPI.postOffer` now read the bare `Listing` / `Offer` response (the upstream API dropped the legacy `order` wrapper field).
  - `OpenSeaSDK.createOffer` returns `Promise<Offer>` (was `Promise<OrderV2>`).
  - `OpenSeaSDK.createListing` returns `Promise<Listing>` (was `Promise<OrderV2>`).
  - `OpenSeaSDK.createBulkListings` returns `Promise<BulkOrderResult<Listing>>`; `createBulkOffers` returns `Promise<BulkOrderResult<Offer>>`. `BulkOrderResult` is now generic in the success type.

  **New methods:**

  - `OpenSeaAPI.getOffersByNFT(slug, identifier, limit?, next?)` — all offers for one NFT.
  - `OpenSeaAPI.sweepCollection(request)` — bulk-buy items from a collection, any payment token (incl. cross-chain).
  - `OpenSeaAPI.executeSwap(request)` — multi-asset swap; companion to `getSwapQuote`.
  - `OpenSeaAPI.getTransactionReceipt(request)` — fetch transaction status (sweep, swap, fulfillment).
  - New `TransactionsAPI` sub-client.

  ### `@opensea/cli` — additive (with one type re-export removed)

  - `OrdersResponse`, `SimpleAccount` re-exports removed from `src/types/api.ts` (schemas no longer exist).
  - `offers all` and `listings all` now accept `--maker <address>` to filter by order maker.
  - New commands:
    - `listings sweep` — bulk-buy items from a collection with any payment token.
    - `offers by-nft <collection> <token-id>` — all offers for a specific NFT.
    - `transactions receipt --request <file>` — fetch transaction receipt/status (request body via JSON file).
  - New SDK helpers: `OpenSeaCLI.transactions.receipt`, `SwapsAPI.executeMulti` (POST `/swap/execute`).

  ### `@opensea/skill` — docs refresh

  - `opensea-api/references/rest-api.md` — endpoint tables refreshed: removed deleted GET rows, added `?maker=` annotations, added `listings/sweep`, per-NFT offers, `swap/execute`, and `transactions/receipt` rows.
  - `opensea-marketplace/references/marketplace-api.md` — replaced "Get listings/offers for specific NFT" sections (which curled the removed endpoints) with the slug-based replacements.

### Patch Changes

- Updated dependencies [7a51fd0]
  - @opensea/api-types@0.3.0

## 10.3.1

### Patch Changes

- 961f2c5: fix(api): consume cross-chain fulfillment types from `@opensea/api-types`

  The cross-chain fulfillment types added in the previous release were hand-rolled in `packages/sdk/src/api/types.ts` and `packages/cli/src/types/api.ts` rather than generated from the OpenAPI spec. This release pulls them from `@opensea/api-types` (the source of truth) so future spec changes flow through automatically.

  **`@opensea/api-types`**: Adds named exports for `CrossChainFulfillmentRequest`, `CrossChainFulfillmentResponse`, `CrossChainPaymentToken`, `FulfillerObject`, and `ListingObject` schemas (regenerated from the production OpenAPI spec).

  **`@opensea/sdk`** _(type rename — minimal-impact since the prior release shipped <1 day ago)_:

  - `CrossChainListing` → `ListingObject`
  - `CrossChainFulfillmentDataRequest` → `CrossChainFulfillmentRequest`
  - `CrossChainFulfillmentDataResponse` → `CrossChainFulfillmentResponse`
  - `CrossChainTransaction` → `SwapTransactionResponse`

  The runtime call signature on `BaseOpenSeaSDK.getCrossChainFulfillmentData()` is unchanged.

  **`@opensea/cli`** _(type rename — same minimal impact)_:

  - `CrossChainFulfillmentTransaction` → `SwapTransactionResponse`
  - `CrossChainFulfillmentDataResponse` → `CrossChainFulfillmentResponse`

  Adds a new blocking CI check (`pnpm check-api-paths`) that fails when an `/api/v2/...` URL referenced in SDK or CLI source is not present in `packages/api-types/opensea-api.json`. AGENTS docs updated to make the api-types-first flow explicit for new endpoints.

- Updated dependencies [961f2c5]
  - @opensea/api-types@0.2.3

## 10.3.0

### Minor Changes

- fc44d9f: feat: add cross-chain fulfillment support

  Add support for the new `POST /api/v2/listings/cross_chain_fulfillment_data` endpoint across SDK, CLI, and skill packages.

  **SDK**: New `getCrossChainFulfillmentData()` method on both the API client and the base SDK class. Accepts listings, fulfiller, payment token (chain + address), and optional recipient. Returns ordered transactions to sign and submit.

  **CLI**: New `listings cross-chain-fulfill` subcommand with `--hashes`, `--listing-chain`, `--protocol-address`, `--fulfiller`, `--payment-chain`, `--payment-token`, and optional `--recipient` flags. Supports sweeping multiple listings via comma-separated hashes.

  **Skill**: New `opensea-cross-chain-fulfill.sh` script and updated SKILL.md with cross-chain buying workflow documentation.

## 10.2.1

### Patch Changes

- 4a76bc1: Add server-side trait filtering on three collection-scoped read methods. `getNFTsByCollection`, `getBestListings`, and `getEventsByCollection` now accept an optional `traits` argument (a `TraitFilter[]`); multiple entries are AND-combined server-side. The SDK JSON-encodes the array for the request — callers pass a structured `[{ traitType, value }]`. New exports: `TraitFilter`, `GetEventsByCollectionArgs`, `encodeTraitsParam`. Requires `@opensea/api-types@^0.2.2`.

## 10.2.0

### Minor Changes

- bc9c6ce: Add token-groups and instant API key endpoints.

  **SDK**:

  - `sdk.api.getTokenGroups({ limit?, cursor? })` and `sdk.api.getTokenGroup(slug)` for the new `/api/v2/token-groups` endpoints.
  - `OpenSeaSDK.requestInstantApiKey()` and `OpenSeaAPI.requestInstantApiKey()` — static methods that call `POST /api/v2/auth/keys` without authentication and return a free-tier key you can pass into the SDK constructor. Rate limited to 3 keys/hour per IP; keys expire after 30 days.
  - `OpenSeaAPI` class is now exported from the package root (`@opensea/sdk` and `@opensea/sdk/viem`).

  **CLI**:

  - New `opensea token-groups list` and `opensea token-groups get <slug>` commands.
  - New `opensea auth request-key` command — works without `--api-key` / `OPENSEA_API_KEY` since the endpoint is unauthenticated.

### Patch Changes

- a57c63d: Update @opensea/seaport-js from ^4.0.7 to ^4.1.1
- Updated dependencies [5b6ba13]
  - @opensea/api-types@0.2.1

## 10.1.0

### Minor Changes

- 497b636: Add missing API wrapper methods for full OpenAPI spec coverage:
  - `getNFTCollection()` — get the collection an NFT belongs to
  - `getNFTMetadata()` — get raw NFT metadata (name, description, image, traits)
  - Expose `fulfillPrivateOrder()` as a public method on `OpenSeaSDK`

## 10.0.0

### Major Changes

- bc5b7b6: Add viem support via provider abstraction layer.

  Breaking changes:

  - `OrderSide.LISTING` value changed from `"ask"` to `"listing"`
  - `OrderSide.OFFER` value changed from `"bid"` to `"offer"`
  - `BigNumberish` type replaced with `Amount` (`string | number | bigint`)
  - `Overrides` type replaced with `Record<string, unknown>`
  - `provider` public property removed from `OpenSeaSDK` class
  - `estimateGas` utility function removed
  - TypeChain dependency removed (replaced with inline ABIs)
  - `ethers.FetchRequest` replaced with native `fetch()`

  New features:

  - `@opensea/sdk/viem` subpath export with native viem `PublicClient`/`WalletClient` support
  - Provider abstraction types: `OpenSeaSigner`, `OpenSeaProvider`, `ContractCaller`, `OpenSeaWallet`
  - `ZERO_ADDRESS` and `MAX_UINT256` exported from constants
  - `checksumAddress` utility using `@noble/hashes`
  - `parseUnits` and `parseEther` standalone utilities

## 9.0.0

### Major Changes

- Rename package from `opensea-js` to `@opensea/sdk`

  The old `opensea-js` package has been deprecated with a stub that directs users to install `@opensea/sdk` instead.

## 8.1.0

### Minor Changes

- b3a5e84: Add drops endpoints, trending/top collections, and account resolve

  - api-types: Sync OpenAPI spec with 6 new endpoints and 8 new schemas (drops, trending/top collections, account resolve)
  - SDK: New DropsAPI class, extended CollectionsAPI and AccountsAPI with new methods
  - CLI: New `drops` command, `collections trending/top` subcommands, `accounts resolve` subcommand

### Patch Changes

- f82c035: Replace hardcoded chain ID maps with codegen from OpenSea REST API

  - SDK: Fix Blast chain ID from 238 (testnet) to 81457 (mainnet)
  - CLI: Add chains previously only in SDK (b3, flow, ronin, etc.)
  - CLI: Remove `bsc`, `sepolia`, `base_sepolia`, `monad_testnet` from `CHAIN_IDS` — these are not in the OpenSea API
  - Add `pnpm sync-chains` codegen script (fetches GET /api/v2/chains as source of truth)

- Updated dependencies [b3a5e84]
  - @opensea/api-types@0.2.0
