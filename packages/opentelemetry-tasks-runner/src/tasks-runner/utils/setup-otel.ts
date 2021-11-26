import { Context } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getDefaultOtelNodeSdkConfiguration } from './get-default-otel-node-sdk-configuration';
import { requireDynamicModule } from './require-dynamic-module';
import { TasksRunnerArgs } from '../../plugins/nx-default-tasks-runner-instrumentation/types/tasks-runner-args.type';
import { OpentelemetryTasksRunnerOptions } from '../types/opentelemetry-tasks-runner-options.type';

export function setupOtelSdk(
  ...args: TasksRunnerArgs<OpentelemetryTasksRunnerOptions<any>>
): { sdk: NodeSDK; context?: Context } {
  const [_tasks, options] = args;
  const defaultConfiguration = getDefaultOtelNodeSdkConfiguration(options);

  return options.setupFile
    ? requireDynamicModule(options.setupFile)(defaultConfiguration, ...args)
    : { sdk: new NodeSDK(defaultConfiguration), context: undefined };
}
