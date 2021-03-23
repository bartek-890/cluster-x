import cluster, { worker } from "cluster";
import { log } from "./helpers/console-log-customs";
import {
  ClusterManagerConfig,
  IWorkerCreator,
  ClusterCommunicator,
} from "./interfaces/interfaces";
import _ from "lodash";
import { cpusChecker } from "./helpers/cpus-checker";

const defaultConfig: ClusterManagerConfig = {
  args: [],
  beforeStart: () => null,
  env: {},
  silentMode: false,
  workerLimit: cpusChecker(),
};

/**
 * Based on cluster API https://nodejs.org/api/cluster.html
 * This one can start separate process called workers which can run callback in asynchronous way
 */
class WorkerCreator implements IWorkerCreator {
  _runningServicesCount: number;
  _configuration: ClusterManagerConfig = {};
  main: () => Promise<void>;

  constructor(
    main: () => Promise<any>,
    configuration: ClusterManagerConfig = defaultConfig
  ) {
    this._runningServicesCount = 0;
    this._configuration = configuration;
    this.main = main;
    this.setDefaultConfiguration();
  }

  /**
   * Starting method
   * just call it to start your cluster thread.
   */
  async start(): Promise<void> {
    try {
      cluster.isMaster
        ? await this.createMasterProcess()
        : await this.startJob();
    } catch (error) {
      this.errorHandler(error);
      process.exit(1);
    }
  }

  /**
   * This one is called only once and this is main process called master
   * @see https://nodejs.org/api/cluster.html
   */
  async createMasterProcess(): Promise<void> {
    /**
     * @access only to master process
     * @param args for process flags
     * @param silent for whether or not to send output to parent's stdio.
     * You will put it in configuration object.
     */
    cluster.setupMaster({
      args: this._configuration?.args,
      silent: this._configuration?.silentMode,
    });

    /**
     * For all operations before create first worker.
     * E.g. Imports, messages, or run another script.
     * There is a problem with shared memory here. You can't get access to resources loaded in beforeStart() method.
     */
    await this._configuration?.beforeStart();

    let envInfoString: string = "";

    for (const [key, value] of Object.entries(this._configuration?.env)) {
      envInfoString = envInfoString.concat(`${key}: ${value} `);
    }

    log.info(`Master process running with pid ${process.pid}`);
    log.info(`WORKER WILL START WITH ENV VARIABLES: ${envInfoString}`);

    /**
     * This is the main method for create worker process. It contains queue manager.
     */
    await this.createWorker();

    /**
     * There you can configure all cluster events.
     */
    this.configureEventHandlers();

    return null;
  }

  setDefaultConfiguration(): void {
    const { args, env, beforeStart, silentMode } = this._configuration;

    this._configuration.args = !!args ? args : [""];
    this._configuration.env = !!env ? env : { CLUSTER: "true" };
    this._configuration.beforeStart = !!beforeStart ? beforeStart : () => null;
    this._configuration.workerLimit = cpusChecker(this._configuration);
    this._configuration.silentMode = !!silentMode ? silentMode : false;
  }

  /**
   * Check limit that you put in configuration object and then decide to create new worker or not
   * TODO: Need to change queue manager to work in multiprocessing correctly.
   */
  async createWorker(): Promise<void> {
    if (this._runningServicesCount < this._configuration.workerLimit) {
      const worker = cluster.fork(this._configuration?.env);

      // Read any messages by master process
      this.messageReader(worker);

      // Counter to control number of processes.
      this._runningServicesCount++;
    } else {
      log.info(
        `FULL QUEUE: running-${this._runningServicesCount} limit-${this._configuration.workerLimit}`
      );
    }
  }

  messageReader(worker): void {
    worker.on("message", async (communicator: ClusterCommunicator) => {
      if (communicator.message) {
        console.log(communicator.message);
      }

      /**
       * Here you can handle all action sent to master process by any worker.
       */
      switch (communicator.actions) {
        case "check-queue":
          break;
        case "handle-error":
          break;
        case "unhandled-exception":
          break;
      }
    });
  }

  configureEventHandlers(): void {
    /**
     * Event when you forked new worker.
     */
    cluster.on("fork", async (worker) => {
      await this.createWorker();
      log.process(
        `The worker #${worker.id} is being created. Process pid ${worker.process.pid}.`
      );
    });

    /**
     * Event when worker start his job.
     */
    cluster.on("online", (worker) => {
      log.process(
        `The worker #${worker.id} is starting job... Process pid ${worker.process.pid}.`
      );
    });

    /**
     * Event when you call worker.kill();
     */
    cluster.on("exit", async (worker, code, signal) => {
      if (code !== 0) {
        log.warning(
          `The worker #${worker.id} crashed with code ${code} and signal ${signal}. Starting a new worker...`
        );
      } else {
        log.process(
          `The worker #${worker.id} done his job. Process pid ${worker.process.pid}`
        );
      }

      this._runningServicesCount--;
      await this.createWorker();
    });
  }

  errorHandler(error): void {
    switch (typeof error) {
      case "object": {
        for (const [key, value] of Object?.entries(error)) {
          log.error(`${key}: ${value}`);
        }
        break;
      }
      case "undefined": {
        log.error("Catch undefined error.");
        break;
      }
      default: {
        log.error(`Worker failed with reason: ${error.toString()}`);
      }
    }
  }

  /**
   * Main method to run specified job in worker thread. This is a place where you execute jobs.
   * After that you kill worker process and create new one.
   */
  async startJob(): Promise<void> {
    try {
      await this.main();
      worker.kill();
    } catch (e) {
      throw e;
    }
  }
}

export default WorkerCreator;
