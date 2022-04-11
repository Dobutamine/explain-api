class Gasexchanger {
  constructor(_model) {
    this.model = _model;

    this.flux_o2 = 0;
    this.flux_co2 = 0;

    this.initialized = false;

    this.update_interval = 0.015;
    this.update_counter = 0;
    this.modeling_stepsize = 0.0005;

    this.dif_o2_fac = 1.0;
    this.dif_co2_fac = 1.0;
  }
  init() {
    this.comp_blood = this.model.components[this.comp_blood];
    this.comp_gas = this.model.components[this.comp_gas];
    // activate the oxygenation and acidbase capabilities of the compartments
    this.comp_blood.oxy_enabled = true;
    this.comp_blood.acidbase_enabled = true;

    this.modeling_interval = this.model.modeling_stepsize;
    this.initialized = True;
  }
  model_step() {
    if (this.is_enabled) {
      this.exchange_gas();
    }
  }
  exchange_gas() {
    // calculate the o2 and co2 flux
    this.flux_o2 =
      (this.comp_blood.po2 - this.comp_gas.po2) *
      (this.dif_o2 * this.dif_o2_fac) *
      this.modeling_interval;
    this.flux_co2 =
      (this.comp_blood.pco2 - this.comp_gas.pco2) *
      (this.dif_co2 * this.dif_co2_fac) *
      this.modeling_interval;

    // change the oxygen content of the blood_compartment
    let new_to2 =
      (this.comp_blood.to2 * this.comp_blood.vol - this.flux_o2) /
      this.comp_blood.vol;
    if (new_to2 < 0) {
      new_to2 = 0;
    }
    this.comp_blood.to2 = new_to2;

    let new_tco2 =
      (this.comp_blood.tco2 * this.comp_blood.vol - this.flux_co2) /
      this.comp_blood.vol;
    if (new_tco2 < 0) {
      new_tco2 = 0;
    }
    this.comp_blood.tco2 = new_tco2;

    // change the oxygen and co2 content of the gas_compartment
    this.comp_gas.exchange_gas(this.flux_o2, this.flux_co2);
  }
}

module.exports = Gasexchanger;
