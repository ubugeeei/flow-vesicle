# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **React 19 `useActionState` bridge** — `useVesicleAction(handle, initial, permalink?)` returns the standard `[state, formAction, isPending]` tuple, picks up the bound handle's `permalink` automatically, and swallows action errors so the state cell keeps serving the last good payload.
- **React 19 `useOptimistic` bridge** — `useVesicleOptimistic(handle, reducer?)` returns `[optimisticValues, applyPatch]` with a default shallow-merge reducer for the common case.
- **Race-free async validators** — `validate()` now passes an `AbortSignal` through `ValidatorContext.signal`, aborts the previous in-flight controller, and discards stale results so only the latest call mutates per-field error cells.
- **Repeatable fields** — `field.array(item, options?)` + `arrayOps(handle)` for `push` / `insertAt` / `removeAt` / `move` / `replaceAt` / `clear`. `FieldKind` gains `"array"`.
- **GraphQL mutation bridge** — `vesicleFromMutation({ mutation, fields, endpoint | fetch, … })`, `GraphQLBridgeError`, `applyGraphQLErrors(fields, error)`. Parses field values through their descriptors before sending so numeric / boolean variables stay typed.
- **Navigation guard** — `useUnsavedChangesGuard(handle, options?)` hooks `beforeunload`, `popstate`, and capture-phase link clicks to block navigation while the form is dirty.
- **RSC components** — `<VesicleForm>` and `<VesicleField>` from the `react-server`-conditional export, plus matching `.js.flow` declarations.
- **Tests + Smoke** — `src/FlowVesicle.test.js` covering descriptors, vesicle lifecycle, all React 19 bridges, navigation guard, GraphQL bridge, RSC render output (35 tests). `Smoke.js` exercises the built `dist/` and is wired into `yarn verify`.
- **CI** — `.github/workflows/ci.yml` runs `yarn verify` on every push and pull request.

### Changed

- **Flow baseline** — `Values<F>` renamed to `FieldValues<F>` (Flow reserves `Values`). `$Shape<…>` replaced with `Partial<…>`. `$ElementType` replaced with bracket access. `({}: T)` casts converted to the `as` form. `flow-typed/browser.js` expanded to cover `AbortController`, `AbortSignal`, `fetch`, `Response`, `window`, `document`, `history`, `HTMLFormElement`. After this rebase, `yarn flow` is green.

### Build

- `yarn install` is reproducible (`yarn.lock` committed). `yarn verify` (flow + test + build + smoke) is the single gate.
