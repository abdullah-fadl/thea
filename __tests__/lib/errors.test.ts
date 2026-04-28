import { describe, it, expect } from 'vitest'
import {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  TooManyRequestsError,
} from '@/lib/core/errors'

describe('ApiError', () => {
  it('creates an error with default values', () => {
    const err = new ApiError('Something failed')
    expect(err.message).toBe('Something failed')
    expect(err.statusCode).toBe(500)
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.name).toBe('ApiError')
    expect(err instanceof Error).toBe(true)
  })

  it('creates an error with custom status and code', () => {
    const err = new ApiError('Custom', 418, 'TEAPOT')
    expect(err.statusCode).toBe(418)
    expect(err.code).toBe('TEAPOT')
  })

  it('is an instance of Error', () => {
    const err = new ApiError('test')
    expect(err instanceof Error).toBe(true)
    expect(err instanceof ApiError).toBe(true)
  })
})

describe('BadRequestError', () => {
  it('has correct defaults', () => {
    const err = new BadRequestError()
    expect(err.message).toBe('Bad request')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('BAD_REQUEST')
    expect(err.name).toBe('BadRequestError')
  })

  it('accepts custom message', () => {
    const err = new BadRequestError('Missing field')
    expect(err.message).toBe('Missing field')
    expect(err.statusCode).toBe(400)
  })

  it('is an instance of ApiError', () => {
    expect(new BadRequestError() instanceof ApiError).toBe(true)
  })
})

describe('UnauthorizedError', () => {
  it('has correct defaults', () => {
    const err = new UnauthorizedError()
    expect(err.message).toBe('Unauthorized')
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.name).toBe('UnauthorizedError')
  })

  it('accepts custom message', () => {
    const err = new UnauthorizedError('Token expired')
    expect(err.message).toBe('Token expired')
  })
})

describe('ForbiddenError', () => {
  it('has correct defaults', () => {
    const err = new ForbiddenError()
    expect(err.message).toBe('Forbidden')
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
    expect(err.name).toBe('ForbiddenError')
  })
})

describe('NotFoundError', () => {
  it('has correct defaults', () => {
    const err = new NotFoundError()
    expect(err.message).toBe('Not found')
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('NotFoundError')
  })

  it('accepts custom message', () => {
    const err = new NotFoundError('Patient not found')
    expect(err.message).toBe('Patient not found')
  })
})

describe('ConflictError', () => {
  it('has correct defaults', () => {
    const err = new ConflictError()
    expect(err.message).toBe('Conflict')
    expect(err.statusCode).toBe(409)
    expect(err.code).toBe('CONFLICT')
    expect(err.name).toBe('ConflictError')
  })
})

describe('UnprocessableError', () => {
  it('has correct defaults', () => {
    const err = new UnprocessableError()
    expect(err.message).toBe('Unprocessable entity')
    expect(err.statusCode).toBe(422)
    expect(err.code).toBe('UNPROCESSABLE')
    expect(err.name).toBe('UnprocessableError')
  })
})

describe('TooManyRequestsError', () => {
  it('has correct defaults', () => {
    const err = new TooManyRequestsError()
    expect(err.message).toBe('Too many requests')
    expect(err.statusCode).toBe(429)
    expect(err.code).toBe('TOO_MANY_REQUESTS')
    expect(err.name).toBe('TooManyRequestsError')
  })
})

describe('Error hierarchy', () => {
  const errorClasses = [
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    UnprocessableError,
    TooManyRequestsError,
  ] as const

  it('all subclasses extend ApiError', () => {
    for (const ErrorClass of errorClasses) {
      const err = new ErrorClass()
      expect(err instanceof ApiError).toBe(true)
      expect(err instanceof Error).toBe(true)
    }
  })

  it('all subclasses have unique status codes', () => {
    const codes = errorClasses.map(E => new E().statusCode)
    const unique = new Set(codes)
    expect(unique.size).toBe(codes.length)
  })

  it('all subclasses have unique error codes', () => {
    const codes = errorClasses.map(E => new E().code)
    const unique = new Set(codes)
    expect(unique.size).toBe(codes.length)
  })
})
