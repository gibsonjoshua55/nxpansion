import type { TasksRunner } from 'nx/src/tasks-runner/tasks-runner';
import { OpentelemetryTasksRunnerOptions } from './types/opentelemetry-tasks-runner-options.type';
import { getContext } from './utils/get-context';
import {
  instrumentObservableTasksRunner,
  instrumentPromiseTasksRunner,
} from './utils/instrument-tasks-runner';
import { setupOtelSdk } from './utils/setup-otel';

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

  if (runnerOptions.isLegacyTasksRunner) {
    return instrumentObservableTasksRunner(sdk, context, options);
  } else {
    return instrumentPromiseTasksRunner(sdk, context, options);
  }
};
