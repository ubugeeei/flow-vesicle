/* @flow strict */

"use client";

import * as React from "react";
import * as ReactDom from "react-dom";
import { useCell } from "flow-cell/client";
import type { FormStatusShape } from "react-dom";
import type {
  FieldDescriptors,
  FieldValues,
  SubmitButtonProps,
  UseVesicleAction,
  UseVesicleOptions,
  Vesicle,
  VesicleHandle,
} from "./Types";

export function useVesicle<F: FieldDescriptors, TResult>(
  definition: Vesicle<F, TResult>,
  options?: UseVesicleOptions<F>,
): VesicleHandle<F, TResult> {
  const ref = React.useRef<?VesicleHandle<F, TResult>>(null);
  if (ref.current == null) {
    ref.current = definition.bind(options);
  }
  return ref.current;
}

export function useVesicleValues<F: FieldDescriptors, TResult>(
  handle: VesicleHandle<F, TResult>,
): FieldValues<F> {
  return useCell(handle.values);
}

export function useVesicleDirty<F: FieldDescriptors, TResult>(
  handle: VesicleHandle<F, TResult>,
): boolean {
  return useCell(handle.dirty);
}

export function useVesicleValid<F: FieldDescriptors, TResult>(
  handle: VesicleHandle<F, TResult>,
): boolean {
  return useCell(handle.valid);
}

export function useVesiclePending<F: FieldDescriptors, TResult>(
  handle: VesicleHandle<F, TResult>,
): boolean {
  return useCell(handle.pending);
}

const reactUseActionState: $FlowFixMe = (React as $FlowFixMe).useActionState;

export function useVesicleAction<F: FieldDescriptors, TResult>(
  handle: VesicleHandle<F, TResult>,
  initialState: TResult | null,
  permalink?: string,
): UseVesicleAction<TResult> {
  if (typeof reactUseActionState !== "function") {
    throw new Error(
      "flow-vesicle: useVesicleAction requires React >= 19 (React.useActionState is missing). "
      + "Upgrade `react` and `react-dom` to ^19.0.0 in your app.",
    );
  }
  const dispatcher = React.useCallback(
    async (previous: TResult | null, formData: FormData): Promise<TResult | null> => {
      try {
        const value = await handle.action(formData);
        return value == null ? previous : (value as TResult);
      } catch (_error) {
        return previous;
      }
    },
    [handle],
  );
  const link: ?string = permalink ?? (handle as $FlowFixMe).permalink ?? null;
  const tuple = link != null
    ? reactUseActionState(dispatcher, initialState, link)
    : reactUseActionState(dispatcher, initialState);
  return tuple;
}

const idleFormStatus: FormStatusShape = Object.freeze({
  pending: false,
  data: null,
  method: null,
  action: null,
});

export function useFormStatus(): FormStatusShape {
  if (typeof ReactDom.useFormStatus === "function") {
    return ReactDom.useFormStatus();
  }
  return idleFormStatus;
}

export function SubmitButton(props: SubmitButtonProps): React.Node {
  const status = useFormStatus();
  const createElement: $FlowFixMe = React.createElement;
  const label = status.pending && props.pendingLabel != null
    ? props.pendingLabel
    : props.children;
  return createElement(
    "button",
    {
      type: "submit",
      disabled: props.disabled === true || status.pending === true,
      className: props.className,
      style: props.style,
    },
    label,
  );
}
