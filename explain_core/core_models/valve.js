class Valve {
  constructor(_model) {
    this.model = _model;
    this.initialized = false;

    // properties
    this.name = ""; // name of the resistor
    this.model_type = "Valve"; // type of the model component

    this.is_enabled = true; // determines whether or not the resistor is enabled
    this.no_flow = false; // determines whether the resistor allows any flow
    this.no_backflow = false; // determines whether the resistor allows backflow
    this.comp_from = ""; // holds the name of the first compliance wich the resistor connects
    this.comp_to = ""; // holds the name of the second compliance which the resistor connects
    this.r_for = 1.0; // holds the resistance if the flow direction is from comp_from to comp_to
    this.r_for_fac = 1.0; // holds the factor with which r_for is multiplied
    this.r_back = 1.0; // holds the resistance if the flow direction is from comp_to to comp_from
    this.r_back_fac = 1.0; // holds the factor with which r_for is multiplied
    this.r_k = 0; // holds the constant for the non-linear flow dependency of the resistance
    this.r_k_fac = 1.0; // holds factor for the constant for the non-linear flow dependency of the resistance

    this.flow = 0;
    this.comp_from_found = false;
    this.comp_to_found = false;

    // get the modeling stepsize from the model
    this.t = this.model.modeling_stepsize;

    // initialize the dependent properties
    this.flow = 0;
    this.resistance = 0;
  }

  init() {
    // store a reference to the compliances which this resistor 'connects'
    if (this.comp_from in this.model["components"]) {
      this.comp1 = this.model.components[this.comp_from];
      this.comp_from_found = true;
    }

    if (this.comp_to in this.model.components) {
      this.comp2 = this.model.components[this.comp_to];
      this.comp_to_found = true;
    }

    if (this.comp_from_found == false) {
      console.log(
        "Valve" +
          this.name +
          "could not find compliance/time_varying_elastance" +
          this.comp_from
      );
      return;
    }

    if (this.comp_to_found == false) {
      console.log(
        "Valve" +
          this.name +
          "could not find compliance/time_varying_elastance" +
          this.comp_to
      );
      return;
    }
    this.initialized = true;
  }

  model_step() {
    this.calculate_flow();
  }

  calculate_resistance(p1, p2) {
    // calculate the flow dependent parts of the resistance
    let nonlin_fac = this.r_k * this.r_k_fac * Math.abs(this.flow);

    if (p1 > p2) {
      return this.r_for * this.r_for_fac + nonlin_fac;
    } else {
      return this.r_back * this.r_back_fac + nonlin_fac;
    }
  }

  calculate_flow() {
    if (this.is_enabled) {
      // get the pressures from comp1 and comp2
      let p1 = this.comp1.pres;
      let p2 = this.comp2.pres;

      // calculate the resistance
      this.resistance = this.calculate_resistance(p1, p2);

      // first check whether the no_flow flag is checked
      if (this.no_flow) {
        this.flow = 0;
      } else {
        this.flow = (p1 - p2) / this.resistance;
        // check whether backflow is allowed across this resistor
        if (this.flow < 0 && this.no_backflow) {
          this.flow = 0;
        }
      }

      // now we have the flow in l/sec and we have to convert it to l by multiplying it by the modeling_stepsize
      let dvol = this.flow * this.t;

      // change the volumes of the compliances
      if (dvol > 0) {
        // positive value means comp1 loses volume and comp2 gains volume
        this.comp1.volume_out(dvol, this.comp2);
        this.comp2.volume_in(dvol, this.comp1);
      } else {
        // negative value means comp1 gains volume and comp2 loses volume
        this.comp1.volume_in(-dvol, this.comp2);
        this.comp2.volume_out(-dvol, this.comp1);
      }
    } else {
      this.flow = 0;
    }
  }
}

module.exports = Valve;
