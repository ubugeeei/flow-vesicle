/* @flow strict */

import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  arrayOps,
  field,
  inputTypeFor,
  useVesicle,
  useVesicleAction,
  useVesicleOptimistic,
  vesicle,
} from "./FlowVesicle";
import { buildFormData, objectFromFormData, readFormPayload } from "./FormData";

test("field.text descriptor parses to string and serializes round-trip", () => {
  const d = field.text({ required: true, maxLength: 5 });
  expect(d.kind).toBe("text");
  expect(d.parse(null)).toBe("");
  expect(d.parse(42)).toBe("42");
  expect(d.serialize("foo")).toBe("foo");
  expect(d.empty()).toBe("");
  expect(d.options.required).toBe(true);
  expect(d.options.maxLength).toBe(5);
});

test("field.number rejects non-finite values", () => {
  const d = field.number();
  expect(d.parse("12.5")).toBe(12.5);
  expect(d.parse("")).toBe(null);
  expect(d.parse("nope")).toBe(null);
  expect(d.parse(null)).toBe(null);
  expect(d.serialize(7)).toBe("7");
  expect(d.serialize(null)).toBe("");
});

test("field.checkbox normalizes truthy strings to boolean", () => {
  const d = field.checkbox();
  expect(d.parse("on")).toBe(true);
  expect(d.parse("true")).toBe(true);
  expect(d.parse(true)).toBe(true);
  expect(d.parse("off")).toBe(false);
  expect(d.parse("false")).toBe(false);
  expect(d.parse(null)).toBe(false);
  expect(d.serialize(true)).toBe("on");
  expect(d.serialize(false)).toBe("");
});

test("field.array round-trips through parse/serialize with item descriptor", () => {
  const d = field.array(field.number());
  expect(d.kind).toBe("array");
  expect(d.empty()).toEqual([]);
  expect(d.parse(["1", "2", "3"])).toEqual([1, 2, 3]);
  expect(d.parse("5")).toEqual([5]);
  expect(d.parse(null)).toEqual([]);
  expect(d.parse("")).toEqual([]);
  expect(d.serialize([1, 2, 3])).toEqual(["1", "2", "3"]);
});

test("arrayOps push / removeAt / move / replaceAt / clear keep value in sync", () => {
  const def = vesicle({
    fields: { tags: field.array(field.text()) },
    initial: { tags: ["a", "b"] },
  });
  const handle = def.bind();
  const ops = arrayOps(handle.fields.tags);

  ops.push("c");
  expect(handle.values.get().tags).toEqual(["a", "b", "c"]);

  ops.insertAt(1, "x");
  expect(handle.values.get().tags).toEqual(["a", "x", "b", "c"]);

  ops.move(0, 2);
  expect(handle.values.get().tags).toEqual(["x", "b", "a", "c"]);

  ops.replaceAt(0, "X");
  expect(handle.values.get().tags).toEqual(["X", "b", "a", "c"]);

  ops.removeAt(2);
  expect(handle.values.get().tags).toEqual(["X", "b", "c"]);

  ops.clear();
  expect(handle.values.get().tags).toEqual([]);
});

test("arrayOps guards against out-of-range indices", () => {
  const def = vesicle({
    fields: { tags: field.array(field.text()) },
    initial: { tags: ["a"] },
  });
  const handle = def.bind();
  const ops = arrayOps(handle.fields.tags);

  ops.removeAt(99);
  ops.replaceAt(-1, "z");
  ops.move(7, 0);
  expect(handle.values.get().tags).toEqual(["a"]);

  ops.insertAt(99, "z");
  expect(handle.values.get().tags).toEqual(["a", "z"]);
});

test("vesicle.action populates an array field from duplicate FormData keys", async () => {
  let captured = null;
  const def = vesicle({
    fields: { tags: field.array(field.text()) },
    action: async (formData) => {
      captured = formData.getAll("tags");
      return null;
    },
  });
  const handle = def.bind();
  const fd = new FormData();
  fd.append("tags", "a");
  fd.append("tags", "b");
  fd.append("tags", "c");
  await handle.action(fd);
  expect(captured).toEqual(["a", "b", "c"]);
  expect(handle.values.get().tags).toEqual(["a", "b", "c"]);
});

test("inputTypeFor maps every field kind to a DOM-valid input type", () => {
  expect(inputTypeFor("text")).toBe("text");
  expect(inputTypeFor("textarea")).toBe("text");
  expect(inputTypeFor("hidden")).toBe("hidden");
  expect(inputTypeFor("number")).toBe("number");
  expect(inputTypeFor("checkbox")).toBe("checkbox");
  expect(inputTypeFor("select")).toBe("text");
  expect(inputTypeFor("email")).toBe("email");
  expect(inputTypeFor("password")).toBe("password");
  expect(inputTypeFor("date")).toBe("date");
  expect(inputTypeFor("url")).toBe("url");
  expect(inputTypeFor("array")).toBe("text");
});

test("vesicle binds initial values and derives dirty/valid/values cells", () => {
  const def = vesicle({
    fields: {
      title: field.text({ required: true }),
      done: field.checkbox(),
    },
    initial: { title: "draft" },
  });
  const handle = def.bind();
  expect(handle.values.get()).toEqual({ title: "draft", done: false });
  expect(handle.dirty.get()).toBe(false);
  expect(handle.valid.get()).toBe(true);
  handle.fields.title.set("renamed");
  expect(handle.dirty.get()).toBe(true);
  expect(handle.values.get()).toEqual({ title: "renamed", done: false });
  handle.reset();
  expect(handle.dirty.get()).toBe(false);
  expect(handle.values.get()).toEqual({ title: "draft", done: false });
});

test("vesicle.validate populates per-field errors and clears the valid flag", async () => {
  const def = vesicle({
    fields: {
      email: field.email({ required: true }),
    },
    validate: ({ values }) => ({
      email: values.email === "" ? "required" : null,
    }),
  });
  const handle = def.bind();
  const errors = await handle.validate();
  expect(errors).toEqual({ email: "required" });
  expect(handle.errors.get().email).toBe("required");
  expect(handle.valid.get()).toBe(false);
  handle.fields.email.set("a@b.test");
  await handle.validate();
  expect(handle.valid.get()).toBe(true);
});

test("vesicle.validate aborts the previous in-flight validator", async () => {
  const aborts = [];
  let resolveSlow;
  const slow = new Promise((resolve) => {
    resolveSlow = resolve;
  });

  const def = vesicle({
    fields: { email: field.email() },
    validate: ({ signal }) => {
      signal.addEventListener("abort", () => {
        aborts.push("aborted");
      });
      return slow;
    },
  });
  const handle = def.bind();

  const first = handle.validate();
  const second = handle.validate();

  resolveSlow({ email: null });
  const [firstResult, secondResult] = await Promise.all([first, second]);

  expect(aborts).toEqual(["aborted"]);
  expect(firstResult).toEqual({});
  expect(secondResult).toEqual({ email: null });
  expect(handle.errors.get()).toEqual({ email: null });
});

test("vesicle.validate keeps only the latest result when a stale promise resolves last", async () => {
  let resolveStale;
  let resolveFresh;
  const calls = [];
  const def = vesicle({
    fields: { email: field.email() },
    validate: () => {
      calls.push(true);
      if (calls.length === 1) {
        return new Promise((resolve) => {
          resolveStale = resolve;
        });
      }
      return new Promise((resolve) => {
        resolveFresh = resolve;
      });
    },
  });
  const handle = def.bind();

  const stale = handle.validate();
  const fresh = handle.validate();

  resolveFresh({ email: "fresh-error" });
  await fresh;
  expect(handle.errors.get().email).toBe("fresh-error");

  resolveStale({ email: "stale-error" });
  await stale;
  expect(handle.errors.get().email).toBe("fresh-error");
});

test("vesicle.validate forwards thrown errors only when the call is still current", async () => {
  let attempt = 0;
  const def = vesicle({
    fields: { email: field.email() },
    validate: async ({ signal }) => {
      attempt += 1;
      if (attempt === 1) {
        await new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve());
        });
        throw new Error("first call exploded after abort");
      }
      return { email: null };
    },
  });
  const handle = def.bind();
  const first = handle.validate();
  const second = handle.validate();
  await second;
  await expect(first).resolves.toEqual({});
});

test("vesicle.action runs validator then action and resolves state", async () => {
  const calls = [];
  const def = vesicle({
    fields: {
      name: field.text({ required: true }),
    },
    validate: ({ values }) => ({
      name: typeof values.name === "string" && values.name.length === 0 ? "required" : null,
    }),
    action: async (formData) => {
      calls.push(formData.get("name"));
      return { ok: true };
    },
  });
  const handle = def.bind();
  handle.fields.name.set("alice");
  const result = await handle.action(buildFormData({ name: "alice" }));
  expect(result).toEqual({ ok: true });
  expect(calls).toEqual(["alice"]);
  const state = handle.state.get();
  expect(state.status).toBe("fulfilled");
});

test("vesicle.action sets rejected state when validator returns errors", async () => {
  const def = vesicle({
    fields: { name: field.text() },
    validate: () => ({ name: "boom" }),
    action: async () => "ignored",
  });
  const handle = def.bind();
  const result = await handle.action(buildFormData({ name: "x" }));
  expect(result).toBe(undefined);
  expect(handle.state.get().status).toBe("rejected");
});

test("vesicle.action swallows optimistic failures but still runs the action", async () => {
  let optimisticCalls = 0;
  const def = vesicle({
    fields: { name: field.text() },
    optimistic: () => {
      optimisticCalls += 1;
      throw new Error("nope");
    },
    action: async () => "served",
  });
  const handle = def.bind();
  const result = await handle.action(buildFormData({ name: "x" }));
  expect(optimisticCalls).toBe(1);
  expect(result).toBe("served");
});

test("buildFormData skips null/undefined and expands arrays", () => {
  const fd = buildFormData({ name: "a", skip: null, omit: undefined, tags: ["x", "y"], on: true, off: false });
  expect(fd.get("name")).toBe("a");
  expect(fd.has("skip")).toBe(false);
  expect(fd.has("omit")).toBe(false);
  expect(fd.getAll("tags")).toEqual(["x", "y"]);
  expect(fd.get("on")).toBe("on");
  expect(fd.has("off")).toBe(false);
});

test("objectFromFormData collapses duplicate keys to arrays", () => {
  const fd = buildFormData({ tag: ["a", "b"] });
  fd.append("tag", "c");
  expect(objectFromFormData(fd)).toEqual({ tag: ["a", "b", "c"] });
});

test("readFormPayload handles FormData, HTMLFormElement and plain objects", () => {
  const fd = buildFormData({ x: "1" });
  expect(readFormPayload(fd)).toEqual({ x: "1" });

  const form = document.createElement("form");
  const input = document.createElement("input");
  input.name = "x";
  input.value = "from-form";
  form.appendChild(input);
  document.body.appendChild(form);
  const event = { currentTarget: form, target: form };
  expect(readFormPayload(event)).toEqual({ x: "from-form" });

  expect(readFormPayload({ y: 2 })).toEqual({ y: 2 });
  expect(readFormPayload(null)).toEqual({});
});

async function renderAndCapture(node) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

test("useVesicleAction wires vesicle.action through React.useActionState", async () => {
  const def = vesicle({
    fields: { name: field.text({ required: true }) },
    action: async (formData) => ({ savedAs: String(formData.get("name") ?? "") }),
  });

  const captured = { result: null, pending: null, formAction: null };

  function Probe() {
    const handle = useVesicle(def);
    const [result, formAction, pending] = useVesicleAction(handle, null);
    captured.result = result;
    captured.pending = pending;
    captured.formAction = formAction;
    return null;
  }

  const { unmount } = await renderAndCapture(React.createElement(Probe));
  try {
    expect(captured.result).toBeNull();
    expect(captured.pending).toBe(false);
    expect(typeof captured.formAction).toBe("function");
    await act(async () => {
      captured.formAction(buildFormData({ name: "ada" }));
    });
    expect(captured.result).toEqual({ savedAs: "ada" });
    expect(captured.pending).toBe(false);
  } finally {
    unmount();
  }
});

test("useVesicleOptimistic merges patches by default and resets to committed values", async () => {
  const def = vesicle({
    fields: {
      title: field.text(),
      count: field.number(),
    },
    initial: { title: "draft", count: 0 },
  });

  const captured = { values: null, apply: null };

  function Probe() {
    const handle = useVesicle(def);
    const [values, apply] = useVesicleOptimistic(handle);
    captured.values = values;
    captured.apply = apply;
    return null;
  }

  const { unmount } = await renderAndCapture(React.createElement(Probe));
  try {
    expect(captured.values).toEqual({ title: "draft", count: 0 });
    await act(async () => {
      React.startTransition(() => {
        captured.apply({ title: "draft (saving)" });
      });
    });
    expect(captured.values).toEqual({ title: "draft", count: 0 });
  } finally {
    unmount();
  }
});

test("useVesicleOptimistic accepts a custom reducer", async () => {
  const def = vesicle({
    fields: { count: field.number() },
    initial: { count: 1 },
  });

  const captured = { values: null, apply: null };

  function Probe() {
    const handle = useVesicle(def);
    const [values, apply] = useVesicleOptimistic(
      handle,
      (current, delta) => ({
        ...current,
        count: (typeof current.count === "number" ? current.count : 0) + delta,
      }),
    );
    captured.values = values;
    captured.apply = apply;
    return null;
  }

  const { unmount } = await renderAndCapture(React.createElement(Probe));
  try {
    expect(captured.values).toEqual({ count: 1 });
    await act(async () => {
      React.startTransition(() => {
        captured.apply(5);
      });
    });
    expect(captured.values).toEqual({ count: 1 });
  } finally {
    unmount();
  }
});

test("useVesicleAction keeps previous state when the action throws", async () => {
  const def = vesicle({
    fields: { name: field.text({ required: true }) },
    action: async () => {
      throw new Error("server exploded");
    },
  });

  const captured = { result: null, formAction: null };

  function Probe() {
    const handle = useVesicle(def);
    const [result, formAction] = useVesicleAction(handle, { savedAs: "initial" });
    captured.result = result;
    captured.formAction = formAction;
    return null;
  }

  const { unmount } = await renderAndCapture(React.createElement(Probe));
  try {
    expect(captured.result).toEqual({ savedAs: "initial" });
    await act(async () => {
      captured.formAction(buildFormData({ name: "ada" }));
    });
    expect(captured.result).toEqual({ savedAs: "initial" });
  } finally {
    unmount();
  }
});
