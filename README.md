# flow-vesicle

[![ci](https://github.com/ubugeeei/flow-vesicle/actions/workflows/ci.yml/badge.svg)](https://github.com/ubugeeei/flow-vesicle/actions/workflows/ci.yml)

A Flow-typed form / action payload library for React 19, built on top of [`flow-cell`](https://github.com/ubugeeei/flow-cell).

`flow-vesicle` packages everything a modern React 19 form needs into a single, typed unit (a "vesicle"):

- field descriptors with `parse` / `serialize` / `empty`,
- a reactive handle backed by `flow-cell` (`values`, `errors`, `touched`, `dirty`, `valid`, `pending`, `state`),
- a `FormData`-shaped action lifecycle,
- React 19 hooks: `useActionState`, `useOptimistic`, `useFormStatus`,
- race-free async validators with `AbortSignal`,
- repeatable fields with array ops,
- a GraphQL mutation bridge,
- a navigation guard for unsaved changes,
- and a React Server Components renderer.

Everything goes through Flow's strict mode, ships a `.js.flow` declaration alongside the build, and exposes a separate `react-server` export so it works inside RSC.

---

## Install

```sh
yarn add flow-vesicle flow-cell
# peer: react ^19, react-dom ^19
```

## Quick start

```jsx
import { field, vesicle } from "flow-vesicle";
import {
  SubmitButton,
  useVesicle,
  useVesicleAction,
  useVesicleValues,
} from "flow-vesicle/client";

const postVesicle = vesicle({
  fields: {
    title: field.text({ required: true, maxLength: 80 }),
    body:  field.textarea(),
    tags:  field.array(field.text()),
  },
  action: async (formData) => {
    const res = await fetch("/api/posts", { method: "POST", body: formData });
    if (!res.ok) throw new Error("save failed");
    return res.json();
  },
  validate: ({ values, signal }) => {
    if (typeof values.title === "string" && values.title.length === 0) {
      return { title: "title is required" };
    }
    return {};
  },
});

export function PostForm() {
  const handle = useVesicle(postVesicle);
  const [result, formAction, isPending] = useVesicleAction(handle, null);
  const values = useVesicleValues(handle);

  return (
    <form action={formAction}>
      <input {...handle.fields.title.input()} />
      <textarea {...handle.fields.body.input()} />
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      {result?.id != null ? <a href={`/p/${result.id}`}>view</a> : null}
    </form>
  );
}
```

## API surface

### Core (`flow-vesicle`)

- `vesicle(config)` — declare a form schema + action lifecycle
- `field.text | textarea | number | checkbox | select | email | password | date | url | hidden | array(item)` — typed field descriptors
- `arrayOps(handle)` — `push` / `insertAt` / `removeAt` / `move` / `replaceAt` / `clear`
- `buildFormData(values)` / `objectFromFormData(formData)` / `readFormPayload(input)` — `FormData` round-tripping
- `vesicleFromMutation({ mutation, fields, endpoint | fetch, … })` / `GraphQLBridgeError` / `applyGraphQLErrors`

### Client (`flow-vesicle/client`)

- `useVesicle(definition, options?)` — bind a vesicle to a component
- `useVesicleValues / useVesicleDirty / useVesicleValid / useVesiclePending`
- `useVesicleAction(handle, initial, permalink?)` — bridge to `React.useActionState`
- `useVesicleOptimistic(handle, reducer?)` — bridge to `React.useOptimistic`
- `useUnsavedChangesGuard(handle, options?)` — beforeunload / popstate / link click guard
- `useFormStatus()` / `SubmitButton`

### Server (`flow-vesicle/server`, `react-server` aware)

- Everything from core, plus
- `<VesicleForm vesicle action initial permalink children>`
- `<VesicleField vesicle name as overrides>`

## Vesicle lifecycle

```
                ┌────────────┐
                │  config    │  validate / optimistic / action
                └─────┬──────┘
                      │ vesicle()
                ┌─────▼──────┐
                │ Definition │  bind() / create()
                └─────┬──────┘
                      │
                ┌─────▼─────────────┐    .values / .errors / .touched
                │ VesicleHandle     │    .dirty  / .valid  / .pending
                │                   │    .state  (idle | pending | … )
                └─────┬─────────────┘
                      │ action(formData)
                      ▼
       validate ───► optimistic ───► action ──► state.set(fulfilled)
            │                          │
            └─ rejected ◄──────────────┘
```

`validate()` is race-free: each call bumps an internal token and aborts the previous controller. The latest call is the only one allowed to mutate the per-field `error` cells.

## React 19 integration

All React 19 hooks live in `flow-vesicle/client` and throw with an actionable message if the peer React is older than 19.

| `flow-vesicle` hook        | React 19 primitive            |
| -------------------------- | ----------------------------- |
| `useVesicleAction`         | `React.useActionState`        |
| `useVesicleOptimistic`     | `React.useOptimistic`         |
| `useFormStatus`            | `react-dom.useFormStatus`     |
| `SubmitButton`             | `react-dom.useFormStatus`     |
| `useUnsavedChangesGuard`   | `useEffect` + DOM events      |

## Async validation

```js
const v = vesicle({
  fields: { username: field.text() },
  validate: async ({ values, signal }) => {
    const res = await fetch(`/api/check-username?u=${values.username}`, { signal });
    const data = await res.json();
    return { username: data.taken ? "already taken" : null };
  },
});
```

Stale calls (token mismatch *or* signal aborted) resolve with an empty error map and cannot overwrite the latest result. A validator that throws *after* abort is also swallowed; errors from the current call still propagate so real bugs surface.

## GraphQL bridge

```js
import { vesicleFromMutation, field } from "flow-vesicle";

const createPost = vesicleFromMutation({
  mutation: `mutation CreatePost($title: String!, $body: String) {
    createPost(title: $title, body: $body) { id }
  }`,
  fields: {
    title: field.text({ required: true }),
    body:  field.textarea(),
  },
  endpoint: "/graphql",
  headers:  async () => ({ Authorization: `Bearer ${await getToken()}` }),
  select:   (data) => data.createPost,
});
```

Per-field errors come back via `applyGraphQLErrors(fields, error)` which inspects the `path` on each entry of `GraphQLBridgeError.errors`.

## React Server Components

```jsx
// server component
import { VesicleForm } from "flow-vesicle/server";

async function createPost(formData) { "use server"; /* … */ }

export default function NewPost() {
  return (
    <VesicleForm vesicle={postVesicle} action={createPost}>
      {(handle) => (
        <>
          <input {...handle.fields.title.input()} />
          <SubmitButton>Save</SubmitButton>
        </>
      )}
    </VesicleForm>
  );
}
```

## Scripts

| script       | what it does                                     |
| ------------ | ------------------------------------------------ |
| `yarn flow`  | strict Flow type-check                           |
| `yarn test`  | node:test suite (35 tests at time of writing)    |
| `yarn build` | Babel → ESM + CJS into `dist/`                   |
| `yarn smoke` | requires the built `dist/` and exercises exports |
| `yarn verify`| flow + test + build + smoke                      |

CI runs the same `verify` pipeline on every push and pull request to `main`.

## License

MIT — see [LICENSE](./LICENSE).
