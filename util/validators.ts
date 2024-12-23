const stringLengthValidator = (s: string, minLength: number) => {
  if (s.length < minLength) {
    throw new Error(
      `This field is required and must be at least ${minLength} characters long`,
    );
  }
};

export const nameValidator = (p: string) => {
  stringLengthValidator(p, 3);

  return true as const;
};

export const messageValidator = (p: string) => {
  stringLengthValidator(p, 3);

  return true as const;
};

export const emailValidator = (p: string): true => {
  stringLengthValidator(p, 3);
  if (!p.includes("@")) throw new Error(`This is not a valid email`);
  if (!p.includes(".")) throw new Error(`This is not a valid email`);

  return true as const;
};

export const passwordValidator = (p: string): true => {
  stringLengthValidator(p, 3);

  return true as const;
};
