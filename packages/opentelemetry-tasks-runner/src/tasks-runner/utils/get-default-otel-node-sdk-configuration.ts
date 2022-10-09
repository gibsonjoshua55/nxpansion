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
  if (options.exporter === 'otlp-http') {
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-http');
    spanExporter = new OTLPTraceExporter(options.otlpOptions);
  } else if (options.exporter === 'otlp-grpc') {
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-grpc');
    spanExporter = new OTLPTraceExporter(options.otlpOptions);
  } else if (options.exporter === 'otlp') {
    console.warn(
      'The otlp option is deprecated. This will be removed in future versions. Use otlp-grpc instead'
    );
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-grpc');
    spanExporter = new OTLPTraceExporter(options.otlpOptions);
  } else {
    spanExporter = new ConsoleSpanExporter();
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
