/* @flow strict */

"use client";

import * as React from "react";
import { useCell } from "flow-cell/client";
import type {
  FieldDescriptors,
  SubmitButtonProps,
  UseVesicleOptions,
  Values,
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
): Values<F> {
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

const reactDom: $FlowFixMe = (() => {
  try {
    // eslint-disable-next-line global-require
    return require("react-dom");
  } catch (_err) {
    return null;
  }
})();

type FormStatusShape = {
  +pending: boolean,
  +data: ?FormData,
  +method: ?string,
  +action: ?(string | (FormData) => Promise<mixed> | mixed),
};

const idleFormStatus: FormStatusShape = Object.freeze({
  pending: false,
  data: null,
  method: null,
  action: null,
});

export function useFormStatus(): FormStatusShape {
  if (reactDom != null && typeof reactDom.useFormStatus === "function") {
    return reactDom.useFormStatus();
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
