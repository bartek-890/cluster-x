import { ClusterManagerConfig } from "../interfaces/interfaces";
import os from "os";
import { log } from "./console-log-customs";

export const cpusChecker = (config?: ClusterManagerConfig): number => {
  const cpus = os.cpus().length;
  if (config) {
    if (!(config.workerLimit > cpus)) {
      return config.workerLimit;
    }
    log.warning(
      "You add limit biggest than cpus that you have. Number will be changed."
    );
    return cpus;
  }
  return cpus;
};
