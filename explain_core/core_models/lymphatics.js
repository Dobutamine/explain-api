class Lymphatics {
  constructor(_model) {
    // get a reference to the model
    this.model = _model;

    // set as non initialized when constructed
    this.initialized = false;
  }
  init() {
    this.initialized = true;
  }
  model_step() {
    if (this.is_enabled) {
      this.ventilate();
    }
  }

  ventilate() {}
}

module.exports = Lymphatics;
