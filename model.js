const { Worker } = require("worker_threads");
const ws = require("ws");
const fs = require("fs");
const path = require("path");

class Model {
  constructor(
    name = "normal_neonate",
    port = 3000,
    rt_stepsize = 1.0,
    dc_sample = 0.015,
    dc_interval = 1.0
  ) {
    this.port = port;
    this.name = name;
    this.rt_stepsize = rt_stepsize;
    this.dc_sample = dc_sample;
    this.dc_interval = dc_interval;

    // start a websocket server for this model
    this.start_websocket_server();

    // spin up a worker thread
    this.worker = new Worker("./explain_core/model_engine.js");

    // define state variables
    this.initialized = false;
    this.running = false;
    this.data = {};
    this.socket = {};

    // setup a communication channel with the worker
    this.worker_comms();

    // initialize the worker
    this.init();
  }

  // API
  start_websocket_server() {
    // Set up a websocket server
    const wss = new ws.WebSocketServer({ port: this.port });

    wss.on("connection", (ws) => {
      // transfer a reference to the socket
      this.socket = ws;
      // signal that a connection has been established
      console.log(
        "API STATUS: websocket connection established on port: " + this.port
      );

      if (this.initialized) {
        this.socket.send("model ready");
      } else {
        this.socket.send("model error");
      }

      this.socket = ws;
      // handle an incoming message
      ws.on("message", (data) => {
        const mes = JSON.parse(data);
        switch (mes.command) {
          case "start":
            this.start(mes.payload);
            break;
          case "stop":
            this.stop();
            break;
          case "calculate":
            this.calculate(mes.payload);
            break;
          default:
            console.log("unknown command: " + mes.command);
        }
      });

      // handle a closing websocket
      ws.on("close", () => {
        // stop the realtime model
        this.stop();
        // signal that the websocket connection closed
        console.log(
          "API STATUS: websocket connection closed on port: " + this.port
        );
      });
    });
  }

  // WORKER INTERFACING
  start(payload) {
    this.worker.postMessage({
      command: "start",
      payload: payload,
    });
  }

  stop(payload) {
    this.worker.postMessage({
      command: "stop",
      payload: payload,
    });
  }

  calculate(payload) {
    this.worker.postMessage({
      command: "calculate",
      payload: payload,
    });
  }

  worker_comms() {
    // setup the communication with the worker
    this.worker.on("message", (mes) => {
      switch (mes.command) {
        case "status":
          // post initialization steps
          if (mes.payload == "model initialized") {
            // flag that the model is initialized
            this.initialized = true;
          }
          break;
        case "result":
          this.socket.send(JSON.stringify(mes.payload));
          break;
        default:
          console.log("MODEL: " + mes);
      }
    });
  }

  // loads the json model definition file and return a model definition file
  init() {
    // construct the filename
    let filename = "./" + this.name + ".json";

    // find the absolute path
    const abs_path = path.resolve(filename);

    // read the json file
    fs.readFile(abs_path, "utf8", (err, data) => {
      if (err) {
        // send status update to parent
        console.log("MODEL: error loading json definition file => " + err);
        return;
      }
      // send status update to parent
      this.worker.postMessage({
        command: "initialize",
        payload: JSON.parse(data),
      });
    });
  }
}

module.exports = Model;
