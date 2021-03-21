import {ClusterManagerConfig, IWorkerCreator} from "./interfaces/interfaces";
import * as cluster from "cluster";
import {log} from "./helpers/console-log-customs";
import {readYamlConfiguration} from "./helpers/utils";
import {worker} from "cluster";

class WorkerCreator implements IWorkerCreator {
    _runningServicesCount: number;
    _configuration: ClusterManagerConfig = {} as any;
    _queue: string[] = [];
    _runningService: string;
    main: () => Promise<void>;

    constructor(beforeStart: () => Promise<void>, main: () => Promise<any>) {
        this._configuration.beforeStart = beforeStart;
        this._runningServicesCount = 0;
        this.main = main;
    }

    /**
     * Starting method
     * just call it to start your cluster thread.
     */
    async start(): Promise<void> {
        try {
            cluster.isMaster ? await this.createMasterProcess() : await this.startJob();
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
         * Load configuration file.
         * Setup config.
         * You will load here an array with scrapers that you want to run.
         * TODO: Make it as another method where you can make specified logic for all configuration fields in file.
         */
        this.setConfig();

        /**
         * @access only to master process
         * @param args for process flags
         * @param silent for whether or not to send output to parent's stdio.
         * You will put it in configuration object.
         */
        cluster.setupMaster({
            args: this._configuration.args,
            silent: this._configuration.silentMode,
        });

        /**
         * For all operations before create first worker.
         * E.g. Imports, messages, or run another script.
         * There is a problem with shared memory here. You can't get access to resources loaded in beforeStart() method.
         */
        await this._configuration.beforeStart();

        let envInfoString: string = '';

        for (const [key, value] of Object.entries(this._configuration.env)) {
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

    /**
     * Check limit that you put in configuration object and then decide to create new worker or not
     * TODO: Need to change queue manager to work in multiprocessing correctly.
     */
    async createWorker(): Promise<void> {
        if (this._runningServicesCount < this._configuration.workerLimit) {
            await this.queueManager();

            // Pass env variables to new worker process and create it.
            cluster.fork(this._configuration.env);
            this._runningServicesCount++;
        } else {
            log.info(`FULL QUEUE: running-${this._runningServicesCount} limit-${this._configuration.workerLimit}`);
        }
    }

    async queueManager(): Promise<void> {
        const service = this._queue.pop();
        this._queue.unshift(service);
        this._configuration.env.SCRAPER = service;
    }

    configureEventHandlers(): void {
        /**
         * Event when you forked new worker.
         */
        cluster.on('fork', async (worker) => {
            await this.createWorker();
            log.process(`The worker #${worker.id} is being created. Process pid ${worker.process.pid}.`);
        });

        /**
         * Event when worker start his job.
         */
        cluster.on('online', (worker) => {
            log.process(`The worker #${worker.id} is starting job... Process pid ${worker.process.pid}.`);
        });

        /**
         * Event when you call worker.kill();
         */
        cluster.on('exit', async (worker, code, signal) => {
            if (code !== 0) {
                log.warning(`The worker #${worker.id} crashed with code ${code} and signal ${signal}. Starting a new worker...`);
            } else {
                log.process(`The worker #${worker.id} done his job. Process pid ${worker.process.pid}`);
            }

            this._runningServicesCount--;
            await this.createWorker();
        });
    }

    errorHandler(error): void {
        switch (typeof error) {
            case 'object': {
                for (const [key, value] of Object?.entries(error)) {
                    log.error(`${key}: ${value}`);
                }
                break;
            }
            case 'undefined': {
                log.error('Catch undefined error.');
                break;
            }
            default: {
                log.error(`Worker failed with reason: ${error.toString()}`);
            }
        }
    }

    setConfig(): void {
        try {
            const config = readYamlConfiguration(`cluster-config.yml`);
            this._queue = config['QUEUE'];
            this._configuration.args = config['ARGS'];
            this._configuration.env = config['ENV_VARIABLES'];
            this._configuration.silentMode = config['SILENT_MODE'];
            this._configuration.workerLimit = config['WORKER_LIMIT'];
        } catch (e) {
            log.error('Cannot load initial config.');
            process.exit(0);
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
