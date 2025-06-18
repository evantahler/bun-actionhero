import { z, type ZodTypeAny, type ZodRawShape } from "zod";

// Custom zod extension to mark fields as secret
// This module augmentation and prototype extension allows .secret() to be used on zod fields

declare module "zod" {
  interface ZodString {
    secret(): ZodString;
  }
  interface ZodNumber {
    secret(): ZodNumber;
  }
  interface ZodBoolean {
    secret(): ZodBoolean;
  }
  interface ZodArray<T extends ZodTypeAny> {
    secret(): ZodArray<T>;
  }
  interface ZodObject<T extends ZodRawShape> {
    secret(): ZodObject<T>;
  }
  interface ZodOptional<T extends ZodTypeAny> {
    secret(): ZodOptional<T>;
  }
  interface ZodNullable<T extends ZodTypeAny> {
    secret(): ZodNullable<T>;
  }
  interface ZodDefault<T extends ZodTypeAny> {
    secret(): ZodDefault<T>;
  }
}

z.ZodString.prototype.secret = function () {
  this._def.isSecret = true;
  return this;
};
z.ZodNumber.prototype.secret = function () {
  this._def.isSecret = true;
  return this;
};
z.ZodBoolean.prototype.secret = function () {
  this._def.isSecret = true;
  return this;
};
z.ZodArray.prototype.secret = function () {
  this._def.isSecret = true;
  return this;
};
z.ZodObject.prototype.secret = function () {
  this._def.isSecret = true;
  return this;
};
z.ZodOptional.prototype.secret = function () {
  this._def.isSecret = true;
  return this;
};
z.ZodNullable.prototype.secret = function () {
  this._def.isSecret = true;
  return this;
};
z.ZodDefault.prototype.secret = function () {
  this._def.isSecret = true;
  return this;
};
