// include the worker module for CPU intensive tasks as running the model
const Model = require("./model");

// initialize a new model
const new_model = new Model("normal_neonate", (port = 3000));
