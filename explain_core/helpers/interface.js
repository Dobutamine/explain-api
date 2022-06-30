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

  ventilation(params) {
    if (params.enable) {
      // switch off spontaneous breathing
      console.log("MODEL-ENGINE: spontaneous breathing is disabled.");
      this.model.components.breathing.spont_breathing_enabled = false;
      // switch on the mechanical ventilator
      console.log("MODEL-ENGINE: positive pressure ventilation is enabled.");
      console.log(this.model.components.mechanical_ventilator);
      console.log(params.pip);
      console.log(params.peep);
      console.log(params.freq);
      console.log(params.t_in);
    } else {
      // switch off the mechanical ventilator
      console.log("MODEL-ENGINE: positive pressure ventilation is disabled.");
    }
  }

  spont_breathing(setting) {
    if (setting) {
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
