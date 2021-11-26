import { defer, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { OpentelemetryTasksRunnerOptions } from './types/opentelemetry-tasks-runner-options.type';
import { getContext } from './utils/get-context';
import { instrumentTasksRunner } from './utils/instrument-tasks-runner';
import { setupOtelSdk } from './utils/setup-otel';
import type {
  AffectedEvent,
  TasksRunner,
} from '@nrwl/workspace/src/tasks-runner/tasks-runner';

/**
 * This tasks runner will create a root span for the command be executed and child span for
 * each target that is being executed. By default, spans are printed to the console, however
 * a setupFile can be provided that creates a custom Otel NodeSdk that can configure how to process
 * and export spans.
 * @param options
 * @returns An observable that forwards the emitted tasks by the wrapped tasks runner
 */
export const opentelemetryNxRunner: TasksRunner<
  OpentelemetryTasksRunnerOptions<any>
> = (...options) => {
  const [_tasks, runnerOptions] = options;
  if (!runnerOptions.wrappedTasksRunner) {
    throw new Error(
      'Missing wrapped tasks runner. Please ensure the option wrappedTasksRunner is set in your runner configuration.'
    );
  }
  const { sdk, context: setupContext } = setupOtelSdk(...options);
  const context = setupContext ?? getContext();

  const start = async () => {
    await sdk.start();
  };
  const observable: Observable<AffectedEvent> = defer(start).pipe(
    switchMap(() => instrumentTasksRunner(sdk, context, options))
  );

  return observable;
};
