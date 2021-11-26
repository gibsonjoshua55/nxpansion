import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { isRelativePath } from '@nrwl/workspace/src/utilities/fileutils';
import { join } from 'path';

export function requireDynamicModule(modulePath: string) {
  let requiredModule;
  if (isRelativePath(modulePath)) {
    modulePath = join(appRootPath, modulePath);
  }

  requiredModule = require(modulePath);
  // to support both babel and ts formats
  if (requiredModule.default) {
    requiredModule = requiredModule.default;
  }
  return requiredModule;
}
