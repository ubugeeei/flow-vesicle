/* @flow */

declare class URLSearchParams {
  constructor(init?: string | URLSearchParams | $ReadOnlyArray<[string, string]>): void;
  append(name: string, value: string): void;
  delete(name: string): void;
  entries(): Iterator<[string, string]>;
  get(name: string): string | null;
  getAll(name: string): Array<string>;
  has(name: string): boolean;
  set(name: string, value: string): void;
  toString(): string;
}

declare class URL {
  constructor(input: string | URL, base?: string | URL): void;
  href: string;
  origin: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
  hash: string;
  toString(): string;
  toJSON(): string;
}

declare class AbortSignal {
  aborted: boolean;
  reason: mixed;
  addEventListener(type: "abort", listener: () => void): void;
  removeEventListener(type: "abort", listener: () => void): void;
  throwIfAborted(): void;
}

declare class AbortController {
  signal: AbortSignal;
  abort(reason?: mixed): void;
}

declare class HTMLElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

declare class HTMLAnchorElement extends HTMLElement {
  href: string;
}

declare class HTMLFormElement extends HTMLElement {
  action: string;
  method: string;
  elements: { length: number, ... };
  submit(): void;
  reset(): void;
}

declare class FormData {
  constructor(form?: HTMLFormElement): void;
  append(name: string, value: mixed, filename?: string): void;
  delete(name: string): void;
  entries(): Iterator<[string, mixed]>;
  get(name: string): mixed;
  getAll(name: string): Array<mixed>;
  has(name: string): boolean;
  set(name: string, value: mixed, filename?: string): void;
}

declare type SyntheticEvent<T> = {
  +currentTarget: T,
  +target: T,
  +defaultPrevented: boolean,
  preventDefault(): void,
  stopPropagation(): void,
  ...
};

declare type SyntheticMouseEvent<T> = {
  +currentTarget: T,
  +target: T,
  +defaultPrevented: boolean,
  +button: number,
  +metaKey: boolean,
  +ctrlKey: boolean,
  +shiftKey: boolean,
  +altKey: boolean,
  preventDefault(): void,
  stopPropagation(): void,
  ...
};

