export interface Input {
  required?: boolean;
  default?: InputDefault;
  formatter?: InputFormatter;
  validator?: InputValidator;
  secret?: boolean;
}

export type InputDefault = ((p?: any) => any) | any;
export type InputFormatter = (arg: any) => any;
export type InputValidator = (p: any) => true | string | Error; // true means valid - everything else is an error message
