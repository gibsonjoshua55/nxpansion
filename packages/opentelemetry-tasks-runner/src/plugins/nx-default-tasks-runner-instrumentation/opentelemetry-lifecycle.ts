import { Task } from '@nrwl/tao/src/shared/tasks';
import { LifeCycle } from '@nrwl/workspace/src/tasks-runner/default-tasks-runner';
import { Span, trace, Tracer } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { api } from '@opentelemetry/sdk-node';

/**
 * This lifecycle creates a span for each target that is executed in an
 * nx command.  It can optionally end the span once the target completes.
 *
 * It may be desired that the span is not completed so that attributes can be
 * added after the target finishes execution. In that case the endTime is recorded
 * on the returned target and should be used to end the span once all attributes have been added.
 */
export class OpentelemetryLifecycle implements LifeCycle {
  private readonly tracer: Tracer;

  constructor(
    public readonly internalLifecycle?: LifeCycle,
    public readonly endSpans = false
  ) {
    this.tracer = trace.getTracer('opentelemetry-tasks-runner', '0.0.1');
  }

  scheduleTask(task: TaskWithSpan) {
    this.internalLifecycle?.scheduleTask(task);
  }

  startTask(task: TaskWithSpan) {
    task.span = this.tracer.startSpan(task.id, undefined, task.context);
    task.span.setAttributes({
      'task.id': task.id,
      'task.target.project': task.target.project,
      'task.target.target': task.target.target,
      'task.target.configuration': task.target.configuration,
      'task.hash': task.hash,
      'task.hash.command': task.hashDetails.command,
    });
    this.internalLifecycle?.startTask(task);
  }

  endTask(task: TaskWithSpan, result: number) {
    if (this.endSpans) {
      task.span.end();
    }
    task.endTime = hrTime();
    this.internalLifecycle?.endTask(task, result);
  }
}

export type TaskWithSpan = Task & {
  span?: Span;
  endTime?: api.HrTime;
  context?: api.Context;
};
