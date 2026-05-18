/* @flow strict */

import { vesicle } from "./Vesicle";
import type {
  FieldDescriptors,
  FieldValues,
  NavigationGuardConfig,
  OptimisticFn,
  ValidatorFn,
  Vesicle,
} from "./Types";

type GraphQLFetcher = (input: {
  +query: string,
  +variables: { +[string]: mixed },
  +signal: AbortSignal,
  +headers: { +[string]: string },
}) => Promise<{
  +data?: ?{ +[string]: mixed },
  +errors?: ?$ReadOnlyArray<{
    +message: string,
    +path?: ?$ReadOnlyArray<string | number>,
    +extensions?: ?{ +[string]: mixed },
    ...
  }>,
}>;

export type GraphQLBridgeConfig<F: FieldDescriptors, TResult> = {
  +mutation: string,
  +fields: F,
  +endpoint?: string,
  +fetch?: GraphQLFetcher,
  +headers?: () => { +[string]: string } | Promise<{ +[string]: string }>,
  +variables?: (values: FieldValues<F>) => { +[string]: mixed },
  +select?: (data: { +[string]: mixed }) => TResult,
  +validate?: ValidatorFn<F>,
  +optimistic?: OptimisticFn<F>,
  +navigation?: NavigationGuardConfig<F>,
  +permalink?: string,
  +initial?: Partial<FieldValues<F>>,
};

export class GraphQLBridgeError extends Error {
  errors: $ReadOnlyArray<{
    +message: string,
    +path?: ?$ReadOnlyArray<string | number>,
    +extensions?: ?{ +[string]: mixed },
    ...
  }>;

  constructor(
    message: string,
    errors: $ReadOnlyArray<{
      +message: string,
      +path?: ?$ReadOnlyArray<string | number>,
      +extensions?: ?{ +[string]: mixed },
      ...
    }>,
  ): void {
    super(message);
    this.name = "GraphQLBridgeError";
    this.errors = errors;
  }
}

function defaultFetcher(endpoint: string): GraphQLFetcher {
  return async ({ query, variables, signal, headers }) => {
    if (typeof fetch !== "function") {
      throw new Error(
        "flow-vesicle/graphql: global fetch is not available; pass `fetch` explicitly in this environment.",
      );
    }
    const merged: { [string]: string } = { "Content-Type": "application/json" };
    for (const key of Object.keys(headers)) {
      merged[key] = headers[key];
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: merged,
      body: JSON.stringify({ query, variables }),
      signal,
    });
    if (!response.ok) {
      throw new Error(
        `flow-vesicle/graphql: ${endpoint} responded with HTTP ${String(response.status)} ${response.statusText}`,
      );
    }
    const body = await response.json();
    return (body as $FlowFixMe);
  };
}

function identityVariables<F: FieldDescriptors>(values: FieldValues<F>): { +[string]: mixed } {
  return (values as $FlowFixMe as { +[string]: mixed });
}

function defaultSelect<TResult>(data: { +[string]: mixed }): TResult {
  return (data as $FlowFixMe as TResult);
}

function fieldNameForError(
  path: ?$ReadOnlyArray<string | number>,
  fieldNames: $ReadOnlyArray<string>,
): ?string {
  if (path == null) {
    return null;
  }
  for (const segment of path) {
    if (typeof segment === "string" && fieldNames.includes(segment)) {
      return segment;
    }
  }
  return null;
}

function bridgeErrorsToFieldErrors<F: FieldDescriptors>(
  fields: F,
  graphqlErrors: $ReadOnlyArray<{
    +message: string,
    +path?: ?$ReadOnlyArray<string | number>,
    ...
  }>,
): { +per: { +[string]: string }, +global: ?Array<string> } {
  const fieldNames = Object.keys(fields);
  const per: { [string]: string } = {};
  const global: Array<string> = [];
  for (const entry of graphqlErrors) {
    const name = fieldNameForError(entry.path, fieldNames);
    if (name != null && per[name] == null) {
      per[name] = entry.message;
    } else {
      global.push(entry.message);
    }
  }
  return {
    per: (per as $FlowFixMe),
    global: global.length === 0 ? null : global,
  };
}

export function vesicleFromMutation<F: FieldDescriptors, TResult = { +[string]: mixed }>(
  config: GraphQLBridgeConfig<F, TResult>,
): Vesicle<F, TResult> {
  if (config.fetch == null && (config.endpoint == null || config.endpoint === "")) {
    throw new Error(
      "flow-vesicle/graphql: vesicleFromMutation requires either `endpoint` or `fetch`.",
    );
  }
  const fetcher: GraphQLFetcher = config.fetch != null
    ? config.fetch
    : defaultFetcher((config.endpoint as $FlowFixMe as string));
  const buildVariables = config.variables ?? identityVariables;
  const select = config.select ?? defaultSelect;

  const action = async (formData: FormData): Promise<TResult> => {
    const variables: { +[string]: mixed } = (() => {
      const fromValues: { [string]: mixed } = {};
      for (const name of Object.keys(config.fields)) {
        const descriptor = config.fields[name];
        if (formData.has(name)) {
          const all = formData.getAll(name);
          const raw: mixed = all.length > 1 ? all : all[0];
          fromValues[name] = descriptor.parse(raw);
        } else {
          fromValues[name] = descriptor.empty();
        }
      }
      return buildVariables(fromValues as $FlowFixMe as FieldValues<F>);
    })();
    const controller = new AbortController();
    const headers = config.headers != null ? await config.headers() : {};
    const response = await fetcher({
      query: config.mutation,
      variables,
      signal: controller.signal,
      headers,
    });
    if (response.errors != null && response.errors.length > 0) {
      throw new GraphQLBridgeError(response.errors[0].message, response.errors);
    }
    const data = response.data;
    if (data == null) {
      throw new GraphQLBridgeError("GraphQL response contained no data", []);
    }
    return select(data);
  };

  return vesicle<F, TResult>({
    fields: config.fields,
    action,
    validate: config.validate,
    optimistic: config.optimistic,
    navigation: config.navigation,
    permalink: config.permalink,
    initial: config.initial,
  });
}

export function applyGraphQLErrors<F: FieldDescriptors>(
  fields: F,
  error: mixed,
): { +per: { +[string]: string }, +global: ?Array<string> } {
  if (error instanceof GraphQLBridgeError) {
    return bridgeErrorsToFieldErrors(fields, error.errors);
  }
  return { per: ({} as $FlowFixMe), global: null };
}
