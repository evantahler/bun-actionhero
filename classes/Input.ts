export interface Input {
  required?: boolean;
  default?: ((p?: any) => any) | any;
  formatter?: Function;
  validator?: (p: any) => Boolean;

  // default?: any;
  // required?: boolean;
  // formatter?: Function;
  // validator?: Function;
}
