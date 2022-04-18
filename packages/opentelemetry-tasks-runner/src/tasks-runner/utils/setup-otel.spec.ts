import { Context } from '@opentelemetry/api';
import * as SdkNode from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { mocked } from 'ts-jest/utils';
import * as getDefaultOtelNodeSdkConfiguration from './get-default-otel-node-sdk-configuration';
import * as requireDynamicModule from './require-dynamic-module';
import * as setupOtel from './setup-otel';
import { OpentelemetryTasksRunnerOptions } from '../types/opentelemetry-tasks-runner-options.type';
import { CompositeLifeCycle } from 'nx/src/tasks-runner/life-cycle';
import { TasksRunnerArgs } from '../types/tasks-runner-args.type';

jest.mock('@opentelemetry/sdk-node');
const mockedSdkNode = mocked(SdkNode);

describe('setupOtel', () => {
  let defaultOptions: Partial<SdkNode.NodeSDKConfiguration>;
  beforeEach(() => {
    defaultOptions = {
      traceExporter: new ConsoleSpanExporter(),
    };

    jest
      .spyOn(
        getDefaultOtelNodeSdkConfiguration,
        'getDefaultOtelNodeSdkConfiguration'
      )
      .mockImplementation(() => defaultOptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('setupOtelSdk', () => {
    describe('defaultOptions', () => {
      it('when no setup file is provided the default sdk options are used', () => {
        setupOtel.setupOtelSdk([], {
          wrappedTasksRunner: 'nx/tasks-runners/default',
          wrappedTasksRunnerOptions: {},
          lifeCycle: new CompositeLifeCycle([]),
        });

        expect(mockedSdkNode.NodeSDK).toBeCalledWith(defaultOptions);
      });

      it('when no setup file is provided, no additional context set provided to the context function', () => {
        const { context } = setupOtel.setupOtelSdk([], {
          wrappedTasksRunner: 'nx/tasks-runners/default',
          wrappedTasksRunnerOptions: {},
          lifeCycle: new CompositeLifeCycle([]),
        });

        expect(context).toEqual(undefined);
      });
    });

    describe('setupFile', () => {
      let setupSdk: SdkNode.NodeSDK;
      let setupContext: Context;
      let setupModule: () => { sdk: SdkNode.NodeSDK; context?: Context };
      let args: TasksRunnerArgs<OpentelemetryTasksRunnerOptions<any>>;
      beforeEach(() => {
        setupSdk = new SdkNode.NodeSDK();
        setupContext = {} as Context;
        setupModule = jest.fn(() => ({
          sdk: setupSdk,
          context: setupContext,
        }));
        jest
          .spyOn(requireDynamicModule, 'requireDynamicModule')
          .mockImplementation(() => setupModule);
        args = [
          [],
          {
            wrappedTasksRunner: '@nrwl/workspace/tasks-runners/default',
            wrappedTasksRunnerOptions: {},
            setupFile: './tools/setup-file.js',
            lifeCycle: new CompositeLifeCycle([]),
          },
        ];
      });
      it('when a setup file is provided, the context and sdk returned by the file are used', () => {
        const { sdk, context } = setupOtel.setupOtelSdk(...args);

        expect(setupModule).toBeCalledWith(defaultOptions, ...args);
        expect(sdk).toEqual(setupSdk);
        expect(context).toEqual(setupContext);
      });

      it('the default node sdk options and the task runner args should be provided to the setup file', () => {
        setupOtel.setupOtelSdk(...args);
        expect(setupModule).toBeCalledWith(defaultOptions, ...args);
      });
    });
  });
});
