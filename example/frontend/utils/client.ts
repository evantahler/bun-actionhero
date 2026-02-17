const apiUrl: string = process.env.NEXT_PUBLIC_API_URL;

export const wrappedFetch = async <T>(
  url: string,
  options: RequestInit = {},
  errorHandler: (error: Error) => void = console.error,
): Promise<null | T> => {
  const mergedOptions: RequestInit = {
    credentials: "include",
    ...options,
  };

  try {
    const response = await fetch(`${apiUrl}${url}`, mergedOptions);
    const payload = await response.json();
    if (payload.error) {
      errorHandler(payload.error);
      return null;
    }

    return payload as T;
  } catch (error: unknown) {
    errorHandler(error as Error);
    throw error;
  }
};
