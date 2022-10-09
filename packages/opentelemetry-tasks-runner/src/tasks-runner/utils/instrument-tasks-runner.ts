import { Context, trace } from '@opentelemetry/api';
import { api, NodeSDK } from '@opentelemetry/sdk-node';
import { CompositeLifeCycle } from 'nx/src/tasks-runner/life-cycle';
import type {
  AffectedEvent,
  TasksRunner,
  TaskStatus,
} from 'nx/src/tasks-runner/tasks-runner';
import { concat, defer, Observable } from 'rxjs';
import { delayWhen, switchMap, tap } from 'rxjs/operators';
import { VERSION } from '../../version.const';
import { OpentelemetryLifecycle } from '../opentelemetry-lifecycle';
import { OpentelemetryTasksRunnerOptions } from '../types/opentelemetry-tasks-runner-options.type';
import { TasksRunnerArgs } from '../types/tasks-runner-args.type';
import { requireDynamicModule } from './require-dynamic-module';

export async function instrumentPromiseTasksRunner(
  otelSdk: NodeSDK,
  context: Context,
  tasksRunnerArgs: TasksRunnerArgs<OpentelemetryTasksRunnerOptions<any>>
): Promise<{
  [id: string]: TaskStatus;
}> {
  const [tasks, options, ctx] = tasksRunnerArgs;

  await otelSdk.start();

  const tracer = trace.getTracer('@nxpansion/opentelemetry-nx-runner', VERSION);
  const result = await tracer.startActiveSpan(
    'nx-command',
    {},
    context,
    async (span) => {
      const tasksRunner: TasksRunner = requireDynamicModule(
        options.wrappedTasksRunner
      );
      const tasksRunnerPromise = tasksRunner(
        tasks,
        {
          ...options.wrappedTasksRunnerOptions,
          ...options,
          lifeCycle: new CompositeLifeCycle([
            new OpentelemetryLifecycle(api.context.active(), {
              disableContextPropagation: options.disableContextPropagation,
            }),
            options.lifeCycle,
          ]),
        },
        ctx
      );

      if (tasksRunnerPromise instanceof Promise) {
        span.setAttributes({
          'command.target': ctx.target,
          'command.initiatingProject': ctx.initiatingProject,
          'command.tasksCount': tasks.length,
        });

        const result = await tasksRunnerPromise;

        span.end();
        return result;
      } else {
        throw new Error(
          'This tasks runner does not return a Promise. It is likely a legacy tasks runner.'
        );
      }
    }
  );

  await otelSdk.shutdown();

  return result;
}

export function instrumentObservableTasksRunner(
  otelSdk: NodeSDK,
  context: Context,
  tasksRunnerArgs: TasksRunnerArgs<OpentelemetryTasksRunnerOptions<any>>
): Observable<AffectedEvent> {
  const [tasks, options, ctx] = tasksRunnerArgs;

  return defer(async () => await otelSdk.start()).pipe(
    switchMap(() => {
      const tracer = trace.getTracer(
        '@nxpansion/opentelemetry-nx-runner',
        VERSION
      );
      return tracer.startActiveSpan('nx-command', {}, context, (span) => {
        const activeContext = api.context.active();

        const tasksRunner: TasksRunner = requireDynamicModule(
          options.wrappedTasksRunner
        );
        const tasksRunnerObservable = tasksRunner(
          tasks,
          {
            ...options.wrappedTasksRunnerOptions,
            ...options,
            lifeCycle: new CompositeLifeCycle([
              new OpentelemetryLifecycle(activeContext, {
                disableContextPropagation: options.disableContextPropagation,
              }),
              options.lifeCycle,
            ]),
          },
          ctx
        );

        if (tasksRunnerObservable instanceof Observable) {
          span.setAttributes({
            'command.target': ctx.target,
            'command.initiatingProject': ctx.initiatingProject,
            'command.tasksCount': tasks.length,
          });

          return tasksRunnerObservable.pipe(
            delayWhen(() =>
              defer(async () => {
                span.end();
                await otelSdk.shutdown();
              })
            )
          );
        } else {
          throw new Error(
            'This tasks runner does not return a Promise. It is likely a legacy tasks runner. Try setting `"isLegacyTasksRunner": true` in your tasks runner options.'
          );
        }
      });
    })
  );
}
