class BloodCompliance {
  constructor(_model) {
    // get a reference to the model to access other model components
    this.model = _model;
    this.initialized = false;

    // properties
    this.name = ""; // name of the compliance
    this.model_type = "BloodCompliance"; // type of the model component
    this.content = ""; // content of the component (blood/gas/lymph)
    this.is_enabled = true; // determines whether or not the compliance is enabled
    this.vol = 0; // holds the volume in liters
    this.u_vol = 0; // holds the unstressed volume in liters
    this.u_vol_fac = 1.0; // holds the unstressed volume factor in liters
    this.p_atm = 750.0; // holds the atmospheric pressure
    this.pres = 0; // holds the net pressure in mmHg
    this.pres_rel = 0; // holds the net pressure in mmHg
    this.recoil_pressure = 0; // holds the recoil pressure in mmHg
    this.pres_outside = 0; // holds the pressure which is exerted on the compliance from the outside
    this.pres_itp = 0; // holds the intrathoracic pressure
    this.pres_transmural = 0;
    this.el_base = 1.0; // holds the baseline elastance
    this.el_base_fac = 1.0; // holds the baseline elastance multiplier
    this.el_k = 0; // holds the constant for the non-linear elastance function
    this.el_k_fac = 1.0; // holds the non-linear elastance function factor multiplier

    // systolic and diastolic pressures
    this.systole = 0;
    this.diastole = 0;
    this.min_pres_temp = 0;
    this.max_pres_temp = 0;

    // systole and diastole window
    this.analysis_window = 1;
    this.analysis_counter = 0;
  }

  init() {
    this.initialized = true;
  }

  // this method is called by the model e§ngine in every model step
  model_step() {
    // during every model step the transmural pressure is calculates
    if (this.is_enabled) {
      this.calculate_pressure();
    }
  }

  calculate_pressure() {
    // calculate the volume above the unstressed volume
    let vol_above_unstressed = this.vol - this.u_vol * this.u_vol_fac;

    // calculate the elastance, which is volume dependent in a non-linear way
    let elastance =
      this.el_base * this.el_base_fac +
      this.el_k * this.el_k_fac * Math.pow(vol_above_unstressed, 2);

    // if the volume is below the unstressed volume the compliance will collapse
    if (vol_above_unstressed < 0) {
      vol_above_unstressed = 0;
      this.vol = this.u_vol;
    }

    // calculate the recoil pressure in the compliance due to the elastacity of the compliance
    this.recoil_pressure = vol_above_unstressed * elastance;

    // calculate the pressure which refers to the pressure inside relative to the outside of a compartment.
    this.pres =
      this.recoil_pressure + this.pres_outside + this.pres_itp + this.p_atm;

    this.pres_transmural =
      this.recoil_pressure + this.pres_outside - this.pres_itp + this.p_atm;

    // reset the outside pressure as it needs to be set every model cycle
    this.pres_outside = 0;

    // reset the intrathoracic pressure as it needs to be set every model cycle
    this.pres_itp = 0;

    // determine min and max pressures
    if (this.pres > this.max_pres_temp) {
      this.max_pres_temp = this.pres;
    }

    if (this.pres < this.min_pres_temp) {
      this.min_pres_temp = this.pres;
    }

    if (this.analysis_counter > this.analysis_window) {
      this.systole = this.max_pres_temp;
      this.max_pres_temp = -1000;
      this.diastole = this.min_pres_temp;
      this.min_pres_temp = 1000;
      this.analysis_counter = 0;
    }

    this.analysis_counter += this.model.modeling_stepsize;

    // console.log(this.name + ": " + this.pres);
  }

  volume_in(dvol, comp_from) {
    // this method is called when volume is added to this components
    if (this.is_enabled) {
      // add volume
      this.vol += dvol;
    }

    // check whether this compliance has a mix attribute.
    if (this.vol > 0) {
      // calculate the change in o2 concentration
      let d_o2 = (comp_from.to2 - this.to2) * dvol;
      this.to2 = (this.to2 * this.vol + d_o2) / this.vol;

      // calculate the change in co2 concentration
      let d_co2 = (comp_from.tco2 - this.tco2) * dvol;
      this.tco2 = (this.tco2 * this.vol + d_co2) / this.vol;
    }

    // guard against negative volumes (will probably never occur in this routine)
    return this.protect_mass_balance;
  }

  volume_out(dvol, comp_from) {
    // this method is called when volume is removed from this components
    if (this.is_enabled) {
      // add volume
      this.vol -= dvol;
    }

    // guard against negative volumes (will probably never occur in this routine)
    return this.protect_mass_balance;
  }

  protect_mass_balance() {
    if (this.vol < 0) {
      // if there's a negative volume it might corrupt the mass balance of the model so we have to return the amount of volume which could not be displaced to the caller of this function
      let _nondisplaced_volume = -this.vol;
      // set the current volume to zero
      this.vol = 0;
      // return the amount volume which could not be removed
      return _nondisplaced_volume;
    } else {
      // massbalance is guaranteed
      return 0;
    }
  }
}

module.exports = BloodCompliance;
