import * as DefaultTasksRunner from '@nrwl/workspace/src/tasks-runner/default-tasks-runner';
import * as ForkedProcessTAskRunner from '@nrwl/workspace/src/tasks-runner/forked-process-task-runner';
import * as api from '@opentelemetry/api';
import { defaultTextMapSetter, ROOT_CONTEXT } from '@opentelemetry/api';
import * as semver from 'semver';
import { OpentelemetryLifecycle } from './opentelemetry-lifecycle';
import { TasksRunnerArgs } from './types/tasks-runner-args.type';
import { VERSION } from '../../version.const';
import type * as NrwlWorkspace from '@nrwl/workspace';
import {
  TRACE_PARENT_HEADER,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
  InstrumentationNodeModuleFile,
} from '@opentelemetry/instrumentation';

/**
 * This plugin wraps the lifecycle used by the nx default tasks runner with the provided lifecycle.
 * By default, the OpentelemetryLifecycle is used to wrap the internal lifecycle.  Note: By default,
 * the OpentelemetryLifecycle does not end the spans, but instead notes when the span ended. This allows
 * attributes to be added after the target is complete.
 *
 * Additionally, the TRACE_PARENT env is set for the each tasks, representing the context of the span created
 * for that task. This allows individual executors to add their own instrumentation to for what occurs
 * within the task.
 */
export class NxDefaultTasksRunnerInstrumentation extends InstrumentationBase {
  private readonly lifecycleFactory: LifecycleFactory;

  constructor(config: NxDefaultTasksRunnerInstrumentationConfig = {}) {
    super('NxDefaultTasksRunnerInstrumentation', VERSION, config);
    if (!config.lifecycleFactory) {
      this.lifecycleFactory = (wrappedLifecycle) => {
        return new OpentelemetryLifecycle(wrappedLifecycle, config.endSpans);
      };
    } else {
      this.lifecycleFactory = config.lifecycleFactory;
    }
  }

  /**
   * Init method will be called when the plugin is constructed.
   * It returns an `InstrumentationNodeModuleDefinition` which describes
   *   the node module to be instrumented and patched.
   * It may also return a list of `InstrumentationNodeModuleDefinition`s if
   *   the plugin should patch multiple modules or versions.
   */
  protected init() {
    const module = new InstrumentationNodeModuleDefinition<
      typeof NrwlWorkspace
    >('@nrwl/workspace', ['>=12.5']);
    // in case you need to patch additional files - this is optional
    module.files.push(...this._getPatchedFiles());

    return module;
  }

  private _getPatchedFiles(): InstrumentationNodeModuleFile<any>[] {
    const files: InstrumentationNodeModuleFile<any>[] = [];
    files.push(
      new InstrumentationNodeModuleFile<typeof DefaultTasksRunner>(
        '@nrwl/workspace/src/tasks-runner/default-tasks-runner.js',
        ['>=12.5'],
        (...args) => this._onPatchTaskOrchestrator(args[0]),
        (...args) => this._onUnPatchTaskOrchestrator(args[0])
      )
    );

    files.push(
      new InstrumentationNodeModuleFile<typeof ForkedProcessTAskRunner>(
        '@nrwl/workspace/src/tasks-runner/forked-process-task-runner.js',
        ['>=12.5'],
        (...args) => this._onPatchForkedProcessTaskRunner(...args),
        (...args) => this._onUnPatchForkedProcessTaskRunner(args[0])
      )
    );

    return files;
  }
  private _onPatchTaskOrchestrator(moduleExports: typeof DefaultTasksRunner) {
    this._wrap(
      moduleExports,
      'defaultTasksRunner',
      this._patchDefaultTasksRunner()
    );
    return moduleExports;
  }

  private _patchDefaultTasksRunner(): (original) => any {
    const lifecycleFactory = this.lifecycleFactory;
    return function exportedFn(original) {
      return function DefaultTasksRunner() {
        const args =
          // eslint-disable-next-line prefer-rest-params
          arguments as unknown as TasksRunnerArgs<DefaultTasksRunner.DefaultTasksRunnerOptions>;

        const options = args[1] ?? {};

        options.lifeCycle = lifecycleFactory(options.lifeCycle);

        return original.apply(this, arguments);
      };
    };
  }

  private _onUnPatchTaskOrchestrator(moduleExports: typeof DefaultTasksRunner) {
    this._unwrap(moduleExports, 'defaultTasksRunner');
  }

  private _onPatchForkedProcessTaskRunner(
    moduleExports: typeof ForkedProcessTAskRunner,
    moduleVersion: string
  ) {
    if (semver.gte(moduleVersion, '13.0.0')) {
      this._wrap(
        moduleExports,
        'ForkedProcessTaskRunner',
        this._patchForkedProcessTaskRunnerV13()
      );
    } else {
      this._wrap(
        moduleExports,
        'ForkedProcessTaskRunner',
        this._patchForkedProcessTaskRunnerV12()
      );
    }
    return moduleExports;
  }

  private _patchForkedProcessTaskRunnerV12(): (original) => any {
    // create an anon function because this._addTraceparentToEnv can't be called in patched fn
    const addTraceparentToEnv = (task: any, env: any) =>
      this._addTraceparentToEnv(task, env);
    return function exportedFn(original) {
      class ForkedProcessTaskRunnerWithTraceParent extends original {
        envForForkedProcessForTask(...args: any[]) {
          const task = args[0];
          const env = super.envForForkedProcessForTask(...args);
          return addTraceparentToEnv(task, env);
        }
      }

      return ForkedProcessTaskRunnerWithTraceParent;
    };
  }

  private _patchForkedProcessTaskRunnerV13(): (original) => any {
    // create an anon function because this._addTraceparentToEnv can't be called in patched fn
    const addTraceparentToEnv = (task: any, env: any) =>
      this._addTraceparentToEnv(task, env);
    console.log('patching 13');
    return function exportedFn(original) {
      class ForkedProcessTaskRunnerWithTraceParent extends original {
        getEnvVariablesForTask(...args: any[]) {
          console.log('setup env');
          const task = args[0];
          const env = super.getEnvVariablesForTask(...args);
          return addTraceparentToEnv(task, env);
        }
      }

      return ForkedProcessTaskRunnerWithTraceParent;
    };
  }

  private _onUnPatchForkedProcessTaskRunner(
    moduleExports: typeof ForkedProcessTAskRunner
  ) {
    this._unwrap(moduleExports, 'ForkedProcessTaskRunner');
  }

  private _addTraceparentToEnv(task: any, env: any) {
    const propagator = new W3CTraceContextPropagator();
    const context = api.trace.setSpanContext(
      ROOT_CONTEXT,
      task.span.spanContext()
    );
    propagator.inject(context, env, {
      set: (carrier, key, value) => {
        if (key === TRACE_PARENT_HEADER) {
          carrier['TRACEPARENT'] = value;
        } else {
          defaultTextMapSetter.set(carrier, key, value);
        }
      },
    });
    return env;
  }
}

export type LifecycleFactory = (
  wrappedLifecycle?: DefaultTasksRunner.LifeCycle
) => DefaultTasksRunner.LifeCycle;

export interface NxDefaultTasksRunnerInstrumentationConfig
  extends InstrumentationConfig {
  /**
   * If false, spans will not be terminated by the default lifecycle.  This will allow for adding
   * attributes to the span (such as task type) after the target has been emitted by
   * the default tasks runner.
   *
   * If spans are not being terminated the span should be retrieved off the emitted
   * task on the `span` property and ended with `endTime` property on the task after
   * all desired attributes are added.
   *
   * This value is only used if the default lifecycle factory is used.
   *
   * @default false
   * @conflictsWith lifecycleFactory
   */
  endSpans?: boolean;
  /**
   * If a
   */
  lifecycleFactory?: LifecycleFactory;
}
