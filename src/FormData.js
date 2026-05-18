/* @flow strict */

export function objectFromFormData(
  formData: FormData,
): { [string]: mixed } {
  const result: { [string]: mixed } = {};
  for (const [key, value] of formData.entries()) {
    if (Object.hasOwn(result, key)) {
      const current = result[key];
      result[key] = Array.isArray(current) ? current.concat(value) : [current, value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isHTMLFormElement(value: mixed): boolean {
  return (
    typeof HTMLFormElement !== "undefined"
    && value instanceof HTMLFormElement
  );
}

export function readFormPayload(input: mixed): { [string]: mixed } {
  if (typeof FormData !== "undefined" && input instanceof FormData) {
    return objectFromFormData(input);
  }
  if (input != null && typeof input === "object") {
    const event = input as $FlowFixMe;
    if (event.currentTarget != null && isHTMLFormElement(event.currentTarget)) {
      const form = event.currentTarget as $FlowFixMe;
      return objectFromFormData(new FormData(form));
    }
    if (event.target != null && isHTMLFormElement(event.target)) {
      const form = event.target as $FlowFixMe;
      return objectFromFormData(new FormData(form));
    }
    return { ...(input as $FlowFixMe) };
  }
  return {};
}

export function buildFormData(values: { +[string]: mixed }): FormData {
  const form = new FormData();
  for (const key of Object.keys(values)) {
    const value = values[key];
    if (value == null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        form.append(key, entry);
      }
    } else if (typeof value === "boolean") {
      if (value === true) {
        form.append(key, "on");
      }
    } else {
      form.append(key, value as $FlowFixMe);
    }
  }
  return form;
}
