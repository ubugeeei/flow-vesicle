/* @flow strict */

import type * as React from "react";
import type {
  Cell,
  Readable,
  Unsubscribe,
} from "flow-cell/server";

export type FieldKind =
  | "text"
  | "textarea"
  | "hidden"
  | "number"
  | "checkbox"
  | "select"
  | "email"
  | "password"
  | "date"
  | "url";

export type FieldOptions = {
  +required?: boolean,
  +minLength?: number,
  +maxLength?: number,
  +min?: number,
  +max?: number,
  +pattern?: string,
  +placeholder?: string,
  +autocomplete?: string,
  +label?: string,
  +options?: $ReadOnlyArray<{ +label: string, +value: string }>,
};

export type FieldDescriptor<T> = {
  +kind: FieldKind,
  +options: FieldOptions,
  +parse: (raw: mixed) => T,
  +serialize: (value: T) => mixed,
  +empty: () => T,
};

export type FieldDescriptors = {
  +[string]: FieldDescriptor<mixed>,
};

export type FieldValues<F: FieldDescriptors> = {
  [name: $Keys<F>]: mixed,
};

export type Errors<F: FieldDescriptors> = {
  [name: $Keys<F>]: ?string,
};

export type FormStatus =
  | "idle"
  | "pending"
  | "fulfilled"
  | "rejected";

export type FormState<+T = mixed> =
  | { +status: "idle" }
  | { +status: "pending" }
  | { +status: "fulfilled", +value: T }
  | { +status: "rejected", +error: mixed };

export type ActionFn<+TResult = mixed> = (
  formData: FormData,
) => Promise<TResult> | TResult;

export type ValidatorContext<F: FieldDescriptors> = {
  +values: FieldValues<F>,
  +touched: { +[name: $Keys<F>]: boolean },
  +signal: AbortSignal,
};

export type ValidatorFn<F: FieldDescriptors> = (
  context: ValidatorContext<F>,
) => Errors<F> | Promise<Errors<F>>;

export type OptimisticFn<F: FieldDescriptors> = (
  context: {
    +values: FieldValues<F>,
  },
) => mixed;

export type NavigationGuardConfig<F: FieldDescriptors> = {
  +blockWhen?: (vesicle: VesicleHandle<F>) => boolean,
  +message?: string,
};

export type VesicleConfig<F: FieldDescriptors, TResult = mixed> = {
  +fields: F,
  +action?: ActionFn<TResult>,
  +validate?: ValidatorFn<F>,
  +optimistic?: OptimisticFn<F>,
  +navigation?: NavigationGuardConfig<F>,
  +permalink?: string,
  +initial?: Partial<FieldValues<F>>,
};

export type FieldInput = {
  +name: string,
  +type: string,
  +required?: boolean,
  +minLength?: number,
  +maxLength?: number,
  +min?: number,
  +max?: number,
  +pattern?: string,
  +placeholder?: string,
  +autoComplete?: string,
  +defaultValue?: mixed,
  +defaultChecked?: boolean,
  ...
};

export interface FieldHandle<T> {
  +name: string;
  +kind: FieldKind;
  +options: FieldOptions;
  +value: Cell<T>;
  +error: Cell<?string>;
  +touched: Cell<boolean>;
  set(value: T): void;
  setRaw(raw: mixed): void;
  reset(): void;
  touch(): void;
  input(overrides?: FieldOptions): FieldInput;
}

export type FieldHandles<F: FieldDescriptors> = {
  +[name: $Keys<F>]: FieldHandle<mixed>,
};

export interface VesicleHandle<F: FieldDescriptors, TResult = mixed> {
  +id: string;
  +fields: FieldHandles<F>;
  +values: Readable<FieldValues<F>>;
  +errors: Readable<Errors<F>>;
  +touched: Readable<{ +[name: $Keys<F>]: boolean }>;
  +dirty: Readable<boolean>;
  +valid: Readable<boolean>;
  +pending: Readable<boolean>;
  +state: Readable<FormState<TResult>>;
  +action: (formDataOrEvent: mixed) => Promise<TResult | void>;
  validate(): Promise<Errors<F>>;
  reset(): void;
  submit(): Promise<TResult | void>;
  whenDirty(): () => boolean;
  bind(options?: { +initial?: Partial<FieldValues<F>>, +permalink?: string }): VesicleBoundHandle<F, TResult>;
}

export interface VesicleBoundHandle<F: FieldDescriptors, TResult = mixed>
  extends VesicleHandle<F, TResult> {
  +permalink: ?string;
}

export type Vesicle<F: FieldDescriptors, TResult = mixed> = {
  +config: VesicleConfig<F, TResult>,
  +create: (overrides?: { +initial?: Partial<FieldValues<F>>, +permalink?: string }) =>
    VesicleBoundHandle<F, TResult>,
  +bind: (overrides?: { +initial?: Partial<FieldValues<F>>, +permalink?: string }) =>
    VesicleBoundHandle<F, TResult>,
  +current: () => ?VesicleHandle<F, TResult>,
  +subscribe: (listener: () => void) => Unsubscribe,
  ...
};

export type Field = {
  +text: (options?: FieldOptions) => FieldDescriptor<string>,
  +textarea: (options?: FieldOptions) => FieldDescriptor<string>,
  +hidden: <T>(options?: FieldOptions) => FieldDescriptor<T>,
  +number: (options?: FieldOptions) => FieldDescriptor<number | null>,
  +checkbox: (options?: FieldOptions) => FieldDescriptor<boolean>,
  +select: (options?: FieldOptions) => FieldDescriptor<string>,
  +email: (options?: FieldOptions) => FieldDescriptor<string>,
  +password: (options?: FieldOptions) => FieldDescriptor<string>,
  +date: (options?: FieldOptions) => FieldDescriptor<string>,
  +url: (options?: FieldOptions) => FieldDescriptor<string>,
};

export type SubmitButtonProps = {
  +children?: React.Node,
  +pendingLabel?: React.Node,
  +disabled?: boolean,
  +className?: string,
  +style?: { +[string]: mixed },
  ...
};

export type UseVesicleOptions<F: FieldDescriptors> = {
  +initial?: Partial<FieldValues<F>>,
  +permalink?: string,
};

export type UseVesicleAction<TResult> = [
  TResult | null,
  (formData: FormData) => void,
  boolean,
];

export type OptimisticReducer<F: FieldDescriptors, TPatch> = (
  current: FieldValues<F>,
  optimistic: TPatch,
) => FieldValues<F>;
