import { context, Context } from '@opentelemetry/api';
import { getContext } from './get-context';
import {
  W3CTraceContextPropagator,
  TRACE_PARENT_HEADER,
} from '@opentelemetry/core';

describe('getContext', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    process.env = { ...OLD_ENV }; // Make a copy
  });

  afterAll(() => {
    process.env = OLD_ENV; // Restore old environment
  });

  it('should parse the w3c trace context if provided', async () => {
    const extractedContext = {} as Context;
    const extractSpy = jest
      .spyOn(W3CTraceContextPropagator.prototype, 'extract')
      .mockImplementation(() => extractedContext);
    const traceparent =
      '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    process.env.TRACEPARENT = traceparent;

    const returnedContext = getContext();

    expect(returnedContext).toEqual(extractedContext);
    expect(extractSpy).toBeCalledWith(
      context.active(),
      {
        [TRACE_PARENT_HEADER]: process.env.TRACEPARENT,
      },
      expect.anything()
    );
  });

  it('should return undefined if no traceparent is set', () => {
    const returnedContext = getContext();

    expect(returnedContext).toEqual(undefined);
  });
});
