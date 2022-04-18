import { NxJsonConfiguration, ProjectGraph } from '@nrwl/devkit';
import { Task } from '@nrwl/workspace/src/tasks-runner/tasks-runner';
export type TasksRunnerContext = {
  target?: string;
  initiatingProject?: string | null;
  projectGraph: ProjectGraph;
  nxJson: NxJsonConfiguration;
  hideCachedOutput?: boolean;
};

export type TasksRunnerArgs<T> = [
  tasks: Task[],
  options: T,
  context?: TasksRunnerContext
];
