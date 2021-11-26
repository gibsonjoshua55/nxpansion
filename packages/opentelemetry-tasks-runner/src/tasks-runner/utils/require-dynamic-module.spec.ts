import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { join } from 'path';
import { requireDynamicModule } from './require-dynamic-module';
describe('requireDynamicModule', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should require a relative path module, relative to app root', () => {
    const relativePath =
      './packages/opentelemetry-tasks-runner/example/example-honeycomb-setup';
    const modulePath = join(appRootPath, relativePath);
    const mockModule = jest.fn();
    jest.doMock(modulePath, () => mockModule);

    const requiredModule = requireDynamicModule(relativePath);

    expect(requiredModule).toEqual(mockModule);
  });

  it('should require an npm module', () => {
    const module = '@nrwl/workspace/tasks-runners/default';
    const mockModule = jest.fn();
    jest.doMock(module, () => mockModule);

    const requiredModule = requireDynamicModule(module);

    expect(requiredModule).toEqual(mockModule);
  });

  it('should return the default export if that is defined', () => {
    const module = '@nrwl/workspace/tasks-runners/default';
    const mockModule = jest.fn();
    jest.doMock(module, () => ({
      default: mockModule,
    }));

    const requiredModule = requireDynamicModule(module);

    expect(requiredModule).toEqual(mockModule);
  });
});
