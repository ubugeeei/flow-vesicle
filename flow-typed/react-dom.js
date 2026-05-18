/* @flow */

declare module "react-dom" {
  declare export type FormStatusShape = {
    +pending: boolean,
    +data: ?FormData,
    +method: ?string,
    +action: ?(string | (FormData) => Promise<mixed> | mixed),
  };

  declare export function useFormStatus(): FormStatusShape;
}
