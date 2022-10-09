import { LifeCycle } from 'nx/src/tasks-runner/life-cycle';

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
   * If true, the wrapped tasks runner is a legacy runner using observables.
   */
  isLegacyTasksRunner?: boolean;
  /**
   * Default: otlp
   *
   * The otlp uses gRPC to send traces via the OpenTelemetry Protocol.
   */
  exporter?: 'otlp' | 'otlp-grpc' | 'otlp-http' | 'console';
  /**
   * If using an OTLP exporter, you can provide any options to be passed into
   * the exporter here.
   */
  otlpOptions?: any;
  /**
   * Allows a custom NodeSdk to be set up, allowing for custom processors
   * and exporters.
   */
  setupFile?: string;
  /**
   * If true, nx cache will not be used for executed tasks
   */
  skipNxCache?: boolean;

  /**
   * If true, the traceParent parameter will not be passed to ran tasks.
   */
  disableContextPropagation?: boolean;
  /**
   * The lifecycle provided to this tasks runner that will be combined with the
   * OpenTelemetry lifecycle.
   */
  lifeCycle: LifeCycle;
}
