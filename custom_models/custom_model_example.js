class CustomModelExample {
  constructor(_model) {
    this.model = _model;
    this.initialized = false;
  }
  init() {
    this.initialized = true;
  }
  model_step() {}
}

module.exports = CustomModelExample;
