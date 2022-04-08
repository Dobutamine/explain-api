// import the required node modules
const { parentPort } = require("worker_threads");

// import the core model modules
const Ans = require("./core_models/ans");
const Blood = require("./core_models/blood");
const BloodCompliance = require("./core_models/blood_compliance");
const BloodResistor = require("./core_models/blood_resistor");
const Breathing = require("./core_models/breathing");
const Container = require("./core_models/container");
const Ecg = require("./core_models/ecg");
const Gas = require("./core_models/gas");
const GasCompliance = require("./core_models/gas_compliance");
const Gasexchanger = require("./core_models/gas_exchanger");
const GasResistor = require("./core_models/gas_resistor");
const Heart = require("./core_models/heart");
const IntrathoracicPressure = require("./core_models/intrathoracic_pressure");
const Metabolism = require("./core_models/metabolism");
const TimeVaryingElastance = require("./core_models/time_varying_elastance");
const Valve = require("./core_models/valve");

// import the custom models
const Ecmo = require("../custom_models/ecmo");
const MechanicalVentilator = require("../custom_models/mechanical_ventilator");
const Pda = require("../custom_models/pda");
const CustomModelExample = require("../custom_models/custom_model_example");

// import the helper modules
const DataCollector = require("./helpers/data_collector");
const Interface = require("./helpers/interface");

// declare the realtime timer and stepsizes
let realtime_timer
let realtime_stepsize = 0.03
let realtime_no_steps = 60


// communication channel with parent
parentPort.on("message", (mes) => {
  process_incoming_data(mes);
});

// process incoming data from the parent
function process_incoming_data(mes) {
  switch (mes.command) {
    case "initialize":
      initialize(mes.payload);
      break;
    case "calculate":
      calculate(mes.payload);
      break;
    case "data":
      //send_data(current_model.components.datacollector.get_data());
      break;
    case "start":
      start();
      break;
    case "stop":
      stop();
      break;
    case "dispose":
      dispose();
      break;
    case "set_rt_stepsize":
      realtime_stepsize = mes.payload
      console.log("rt stepsize changed to: "+ mes.payload)
      break;
    case "set_dc_sample":
      current_model.components.datacollector.set_sample_interval(mes.payload)
      break;
    case "set_dc_update":
      current_model.components.datacollector.set_update_interval(mes.payload)
      break;
    default:
      send_status_message("unknown command");
  }
}

function send_status_message(mes) {
  parentPort.postMessage({ command: "status", payload: mes });
}

function send_data(data) {
  parentPort.postMessage({ command: "data", payload: data });
}

function send_data_ready() {
  parentPort.postMessage({ command: "data_ready", payload: "" });
}

// define an object holding the current model state
let current_model = {};

// initialize the model as described in the model definition file
function initialize(model_definition) {
  // set the general properties as weight and name from the definition file
  current_model["weight"] = model_definition["weight"];
  current_model["name"] = model_definition["name"];
  current_model["description"] = model_definition["description"];

  // set the modeling stepsize of the model in seconds
  current_model["modeling_stepsize"] = model_definition["modeling_stepsize"];

  // set the model total running time and timestamp arrays to timestamp the data
  current_model["model_time_total"] = 0;

  // define the dictionary holding all model components in the current model instance
  current_model["components"] = {};

  for (const key in model_definition["components"]) {
    // find the model type
    let comp_type = eval(model_definition["components"][key]["model_type"]);

    // define a new component object
    let newComponent = {};

    // try to instantiate a model object from the model type
    try {
      // instantiate the model type
      newComponent = new comp_type(current_model);

      // add the properties
      Object.keys(model_definition["components"][key]).forEach(function (prop) {
        newComponent[prop] = model_definition["components"][key][prop];
      });

      // initialize the model
      newComponent.init();

      // add the model to the current model components dictionary
      current_model["components"][key] = newComponent;
    } catch {
      send_status_message("error initializing model.");
    }
  }
  // initialize the datacollector and the model interface
  current_model["components"]["datacollector"] = new DataCollector(
    current_model
  );
  current_model["components"]["datacollector"].init();

  // send status update to parent
  send_status_message("model initialized");
}

// calculate a number of seconds of the model
function calculate(time_to_calculate) {
  // performance parameters
  let total_time = 0;

  // calculate the number of steps needed for the time_to_calculate
  const no_needed_steps = parseInt(
    time_to_calculate / current_model.modeling_stepsize
  );

  // clear the datalogger
  current_model.components.datacollector.clear_data();

  // set the datalogger resolution to 15 ms
  current_model.components.datacollector.set_sample_interval(0.015);

  // set the datalogger update interval to 1 s
  current_model.components.datacollector.set_update_interval(1.0);

  send_status_message("calculating model");
  for (let i = 0; i < no_needed_steps; i++) {
    const step_time = model_step();
    total_time += step_time;
  }

  // send status report to the parent
  send_status_message("model run finished in: " + total_time + " sec.");
  send_status_message(
    "average model step in: " + (total_time / no_needed_steps) * 1000.0 + " ms."
  );
}

function model_step() {
  // model performance calculation start point
  const t0 = performance.now();

  // iterate over all components
  for (const model in current_model["components"]) {
    current_model["components"][model].model_step();
    // update the model clock
    current_model.model_time_total += current_model.modeling_stepsize;
  }

  // check if datacollector has data ready
  if (current_model.components.datacollector.data_ready) {
    // signal the parent that there's data available
    send_data_ready();

    // reset the datacollector ready flag
    current_model.components.datacollector.data_ready = false;
  }

  // return the modelstep performance
  return (performance.now() - t0) / 1000;
}

function realtime_step() {
  for (let i=0; i < realtime_no_steps; i ++) {
    const step_time = model_step();
  }
}

// start the model in realtime
function start() {
  send_status_message("starting realtime model");
  if (realtime_timer) {
    clearInterval(realtime_timer)
    clearTimeout(realtime_timer)
  }

  realtime_no_steps = realtime_stepsize / current_model.modeling_stepsize
  realtime_timer = setInterval(realtime_step, realtime_stepsize * 1000.0)

  send_status_message("realtime model started")
}

// stop the model in realtime
function stop() {
  send_status_message("stopping realtime model");
  if (realtime_timer) {
    clearInterval(realtime_timer)
    clearTimeout(realtime_timer)
  }
}

// destroy the model
function dispose() {
  send_status_message("disposing model");
}
