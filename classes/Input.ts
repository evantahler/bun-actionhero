export interface Input {
  required?: boolean;
  default?: InputDefault;
  formatter?: InputFormatter;
  validator?: InputValidator;
}

export type InputDefault = ((p?: any) => any) | any;
export type InputFormatter = (arg: any) => any;
export type InputValidator = (p: any) => Boolean;
