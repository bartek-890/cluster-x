import WorkerCreator from "../src/main";

const clusters = new WorkerCreator(
    async () => {},
    async () => {
        console.log("I'm working.");
    }
)

clusters.start();