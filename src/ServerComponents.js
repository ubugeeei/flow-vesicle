/* @flow strict */

import * as React from "react";
import type {
  ActionFn,
  FieldDescriptors,
  FieldOptions,
  FieldValues,
  Vesicle,
  VesicleBoundHandle,
} from "./Types";

const createElement: $FlowFixMe = (React as $FlowFixMe).createElement;

export type VesicleFormProps<F: FieldDescriptors, TResult> = {
  +vesicle: Vesicle<F, TResult>,
  +action?: ActionFn<TResult> | string,
  +initial?: Partial<FieldValues<F>>,
  +permalink?: string,
  +id?: string,
  +className?: string,
  +method?: string,
  +children?:
    | React.Node
    | ((handle: VesicleBoundHandle<F, TResult>) => React.Node),
};

export function VesicleForm<F: FieldDescriptors, TResult>(
  props: VesicleFormProps<F, TResult>,
): React.Node {
  const handle = props.vesicle.bind({
    initial: props.initial,
    permalink: props.permalink,
  });
  const childrenProp = props.children;
  const rendered: React.Node = typeof childrenProp === "function"
    ? childrenProp(handle)
    : (childrenProp ?? null);

  const formProps: { [string]: mixed } = {
    id: props.id,
    className: props.className,
    method: props.method ?? "post",
  };
  if (props.action != null) {
    formProps.action = props.action;
  }

  return createElement("form", formProps, rendered);
}

export type VesicleFieldProps<F: FieldDescriptors, TResult> = {
  +vesicle: Vesicle<F, TResult>,
  +name: $Keys<F>,
  +as?: "input" | "textarea" | "select",
  +overrides?: FieldOptions,
  +id?: string,
  +className?: string,
  +placeholder?: string,
  +children?: React.Node,
};

export function VesicleField<F: FieldDescriptors, TResult>(
  props: VesicleFieldProps<F, TResult>,
): React.Node {
  const handle = props.vesicle.bind();
  const fieldHandle = (handle.fields as $FlowFixMe)[props.name];
  const inputProps: { [string]: mixed } = {
    ...fieldHandle.input(props.overrides),
    id: props.id,
    className: props.className,
  };
  if (props.placeholder != null) {
    inputProps.placeholder = props.placeholder;
  }
  const tag: "input" | "textarea" | "select" = props.as ?? (() => {
    switch (fieldHandle.kind) {
      case "textarea": return "textarea";
      case "select": return "select";
      default: return "input";
    }
  })();
  if (tag === "input") {
    return createElement("input", inputProps);
  }
  if (tag === "textarea") {
    delete inputProps.type;
    return createElement("textarea", inputProps);
  }
  delete inputProps.type;
  return createElement("select", inputProps, props.children);
}
