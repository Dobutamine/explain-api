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

  spont_breathing(state) {
    console.log(state);
    if (state) {
      // switch on spontaneous breathing
      console.log("MODEL-ENGINE: spontaneous breathing is enabled.");
      this.model.components.breathing.spont_breathing_enabled = true;
    } else {
      // switch off spontaneous breathing
      console.log("MODEL-ENGINE: spontaneous breathing is disabled.");
      this.model.components.breathing.spont_breathing_enabled = false;
    }
  }
}

module.exports = Interface;
