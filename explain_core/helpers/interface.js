class Interface {
  constructor(_model) {
    // store a reference to the model instance
    this.model = _model;
    this.initialized = false;
  }

  init() {
    this.initialized = true;
  }

  model_step() {}
}

module.exports = Interface;
