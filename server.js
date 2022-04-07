// include the worker module for CPU intensive tasks as running the model
const { Worker } = require("worker_threads");
const fs = require("fs");
const path = require("path");
const ws = require("ws");
const { SocketAddress } = require("net");

let socket = {};

// spin up a new worker module running a explain model
const new_worker = new Worker("./explain_core/model_engine.js");

// attach the event handler to catch messages coming from the model
new_worker.on("message", (mes) => {
  switch (mes.command) {
    case "status":
      console.log("MODEL STATUS: " + mes.payload);
      break;
    case "data_ready":
      // send the data over the websocket to the client
      break;
    default:
      console.log(mes);
  }
});

// loads the json model definition file and return a model definition file
function load_model(filename = "./normal_neonate.json") {
  // find the absolute path
  const abs_path = path.resolve(filename);

  // read the json file
  fs.readFile(abs_path, "utf8", (err, data) => {
    if (err) {
      // send status update to parent
      console.log("error loading json definition file: " + err);
      return;
    }
    // send status update to parent
    model_definition = JSON.parse(data);

    // post a message to the model
    new_worker.postMessage({
      command: "initialize",
      payload: model_definition,
    });
  });
}

load_model();

// Set up a websocket server
const wss = new ws.WebSocketServer({ port: 3000 });

wss.on("connection", function connection(ws) {
  socket = ws;

  console.log("API STATUS: websocket connection established.");

  socket.on("message", function message(data) {
    new_worker.postMessage(JSON.parse(data));
    socket.send("Ok");
  });

  socket.on("close", function close() {
    console.log("API STATUS: websocket connection closed.");
  });
});
