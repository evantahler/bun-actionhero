import { type Input } from "./Input";
import { type Action } from "./Action";

export interface Inputs {
  [key: string]: Input<any>;
}

type ClassWithParams = Action;

type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T];
type FormatterOrString<I extends Input<any>> = I["formatter"] extends (
  ...args: any[]
) => any
  ? ReturnType<I["formatter"]>
  : string;
type RequiredParamsKeys<A extends ClassWithParams> = KeysOfType<
  A["inputs"],
  Required
>;
type Required = Readonly<{ required: true }> | { required: true };

type ParamsExtractor<A extends ClassWithParams> = {
  [Input in keyof A["inputs"]]: FormatterOrString<A["inputs"][Input]>;
};

export type ParamsFrom<A extends ClassWithParams> = Pick<
  ParamsExtractor<A>,
  RequiredParamsKeys<A>
> &
  Partial<ParamsExtractor<A>>;
