import { OTLPTraceExporter as OTLPGRPCTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPHTTPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OpentelemetryTasksRunnerOptions } from '../types/opentelemetry-tasks-runner-options.type';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';

export function getDefaultOtelNodeSdkConfiguration(
  options: OpentelemetryTasksRunnerOptions<any>
): Partial<NodeSDKConfiguration> {
  let spanExporter: SpanExporter;
  if (options.exporter === 'console') {
    spanExporter = new ConsoleSpanExporter();
  } else if (options.exporter === 'otlp-http') {
    spanExporter = new OTLPHTTPTraceExporter(options.otlpOptions);
  } else {
    spanExporter = new OTLPGRPCTraceExporter(options.otlpOptions);
  }
  const spanProcessor = new BatchSpanProcessor(spanExporter);
  return {
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'nx-cli',
    }),
    traceExporter: spanExporter,
    spanProcessor,
  };
}
