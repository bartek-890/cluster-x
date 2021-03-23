export interface ClusterManagerConfig {
  workerLimit?: number;
  env?: { [name: string]: string };
  args?: string[];
  silentMode?: boolean;
  beforeStart?: () => Promise<void>;
}

export interface IWorkerCreator {
  _runningServicesCount: number;
  _configuration: ClusterManagerConfig;
  main: () => Promise<void>;
  start: () => void;
  startJob: () => void;
  createWorker: () => void;
  createMasterProcess: () => Promise<void>;
  configureEventHandlers: () => void;
}

export interface ClusterActualState {
  running: number;
  services: string[];
  workerId: any;
}

type ClusterActions = "check-queue" | "handle-error" | "unhandled-exception";
export interface ClusterCommunicator {
  actions?: ClusterActions;
  message?: string;
}
