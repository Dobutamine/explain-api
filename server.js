// include the worker module for CPU intensive tasks as running the model
const { Worker } = require("worker_threads");
const Model = require("./model")

const ws = require("ws");

// define a websocket
let socket;

// initialize a new model
const new_model = new Model()

// Set up a websocket server
const wss = new ws.WebSocketServer({ port: 3000 });

wss.on("connection", function connection(ws) {
  // make the socket available outside this function
  socket = ws;

  // signal that a connection has been established
  console.log("API STATUS: websocket connection established.");
  socket.send("connected")

  // handle an incoming message
  socket.on("message", function message(data) {
    const mes = JSON.parse(data)
    switch (mes.command) {
      case "start":
        new_model.start()
        break;
      case "stop":
        new_model.stop()
        break;
      case "calculate":
        new_model.calculate(parseFloat(mes.payload))
        break;
      default:
        console.log("unknown command: " + mes.command)
    }
    // signal that the message has been received
    socket.send("ok");
  });

  // handle a closing websocket
  socket.on("close", function close() {
    // stop the realtime model
    new_model.stop()
    // signal that the websocket connection closed
    console.log("API STATUS: websocket connection closed.");
  });
});
