import type { Task } from '@nrwl/devkit';
import {
  Context,
  defaultTextMapSetter,
  ROOT_CONTEXT,
  Span,
  trace,
  Tracer,
} from '@opentelemetry/api';
import {
  TRACE_PARENT_HEADER,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { api } from '@opentelemetry/sdk-node';
import type {
  LifeCycle,
  TaskMetadata,
  TaskResult,
} from 'nx/src/tasks-runner/life-cycle';

/**
 * This lifecycle creates a span for each target that is executed in an
 * nx command.
 */
export class OpentelemetryLifecycle implements LifeCycle {
  private readonly tracer: Tracer;

  private readonly spans: {
    [taskId: string]: Span;
  } = {};

  constructor(private readonly context?: Context) {
    this.tracer = trace.getTracer('opentelemetry-tasks-runner', '0.1.0');
  }

  endCommand(): void {
    // do nothing
  }

  startCommand(): void {
    // do nothing
  }

  scheduleTask(task: Task) {
    // do nothing
  }

  startTasks(tasks: Task[]): void {
    tasks.forEach((task) => {
      this.createSpan(task);
    });
  }

  endTasks(taskResults: TaskResult[], metadata: TaskMetadata): void {
    taskResults.forEach(({ task, status, code }) => {
      this.spans[task.id]?.setAttributes({
        'task.status': status,
        'task.code': code,
      });
      this.spans[task.id]?.end();
    });
  }

  printTaskTerminalOutput(): void {
    // do nothing
  }

  private createSpan(task: Task) {
    const span = this.tracer.startSpan(task.id, undefined, this.context);

    span.setAttributes({
      'task.id': task.id,
      'task.target.project': task.target.project,
      'task.target.target': task.target.target,
      'task.target.configuration': task.target.configuration,
      'task.hash': task.hash,
      'task.hash.command': task.hashDetails.command,
    });

    this.spans[task.id] = span;

    const overrides = task.overrides ?? {};
    task.overrides = this.setTraceParent(span, overrides);

    return span;
  }

  private setTraceParent(span: Span, overrides: any) {
    const propagator = new W3CTraceContextPropagator();
    const context = api.trace.setSpanContext(ROOT_CONTEXT, span.spanContext());
    propagator.inject(context, overrides, {
      set: (carrier, key, value) => {
        if (key === TRACE_PARENT_HEADER) {
          carrier['traceParent'] = value;
        } else {
          defaultTextMapSetter.set(carrier, key, value);
        }
      },
    });
    return overrides;
  }
}
