import WorkerCreator from "../src/main";

const clusters = new WorkerCreator(
  async () => {
    console.log("I'm working.");
  },
  { workerLimit: 1, env: { Testing: "yeah-worked" } }
);

clusters.start();
