export function success<T>(data: T) {
  return {
    success: true,
    data,
  };
}

export function failure(message: string, details?: unknown) {
  return {
    success: false,
    message,
    ...(details !== undefined ? { details } : {}),
  };
}
