export interface Input<T> {
  default?: T | ((p?: T) => T);
  required?: boolean;
  formatter?: (p: any) => T;
  validator?: (p: T) => Boolean;
}
