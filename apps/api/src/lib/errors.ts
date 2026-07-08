export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new ApiError(400, msg, 'BAD_REQUEST', details);
export const unauthorized = (msg = 'Unauthorized') => new ApiError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'Forbidden') => new ApiError(403, msg, 'FORBIDDEN');
export const notFound = (msg = 'Not found') => new ApiError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string) => new ApiError(409, msg, 'CONFLICT');
