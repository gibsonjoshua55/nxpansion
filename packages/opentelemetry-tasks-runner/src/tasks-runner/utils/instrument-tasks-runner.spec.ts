import * as api from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Observable } from 'rxjs';
import { EventEmitter } from 'stream';
import { instrumentTasksRunner } from './instrument-tasks-runner';
import * as requireDynamicModuleUtil from './require-dynamic-module';
import { TaskWithSpan } from '../../plugins/nx-default-tasks-runner-instrumentation/opentelemetry-lifecycle';
import { TasksRunnerContext } from '../../plugins/nx-default-tasks-runner-instrumentation/types/tasks-runner-args.type';
import { OpentelemetryTasksRunnerOptions } from '../types/opentelemetry-tasks-runner-options.type';
import {
  AffectedEvent,
  AffectedEventType,
} from '@nrwl/workspace/src/tasks-runner/tasks-runner';

describe('instrumentTasksRunner', () => {
  const createMockSpan = () =>
    ({
      end: jest.fn(),
      setAttribute: jest.fn(),
      setAttributes: jest.fn(),
    } as any as api.Span);

  let tasks: TaskWithSpan[];
  let affectedEvents: (AffectedEvent & { task: TaskWithSpan })[];
  let wrappedTasksRunner: () => Observable<AffectedEvent>;
  let completeWrappedTasksRunner: () => void;
  let otelSdk: NodeSDK;
  let rootSpan: api.Span;

  let tasksRunnerOptions: OpentelemetryTasksRunnerOptions<any>;
  let tasksRunnerContext: TasksRunnerContext;

  beforeEach(() => {
    // setup tasks and events
    tasks = [
      {
        id: 'dep:build',
        overrides: {},
        target: {
          project: 'dep',
          target: 'build',
          configuration: '',
        },
        endTime: [50, 50],
        span: createMockSpan(),
      },
      {
        id: 'web:build',
        overrides: {},
        target: {
          project: 'web',
          target: 'build',
          configuration: '',
        },
        endTime: [100, 100],
        span: createMockSpan(),
      },
    ];
    affectedEvents = tasks.map((task) => ({
      task,
      success: true,
      type: AffectedEventType.TaskComplete,
    }));

    // set up opentelemetry mocks
    otelSdk = {
      shutdown: jest.fn(),
    } as any as NodeSDK;
    rootSpan = createMockSpan();
    jest.spyOn(api.trace, 'getTracer').mockImplementation(
      () =>
        ({
          startActiveSpan: (name, options, ctx, fn) => {
            return fn(rootSpan);
          },
        } as any)
    );

    // mock the wrapped tasks runner
    wrappedTasksRunner = () => {
      const closeObservableEventEmitter: EventEmitter = new EventEmitter();
      completeWrappedTasksRunner = () =>
        closeObservableEventEmitter.emit('close');
      return new Observable((s) => {
        affectedEvents.forEach((event) => {
          s.next(event);
        });
        closeObservableEventEmitter.on('close', () => {
          s.complete();
        });
      });
    };
    jest
      .spyOn(requireDynamicModuleUtil, 'requireDynamicModule')
      .mockImplementation(() => wrappedTasksRunner);

    // setup tasks runner args
    tasksRunnerOptions = {
      wrappedTasksRunner: '@nrwl/workspace/tasks-runners/default',
      wrappedTasksRunnerOptions: {},
    };
    tasksRunnerContext = {
      nxJson: undefined,
      projectGraph: undefined,
      initiatingProject: 'web',
      target: 'build',
    };
  });

  it('should re-emit each affected event', (doneCb) => {
    const observable = instrumentTasksRunner(otelSdk, undefined, [
      tasks,
      tasksRunnerOptions,
      tasksRunnerContext,
    ]);

    let emittedEvents: AffectedEvent[] = [];
    observable.subscribe({
      next: (event) => {
        emittedEvents.push(event);
      },
      complete: () => {
        expect(emittedEvents).toEqual(affectedEvents);
        doneCb();
      },
      error: (error) => {
        doneCb(error);
      },
    });
    completeWrappedTasksRunner();
  });

  it('should create a root span around the observable', (doneCb) => {
    const observable = instrumentTasksRunner(otelSdk, undefined, [
      tasks,
      tasksRunnerOptions,
      tasksRunnerContext,
    ]);

    let emittedEvents: AffectedEvent[] = [];
    observable.subscribe({
      next: (event) => {
        emittedEvents.push(event);
      },
      complete: () => {
        // after the tasks runner is complete, the root span should be ended
        expect(rootSpan.end).toBeCalledTimes(1);
        doneCb();
      },
      error: (error) => {
        doneCb(error);
      },
    });
    // root span should not be called before the wrapped tasks runner is complete
    expect(rootSpan.end).toBeCalledTimes(0);
    completeWrappedTasksRunner();
  });

  it('should shut down the open telemetry sdk after the wrapped tasks runner is complete', (doneCb) => {
    const observable = instrumentTasksRunner(otelSdk, undefined, [
      tasks,
      tasksRunnerOptions,
      tasksRunnerContext,
    ]);

    let emittedEvents: AffectedEvent[] = [];
    observable.subscribe({
      next: (event) => {
        emittedEvents.push(event);
      },
      complete: () => {
        // after the tasks runner is complete, the root span should be ended
        expect(otelSdk.shutdown).toBeCalledTimes(1);
        doneCb();
      },
      error: (error) => {
        doneCb(error);
      },
    });
    // root span should not be called before the wrapped tasks runner is complete
    expect(otelSdk.shutdown).toBeCalledTimes(0);
    completeWrappedTasksRunner();
  });

  it('should record the initiating tasks as attributes on the root span', (doneCb) => {
    const observable = instrumentTasksRunner(otelSdk, undefined, [
      tasks,
      tasksRunnerOptions,
      tasksRunnerContext,
    ]);

    let emittedEvents: AffectedEvent[] = [];
    observable.subscribe({
      next: (event) => {
        emittedEvents.push(event);
      },
      complete: () => {
        expect(rootSpan.setAttributes).toBeCalledWith(
          expect.objectContaining({
            'command.target': tasksRunnerContext.target,
            'command.initiatingProject': tasksRunnerContext.initiatingProject,
          })
        );
        doneCb();
      },
      error: (error) => {
        doneCb(error);
      },
    });
    completeWrappedTasksRunner();
  });

  it('should record task type on each task span and end that span', (doneCb) => {
    const observable = instrumentTasksRunner(otelSdk, undefined, [
      tasks,
      tasksRunnerOptions,
      tasksRunnerContext,
    ]);

    let emittedEvents: AffectedEvent[] = [];
    observable.subscribe({
      next: (event) => {
        emittedEvents.push(event);
      },
      complete: () => {
        affectedEvents.forEach((affectedEvent) => {
          expect(affectedEvent.task.span.setAttribute).toBeCalledWith(
            'task.type',
            affectedEvent.type
          );
          expect(affectedEvent.task.span.end).toBeCalledWith(
            affectedEvent.task.endTime
          );
        });
        doneCb();
      },
      error: (error) => {
        doneCb(error);
      },
    });
    completeWrappedTasksRunner();
  });

  it('should pass the error up if an error occurs in the wrapped observable', (doneCb) => {
    wrappedTasksRunner = () =>
      new Observable((s) => {
        s.error(new Error());
      });

    const observable = instrumentTasksRunner(otelSdk, undefined, [
      tasks,
      tasksRunnerOptions,
      tasksRunnerContext,
    ]);

    let emittedEvents: AffectedEvent[] = [];
    observable.subscribe({
      next: (event) => {
        emittedEvents.push(event);
      },
      error: (error) => {
        expect(error).toBeDefined();
        doneCb();
      },
    });
  });
});
