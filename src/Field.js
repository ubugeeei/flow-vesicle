/* @flow strict */

import type {
  Field,
  FieldDescriptor,
  FieldKind,
  FieldOptions,
} from "./Types";

function textParse(raw: mixed): string {
  if (raw == null) {
    return "";
  }
  return String(raw);
}

function textSerialize(value: string): mixed {
  return value;
}

function numberParse(raw: mixed): number | null {
  if (raw == null || raw === "") {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

function numberSerialize(value: number | null): mixed {
  return value == null ? "" : String(value);
}

function checkboxParse(raw: mixed): boolean {
  if (raw == null || raw === false || raw === "" || raw === "false" || raw === "off") {
    return false;
  }
  return true;
}

function checkboxSerialize(value: boolean): mixed {
  return value === true ? "on" : "";
}

function hiddenParse<T>(raw: mixed): T {
  return raw as $FlowFixMe as T;
}

function hiddenSerialize<T>(value: T): mixed {
  return value as $FlowFixMe;
}

function descriptor<T>(
  kind: FieldKind,
  options: FieldOptions,
  parse: (raw: mixed) => T,
  serialize: (value: T) => mixed,
  empty: () => T,
): FieldDescriptor<T> {
  return Object.freeze({
    kind,
    options: Object.freeze({ ...options }),
    parse,
    serialize,
    empty,
  });
}

const emptyString = (): string => "";
const emptyNumber = (): number | null => null;
const emptyBoolean = (): boolean => false;
function emptyHidden<T>(): T {
  return null as $FlowFixMe as T;
}

export const field: Field = Object.freeze({
  text: (options?: FieldOptions) => descriptor<string>(
    "text",
    options ?? {},
    textParse,
    textSerialize,
    emptyString,
  ),
  textarea: (options?: FieldOptions) => descriptor<string>(
    "textarea",
    options ?? {},
    textParse,
    textSerialize,
    emptyString,
  ),
  hidden: <T>(options?: FieldOptions): FieldDescriptor<T> => descriptor<T>(
    "hidden",
    options ?? {},
    hiddenParse,
    hiddenSerialize,
    emptyHidden,
  ),
  number: (options?: FieldOptions) => descriptor<number | null>(
    "number",
    options ?? {},
    numberParse,
    numberSerialize,
    emptyNumber,
  ),
  checkbox: (options?: FieldOptions) => descriptor<boolean>(
    "checkbox",
    options ?? {},
    checkboxParse,
    checkboxSerialize,
    emptyBoolean,
  ),
  select: (options?: FieldOptions) => descriptor<string>(
    "select",
    options ?? {},
    textParse,
    textSerialize,
    emptyString,
  ),
  email: (options?: FieldOptions) => descriptor<string>(
    "email",
    options ?? {},
    textParse,
    textSerialize,
    emptyString,
  ),
  password: (options?: FieldOptions) => descriptor<string>(
    "password",
    options ?? {},
    textParse,
    textSerialize,
    emptyString,
  ),
  date: (options?: FieldOptions) => descriptor<string>(
    "date",
    options ?? {},
    textParse,
    textSerialize,
    emptyString,
  ),
  url: (options?: FieldOptions) => descriptor<string>(
    "url",
    options ?? {},
    textParse,
    textSerialize,
    emptyString,
  ),
});

export function inputTypeFor(kind: FieldKind): string {
  switch (kind) {
    case "text": return "text";
    case "textarea": return "text";
    case "hidden": return "hidden";
    case "number": return "number";
    case "checkbox": return "checkbox";
    case "select": return "text";
    case "email": return "email";
    case "password": return "password";
    case "date": return "date";
    case "url": return "url";
    default: return "text";
  }
}
