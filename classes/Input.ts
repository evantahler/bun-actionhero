export interface Input {
  required?: boolean;
  default?: ((p?: any) => any) | any;
  // formatter: (p: any) => any;
  formatter?: Function;
  validator?: (p: any) => Boolean;
}
