const { Worker } = require("worker_threads");
const fs = require("fs");
const path = require("path");

class Model {
    constructor(name="normal_neonate", rt_stepsize = 1.0, dc_sample = 0.015, dc_interval = 1.0) {
        this.name = name
        this.rt_stepsize = rt_stepsize
        this.dc_sample = dc_sample
        this.dc_interval = dc_interval

        // spin up a worker thread
        this.worker = new Worker("./explain_core/model_engine.js")

        // define state variables
        this.initialized = false
        this.running = false
        this.data = {}

        // open the communication channel
        this.coms()

        // initialize the model
        this.init()
    }

    set_rt_stepsize() {
      this.worker.postMessage({
        command: "set_rt_stepsize",
        payload: parseFloat(this.rt_stepsize)
      })
    }

    set_dc_sample() {
      this.worker.postMessage({
        command: "set_dc_sample",
        payload: parseFloat(this.dc_sample)
      })

    }

    set_dc_interval() {
      this.worker.postMessage({
        command: "set_dc_update",
        payload: parseFloat(this.dc_interval)
      })

    }
    start() {
      this.worker.postMessage({
        command: "start",
        payload: ""
      })
    }

    stop() {
      this.worker.postMessage({
        command: "stop",
        payload: ""
      })
    }

    calculate(time_to_calculate) {
      this.worker.postMessage({
        command: "calculate",
        payload: parseFloat(time_to_calculate)
      })
    }

    coms () {
      // setup the communication with the worker
      this.worker.on("message", (mes) => {
        switch (mes.command) {
          case "status":
            if (mes.payload == "model initialized") {
              console.log("model initialized")
              // set the rt_stepsize
              this.set_rt_stepsize()
              // set the dc_sample
              this.set_dc_sample()
              // set the dc_interval
              this.set_dc_interval()
              // flag that the model is initialized
              this.initialized = true
            }
            break;
          default:
            console.log(mes)
        }
      })
    }

    // loads the json model definition file and return a model definition file
    init () {
      // construct the filename 
      let filename = "./" + this.name + ".json"

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
          this.worker.postMessage({
            command: "initialize",
            payload: JSON.parse(data)
          });
      });
  }
}

module.exports = Model