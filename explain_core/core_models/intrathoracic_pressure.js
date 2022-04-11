class IntrathoracicPressure {
  constructor(_model) {
    // store a reference to the rest of the model
    this.model = _model;

    // initialize a dictionary holding the targets
    this.targets = {};

    // define the dependent properties
    this.pres = 0;

    // get the modeling stepsize from the model
    this.t = this.model.modeling_stepsize;

    this.initialized = false;
  }

  init() {
    this.initialized = true;
  }

  model_step() {
    if (this.is_enabled) {
      this.calculate();
    }
  }

  calculate() {
    // calculate the intrathoracic pressure
    let cum_pres = 0;
    let counter = 0;

    this.sources.forEach((source) => {
      cum_pres += this.model.components[source].pres;
      counter += 1;
    });

    this.pres = cum_pres / counter;

    // apply the mean intrathoracic pressure to the targets
    for (let [target, value] of Object.entries(this.targets)) {
      this.model.components[target].pres_itp = value * this.pres;
    }
  }
}

module.exports = IntrathoracicPressure;
