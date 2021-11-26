import * as api from '@opentelemetry/api';
import {
  W3CTraceContextPropagator,
  TRACE_PARENT_HEADER,
} from '@opentelemetry/core';

/**
 * Returns the context to use in the trace.  If context is provided,
 * that context will be used.  If no context is provided, it will look
 * at environment variables to setup context
 * @param context
 * @returns
 */
export function getContext() {
  if (process.env.TRACEPARENT) {
    const propagator = new W3CTraceContextPropagator();
    return propagator.extract(
      api.context.active(),
      {
        [TRACE_PARENT_HEADER]: process.env.TRACEPARENT,
      },
      api.defaultTextMapGetter
    );
  }

  return undefined;
}
