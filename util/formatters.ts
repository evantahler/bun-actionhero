export function ensureString<T extends string>(param: unknown) {
  return String(param) as T;
}

export function ensureNumber(param: string | number) {
  if (typeof param === "number") return param;
  try {
    const parsed = parseFloat(param);
    if (isNaN(parsed)) throw new Error("NaN");
    return parsed;
  } catch (error) {
    throw new Error(`${param} cannot be converted to number (${error})`);
  }
}

export function ensureBoolean(param: boolean | string | number) {
  if (param === true || param === false) return param;
  if (
    param === 1 ||
    param === "1" ||
    (typeof param === "string" && param.toLowerCase() === "true")
  ) {
    return true;
  }
  if (
    param === 0 ||
    param === "0" ||
    (typeof param === "string" && param.toLowerCase() === "false")
  ) {
    return false;
  }
  throw new Error(`${param} cannot be converted to a boolean`);
}

export function ensureDate(param: Date | string | number) {
  if (param instanceof Date) return param;

  if (typeof param === "string" || typeof param === "number") {
    const asNumber = Number(param);
    if (!isNaN(asNumber)) param = asNumber;

    const date = new Date(param);
    if (!isNaN(date.getTime())) return date;
  }

  throw new Error(`${param} cannot be converted to a date`);
}

export function ensureArray<T>(param: { [key: string]: any } | string) {
  return ensureObjectOrArray<Array<any>>(param);
}

export function ensureObject(param: { [key: string]: any } | string) {
  return ensureObjectOrArray<Object>(param);
}

export function ensureObjectOrArray<T extends Array<any> | Object>(
  param: { [key: string]: any } | string,
  recursing = false,
): T extends Array<any> ? any[] : Record<string, any> {
  if (Array.isArray(param)) {
    try {
      return param.map((row) => ensureObjectOrArray(row, true));
    } catch (error) {
      throw new Error(`${param} cannot be converted to JSON object (${error})`);
    }
  } else if (typeof param === "string") {
    try {
      return JSON.parse(param) as T extends Array<any>
        ? any[]
        : Record<string, any>;
    } catch (error) {
      if (recursing) {
        return param as unknown as T extends Array<any>
          ? any[]
          : Record<string, any>;
      } else {
        throw new Error(
          `${param} cannot be converted to JSON object (${error})`,
        );
      }
    }
  } else {
    return param as T extends Array<any> ? any[] : Record<string, any>;
  }
}
