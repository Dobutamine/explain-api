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
const Ecls = require("./core_models/ecls");
const Compressions = require("./core_models/compressions");
const Environment = require("./core_models/environment");
const Kidneys = require("./core_models/kidneys");
const Lymphatics = require("./core_models/lymphatics");
const Birth = require("./core_models/birth");
const Drugs = require("./core_models/drugs");
const MechanicalVentilator = require("./core_models/mechanical_ventilator");
const Pda = require("./core_models/pda");
const CustomModelExample = require("../custom_models/custom_model_example");

// import the helper modules
const DataCollector = require("./helpers/data_collector");
const Interface = require("./helpers/interface");

// declare the realtime timer and stepsizes
let realtime_timer;
let realtime_stepsize = 0.015;
let realtime_no_steps = 60;

// define an object holding the current model state
let current_model = {};

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
    case "start":
      start(mes.payload);
      break;
    case "stop":
      stop();
      break;
    case "update":
      update_model(mes.payload);
      break;
    default:
      break;
  }
}

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
    } catch (err) {
      console.log("MODEL-ENGINE: model failed to initialize. Error: " + err);

      // let the parent know something went wrong
      parentPort.postMessage({ command: "status", payload: "model error" });
    }
  }
  // initialize the datacollector
  current_model["components"]["datacollector"] = new DataCollector(
    current_model
  );
  current_model["components"]["datacollector"].init();

  // initialize the model interface
  current_model["components"]["interface"] = new Interface(current_model);
  current_model["components"]["interface"].init();

  // let the parent know that everything went well
  parentPort.postMessage({ command: "status", payload: "model initialized" });
}

// calculate a number of seconds of the model
function calculate(params) {
  // get the parameters
  const dc_sample_interval = parseFloat(params.data_sample_interval);
  const time_to_calculate = parseFloat(
    params.time_to_calculate + dc_sample_interval
  );
  current_model.components.datacollector.set_sample_interval(
    dc_sample_interval
  );
  current_model.components.datacollector.set_update_interval(
    time_to_calculate - dc_sample_interval
  );

  // performance parameters
  let total_time = 0;

  // calculate the number of steps needed for the time_to_calculate
  const no_needed_steps = parseInt(
    time_to_calculate / current_model.modeling_stepsize
  );

  // clear the datalogger
  current_model.components.datacollector.clear_data();

  for (let i = 0; i < no_needed_steps; i++) {
    const step_time = model_step();
    total_time += step_time;
  }

  // send the data to the parent
  parentPort.postMessage({
    command: "result",
    payload: current_model.components.datacollector.data,
  });

  // send status report to the parent
  console.log(
    "MODEL-ENGINE: calculated model run finished in: " + total_time + " sec."
  );
  console.log(
    "MODEL-ENGINE: average model step in: " +
      (total_time / no_needed_steps) * 1000.0 +
      " ms."
  );
}

function model_step() {
  // model performance calculation start point
  const t0 = performance.now();

  // iterate over all components
  for (const model in current_model["components"]) {
    current_model["components"][model].model_step();
  }

  // update the model clock
  current_model.model_time_total += current_model.modeling_stepsize;

  // return the modelstep performance
  return (performance.now() - t0) / 1000;
}

function model_step_rt() {
  // iterate over all components
  for (const model in current_model["components"]) {
    current_model["components"][model].model_step();
  }
  // update the model clock
  current_model.model_time_total += current_model.modeling_stepsize;

  // check if datacollector has data ready
  if (current_model.components.datacollector.data_ready) {
    // reset the datacollector ready flag
    current_model.components.datacollector.data_ready = false;

    // send the data to the parent
    parentPort.postMessage({
      command: "result",
      payload: current_model.components.datacollector.data,
    });
  }
}

function realtime_step() {
  for (let i = 0; i < realtime_no_steps; i++) {
    model_step_rt();
  }
}
// update model
function update_model(params) {
  switch (params.target) {
    case "spont_breathing":
      current_model["components"]["interface"].spont_breathing(params.settings);
      break;
    case "ventilation":
      current_model["components"]["interface"].ventilation(params.settings);
      break;
    case "heart_function":
      break;
    case "heart_condition":
      break;
    case "svr":
      break;
    case "pvr":
      break;
    case "pda_size":
      break;
    case "vsd_size":
      break;
    case "heart_rhythm":
      break;
    case "fio2":
      break;
    case "temperature":
      break;
    case "chest_compressions":
      break;
    case "drug_infusion":
      break;
    case "lung_compliance":
      break;
    case "lung_shunt":
      break;
    case "upper_airway_resistance":
      break;
    case "lower_airway_resistance":
      break;
    case "pneumothorax":
      break;
    default:
      break;
  }
}

// start the model in realtime
function start(params) {
  params.vitals.forEach((vital) => {
    current_model.components.datacollector.add_to_watchlist_raw(vital);
  });

  // get the parameters
  realtime_stepsize = parseFloat(params.realtime_stepsize);
  current_model.components.datacollector.set_sample_interval(
    parseFloat(params.data_sample_interval)
  );
  current_model.components.datacollector.set_update_interval(
    parseFloat(params.data_update_interval)
  );

  if (realtime_timer) {
    clearInterval(realtime_timer);
    clearTimeout(realtime_timer);
  }

  // clear the datalogger
  current_model.components.datacollector.clear_data();

  // calculate the number of model steps per realtime step
  realtime_no_steps = realtime_stepsize / current_model.modeling_stepsize;

  // start the timer
  realtime_timer = setInterval(realtime_step, realtime_stepsize * 1000.0);
  // display message
  console.log("MODEL-ENGINE: realtime model started.");
}

// stop the model in realtime
function stop() {
  if (realtime_timer) {
    clearInterval(realtime_timer);
    clearTimeout(realtime_timer);
  }
  console.log("MODEL-ENGINE: realtime model stopped.");
}
