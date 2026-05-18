/* @flow strict */

import {
  cell,
  transaction,
} from "flow-cell/server";
import type {
  Cell,
  Readable,
  Unsubscribe,
} from "flow-cell/server";
import { inputTypeFor } from "./Field";
import { buildFormData, readFormPayload } from "./FormData";
import type {
  ActionFn,
  Errors,
  FieldDescriptor,
  FieldDescriptors,
  FieldHandle,
  FieldHandles,
  FieldInput,
  FieldOptions,
  FieldValues,
  FormState,
  OptimisticFn,
  ValidatorFn,
  Vesicle,
  VesicleBoundHandle,
  VesicleConfig,
  VesicleHandle,
} from "./Types";

let nextVesicleId = 0;
let nextFieldId = 0;

function vesicleKey(): string {
  nextVesicleId += 1;
  return `vesicle.${String(nextVesicleId)}`;
}

function fieldKey(name: string): string {
  nextFieldId += 1;
  return `field.${name}.${String(nextFieldId)}`;
}

function deriveCell<R>(
  sources: $ReadOnlyArray<Readable<mixed>>,
  compute: () => R,
  initial: R,
  key: string,
): Cell<R> {
  const target: Cell<R> = cell(initial, { key });
  const update = (): void => {
    const next = compute();
    target.set(next);
  };
  for (const source of sources) {
    source.subscribe(update);
  }
  update();
  return target;
}

class FieldHandleImpl<T> implements FieldHandle<T> {
  name: string;
  kind: FieldDescriptor<T>["kind"];
  options: FieldOptions;
  _descriptor: FieldDescriptor<T>;
  _initial: T;
  value: Cell<T>;
  error: Cell<?string>;
  touched: Cell<boolean>;

  constructor(name: string, descriptor: FieldDescriptor<T>, initial: T): void {
    this.name = name;
    this.kind = descriptor.kind;
    this.options = descriptor.options;
    this._descriptor = descriptor;
    this._initial = initial;
    const key = fieldKey(name);
    this.value = cell<T>(initial, { key: `${key}.value`, name: `${name}.value` });
    this.error = cell<?string>(null, { key: `${key}.error`, name: `${name}.error` });
    this.touched = cell<boolean>(false, { key: `${key}.touched`, name: `${name}.touched` });
  }

  set(value: T): void {
    transaction(() => {
      this.value.set(value);
    });
  }

  setRaw(raw: mixed): void {
    const parsed = this._descriptor.parse(raw);
    this.set(parsed);
  }

  reset(): void {
    transaction(() => {
      this.value.set(this._initial);
      this.error.set(null);
      this.touched.set(false);
    });
  }

  touch(): void {
    if (this.touched.get() === true) {
      return;
    }
    this.touched.set(true);
  }

  input(overrides?: FieldOptions): FieldInput {
    const merged: FieldOptions = { ...this.options, ...(overrides ?? {}) };
    const initial = this._initial;
    const type = inputTypeFor(this.kind);
    const base: { [string]: mixed } = {
      name: this.name,
      type,
    };
    if (merged.required === true) {
      base.required = true;
    }
    if (typeof merged.minLength === "number") {
      base.minLength = merged.minLength;
    }
    if (typeof merged.maxLength === "number") {
      base.maxLength = merged.maxLength;
    }
    if (typeof merged.min === "number") {
      base.min = merged.min;
    }
    if (typeof merged.max === "number") {
      base.max = merged.max;
    }
    if (typeof merged.pattern === "string") {
      base.pattern = merged.pattern;
    }
    if (typeof merged.placeholder === "string") {
      base.placeholder = merged.placeholder;
    }
    if (typeof merged.autocomplete === "string") {
      base.autoComplete = merged.autocomplete;
    }
    if (this.kind === "checkbox") {
      base.defaultChecked = Boolean(initial);
    } else if (this.kind === "array") {
      // Arrays don't map to a single <input>; consumers render per-item
      // controls and use FieldArrayHandle.itemInput(index, value).
    } else if (this.kind === "hidden") {
      const serialized = this._descriptor.serialize(initial);
      if (serialized != null) {
        base.defaultValue = serialized;
      }
    } else if (initial != null) {
      const serialized = this._descriptor.serialize(initial);
      if (serialized != null) {
        base.defaultValue = serialized;
      }
    }
    return base as $FlowFixMe as FieldInput;
  }
}

class VesicleInstance<F: FieldDescriptors, TResult> implements VesicleHandle<F, TResult> {
  id: string;
  _config: VesicleConfig<F, TResult>;
  fields: FieldHandles<F>;
  _fieldList: Array<FieldHandleImpl<mixed>>;
  values: Cell<FieldValues<F>>;
  errors: Cell<Errors<F>>;
  touched: Cell<{ [name: string]: boolean }>;
  dirty: Cell<boolean>;
  valid: Cell<boolean>;
  pending: Cell<boolean>;
  state: Cell<FormState<TResult>>;
  _permalink: ?string;
  _validateToken: number = 0;
  _validateController: ?AbortController = null;

  constructor(
    config: VesicleConfig<F, TResult>,
    overrides?: { +initial?: Partial<FieldValues<F>>, +permalink?: string },
  ): void {
    this.id = vesicleKey();
    this._config = config;
    const initialValues: { [string]: mixed } = {};
    const baseInitial = overrides?.initial ?? config.initial ?? null;
    const fields: { [string]: FieldHandleImpl<mixed> } = {};
    const fieldList: Array<FieldHandleImpl<mixed>> = [];
    for (const name of Object.keys(config.fields)) {
      const descriptor = config.fields[name];
      const explicit = baseInitial != null && Object.hasOwn(baseInitial, name)
        ? (baseInitial as $FlowFixMe)[name]
        : descriptor.empty();
      initialValues[name] = explicit;
      const handle: FieldHandleImpl<mixed> = new FieldHandleImpl(name, descriptor, explicit);
      fields[name] = handle;
      fieldList.push(handle);
    }
    this.fields = fields as $FlowFixMe as FieldHandles<F>;
    this._fieldList = fieldList;
    this._permalink = overrides?.permalink ?? config.permalink ?? null;

    const valueSources: Array<Readable<mixed>> = fieldList.map(f => f.value);
    const errorSources: Array<Readable<mixed>> = fieldList.map(f => f.error);
    const touchedSources: Array<Readable<mixed>> = fieldList.map(f => f.touched);

    this.values = deriveCell<FieldValues<F>>(
      valueSources,
      () => {
        const out: { [string]: mixed } = {};
        for (const handle of fieldList) {
          out[handle.name] = handle.value.get();
        }
        return out as $FlowFixMe as FieldValues<F>;
      },
      initialValues as $FlowFixMe as FieldValues<F>,
      `${this.id}.values`,
    );
    this.errors = deriveCell<Errors<F>>(
      errorSources,
      () => {
        const out: { [string]: ?string } = {};
        for (const handle of fieldList) {
          out[handle.name] = handle.error.get();
        }
        return out as $FlowFixMe as Errors<F>;
      },
      ({} as $FlowFixMe),
      `${this.id}.errors`,
    );
    this.touched = deriveCell<{ [name: string]: boolean }>(
      touchedSources,
      () => {
        const out: { [string]: boolean } = {};
        for (const handle of fieldList) {
          out[handle.name] = handle.touched.get();
        }
        return out;
      },
      ({} as $FlowFixMe),
      `${this.id}.touched`,
    );
    this.dirty = deriveCell<boolean>(
      valueSources,
      () => {
        for (const handle of fieldList) {
          const current = handle.value.get();
          if (!Object.is(current, handle._initial)) {
            return true;
          }
        }
        return false;
      },
      false,
      `${this.id}.dirty`,
    );
    this.valid = deriveCell<boolean>(
      errorSources,
      () => {
        for (const handle of fieldList) {
          if (handle.error.get() != null) {
            return false;
          }
        }
        return true;
      },
      true,
      `${this.id}.valid`,
    );
    this.pending = cell<boolean>(false, { key: `${this.id}.pending` });
    this.state = cell<FormState<TResult>>(
      { status: "idle" },
      { key: `${this.id}.state` },
    );
  }

  async validate(): Promise<Errors<F>> {
    const validator: ?ValidatorFn<F> = this._config.validate;
    if (validator == null) {
      return ({} as $FlowFixMe as Errors<F>);
    }
    if (this._validateController != null) {
      this._validateController.abort();
    }
    const controller = new AbortController();
    this._validateController = controller;
    this._validateToken += 1;
    const token = this._validateToken;
    let result: Errors<F>;
    try {
      result = await validator({
        values: this.values.get(),
        touched: this.touched.get() as $FlowFixMe,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || token !== this._validateToken) {
        return ({} as $FlowFixMe as Errors<F>);
      }
      throw error;
    }
    if (token !== this._validateToken || controller.signal.aborted) {
      return ({} as $FlowFixMe as Errors<F>);
    }
    transaction(() => {
      for (const handle of this._fieldList) {
        const next = (result as $FlowFixMe)[handle.name] ?? null;
        handle.error.set(next);
      }
    });
    return result;
  }

  reset(): void {
    transaction(() => {
      for (const handle of this._fieldList) {
        handle.reset();
      }
      this.state.set({ status: "idle" });
    });
  }

  async submit(): Promise<TResult | void> {
    return this.action(buildFormData(this.values.get()));
  }

  whenDirty(): () => boolean {
    return () => this.dirty.get();
  }

  bind(overrides?: { +initial?: Partial<FieldValues<F>>, +permalink?: string }): VesicleBoundHandle<F, TResult> {
    return new VesicleInstance<F, TResult>(this._config, overrides);
  }

  get permalink(): ?string {
    return this._permalink;
  }

  action: (input: mixed) => Promise<TResult | void> = async (input: mixed) => {
    const payload = readFormPayload(input);
    transaction(() => {
      for (const handle of this._fieldList) {
        if (Object.hasOwn(payload, handle.name)) {
          handle.setRaw(payload[handle.name]);
        }
      }
    });
    const errors = await this.validate();
    let hasError = false;
    for (const key of Object.keys(errors)) {
      if ((errors as $FlowFixMe)[key] != null) {
        hasError = true;
        break;
      }
    }
    if (hasError) {
      transaction(() => {
        this.state.set({ status: "rejected", error: errors });
      });
      return undefined;
    }
    const optimistic: ?OptimisticFn<F> = this._config.optimistic;
    if (optimistic != null) {
      try {
        optimistic({ values: this.values.get() });
      } catch (_optError) {
        // swallow optimistic errors; the form keeps validating
      }
    }
    const action: ?ActionFn<TResult> = this._config.action;
    if (action == null) {
      transaction(() => {
        this.state.set({ status: "fulfilled", value: undefined as $FlowFixMe });
      });
      return undefined;
    }
    transaction(() => {
      this.pending.set(true);
      this.state.set({ status: "pending" });
    });
    try {
      const formData = input != null && typeof FormData !== "undefined" && input instanceof FormData
        ? input
        : buildFormData(this.values.get() as $FlowFixMe);
      const value = await action(formData);
      transaction(() => {
        this.state.set({ status: "fulfilled", value });
      });
      return value;
    } catch (error) {
      transaction(() => {
        this.state.set({ status: "rejected", error });
      });
      throw error;
    } finally {
      transaction(() => {
        this.pending.set(false);
      });
    }
  };
}

class VesicleDefinition<F: FieldDescriptors, TResult> {
  config: VesicleConfig<F, TResult>;
  _current: ?VesicleInstance<F, TResult> = null;
  _listeners: Set<() => void> = new Set();

  constructor(config: VesicleConfig<F, TResult>): void {
    this.config = config;
  }

  _notify(): void {
    for (const listener of Array.from(this._listeners)) {
      listener();
    }
  }

  create(
    overrides?: { +initial?: Partial<FieldValues<F>>, +permalink?: string },
  ): VesicleInstance<F, TResult> {
    const instance = new VesicleInstance<F, TResult>(this.config, overrides);
    this._current = instance;
    this._notify();
    return instance;
  }

  bind(
    overrides?: { +initial?: Partial<FieldValues<F>>, +permalink?: string },
  ): VesicleInstance<F, TResult> {
    return this.create(overrides);
  }

  current(): ?VesicleInstance<F, TResult> {
    return this._current;
  }

  subscribe(listener: () => void): Unsubscribe {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }
}

export function vesicle<F: FieldDescriptors, TResult = mixed>(
  config: VesicleConfig<F, TResult>,
): Vesicle<F, TResult> {
  const def = new VesicleDefinition<F, TResult>(config);
  const handle: Vesicle<F, TResult> = {
    config: def.config,
    create: overrides => def.create(overrides),
    bind: overrides => def.bind(overrides),
    current: () => def.current(),
    subscribe: listener => def.subscribe(listener),
  };
  return handle;
}
