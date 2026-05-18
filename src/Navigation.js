/* @flow strict */

"use client";

import * as React from "react";
import type { FieldDescriptors, VesicleHandle } from "./Types";

export type UnsavedChangesGuardOptions<F: FieldDescriptors, TResult> = {
  +enabled?: boolean,
  +message?: string,
  +blockWhen?: (handle: VesicleHandle<F, TResult>) => boolean,
  +interceptLinks?: boolean,
  +confirm?: (message: string) => boolean | Promise<boolean>,
};

const DEFAULT_MESSAGE = "You have unsaved changes. Leave anyway?";

function defaultConfirm(message: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const confirmFn: $FlowFixMe = (window as $FlowFixMe).confirm;
  if (typeof confirmFn !== "function") {
    return false;
  }
  return confirmFn.call(window, message);
}

function findAnchor(target: mixed): ?HTMLAnchorElement {
  if (typeof HTMLAnchorElement === "undefined") {
    return null;
  }
  let node: mixed = target;
  while (node != null && typeof node === "object") {
    if (node instanceof HTMLAnchorElement) {
      return node;
    }
    node = (node as $FlowFixMe).parentNode;
  }
  return null;
}

function sameOriginUrl(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin;
  } catch (_err) {
    return false;
  }
}

export function useUnsavedChangesGuard<F: FieldDescriptors, TResult>(
  handle: VesicleHandle<F, TResult>,
  options?: UnsavedChangesGuardOptions<F, TResult>,
): void {
  const enabled = options?.enabled ?? true;
  const message = options?.message ?? DEFAULT_MESSAGE;
  const interceptLinks = options?.interceptLinks ?? true;
  const confirm = options?.confirm ?? defaultConfirm;
  const blockWhen = options?.blockWhen;

  const handleRef = React.useRef<VesicleHandle<F, TResult>>(handle);
  handleRef.current = handle;

  const shouldBlockRef = React.useRef<() => boolean>(() => false);
  shouldBlockRef.current = () => {
    if (!enabled) {
      return false;
    }
    const current = handleRef.current;
    if (blockWhen != null) {
      return blockWhen(current);
    }
    return current.dirty.get();
  };

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onBeforeUnload = (event: $FlowFixMe): mixed => {
      if (!shouldBlockRef.current()) {
        return undefined;
      }
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    const onPopState = (event: $FlowFixMe): void => {
      if (!shouldBlockRef.current()) {
        return;
      }
      const confirmed = confirm(message);
      if (confirmed instanceof Promise) {
        // Sync answer is required for popstate; default to staying.
        event.preventDefault();
        history.pushState(history.state, "", window.location.href);
        return;
      }
      if (!confirmed) {
        history.pushState(history.state, "", window.location.href);
      }
    };

    const onClickCapture = (event: $FlowFixMe): void => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (!shouldBlockRef.current()) {
        return;
      }
      const anchor = findAnchor(event.target);
      if (anchor == null) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (href == null || href === "" || href.startsWith("#")) {
        return;
      }
      const targetAttr = anchor.getAttribute("target");
      if (targetAttr != null && targetAttr !== "" && targetAttr !== "_self") {
        return;
      }
      if (!sameOriginUrl(href)) {
        return;
      }
      const confirmed = confirm(message);
      if (confirmed instanceof Promise) {
        event.preventDefault();
        return;
      }
      if (!confirmed) {
        event.preventDefault();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    if (interceptLinks && typeof document !== "undefined") {
      document.addEventListener("click", onClickCapture, true);
    }

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      if (interceptLinks && typeof document !== "undefined") {
        document.removeEventListener("click", onClickCapture, true);
      }
    };
  }, [enabled, message, interceptLinks, confirm]);
}
