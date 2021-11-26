import { OTLPExporterConfigNode } from '@opentelemetry/exporter-otlp-grpc/build/src/types';

export interface OpentelemetryTasksRunnerOptions<T> {
  /**
   * The tasks runner to instrument.  At some level the tasks runner
   * must use the default nx tasks runner to execute tasks.
   *
   * @example @nrwl/workspace/tasks-runners/default
   */
  wrappedTasksRunner: string;
  /**
   * These options will be passed to the wrapped tasks runner.
   */
  wrappedTasksRunnerOptions: T;
  /**
   * Default: otlp
   *
   * The otlp uses gRPC to send traces via the OpenTelemetry Protocol.
   */
  exporter?: 'otlp' | 'console';
  /**
   * If using the OTLP exporter, you can provide an options to be passed into
   * the exporter here.
   */
  otlpOptions?: OTLPExporterConfigNode;
  /**
   * Allows a custom NodeSdk to be set up, allowing for custom processors
   * and exporters.
   */
  setupFile?: string;
}
