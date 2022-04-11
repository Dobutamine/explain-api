class GasCompliance {
  constructor(_model) {
    // get a reference to the model
    this.model = _model;

    // properties
    this.name = ""; // name of the compliance
    this.model_type = "GasCompliance"; // type of the model component
    this.content = "gas"; // content of the component (blood/gas/lymph)
    this.is_enabled = true; // determines whether or not the compliance is enabled
    this.vol = 0; // holds the volume in liters
    this.u_vol = 0; // holds the unstressed volume in liters
    this.u_vol_fac = 1.0; // holds the unstressed volume in liters multiplier
    this.pres = 0; // holds the net pressure in mmHg
    this.recoil_pressure = 0; // holds the recoil pressure in mmHg
    this.pres_outside = 0; // holds the pressure which is exerted on the compliance from the outside
    this.pres_transmural = 0; // holds the transmural pressure off the compliance
    this.pres_rel = 0;
    this.itp = 0; // holds the intrathoracic pressure
    this.p_atm = 0;
    this.el_base = 1.0; // holds the baseline elastance
    this.el_base_fac = 1.0; // holds the baseline elastance multiplier
    this.el_k = 0; // holds the constant for the non-linear elastance function
    this.el_k_fac = 1.0; // holds the constant for the non-linear elastance function multiplier

    this.initialized = false;
  }
  init() {
    this.initialized = true;
  }
  model_step() {
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

    // calculate the recoil pressure in the compliance due to the elastacity of the compliance
    this.recoil_pressure = vol_above_unstressed * elastance;

    // calculate the net pressure which refers to the pressure inside relative to the outside of a compartment.
    this.pres = this.recoil_pressure + this.pres_outside + this.p_atm;

    this.pres_rel = this.pres - this.p_atm;

    // calculate the transmural pressure which refers to the difference between the recoil pressure and the pressure outside the compliance
    this.pres_transmural =
      this.recoil_pressure - this.pres_outside + this.p_atm;

    // reset the outside pressure as it needs to be set every model cycle
    this.pres_outside = 0;

    // we now have the new pressure and volume, let's calculate the gas composition
    // calculate the concentration of molecules in the gas object at the current pressure, volume and temperature using the gas law
    this.c_total =
      (this.pres / (this.gas_constant * (273.15 + this.temp))) * 1000;

    // calculate the ph2o depending on the temperature
    this.ph2o = this.calculate_water_vapour_pressure(this.temp);

    // calculate the fh2o depending on the pressure
    this.fh2o = this.ph2o / this.pres;

    // calculate the wet fractions from the fh2o and the dry fractions
    this.fo2 = this.fo2_dry * (1 - this.fh2o);
    this.fco2 = this.fco2_dry * (1 - this.fh2o);
    this.fn2 = this.fn2_dry * (1 - this.fh2o);
    this.fargon = this.fargon_dry * (1 - this.fh2o);

    // calculate the partial pressures
    this.po2 = this.fo2 * (1 - this.fh2o) * this.pres;
    this.pco2 = this.fco2 * (1 - this.fh2o) * this.pres;
    this.pn2 = this.fn2 * (1 - this.fh2o) * this.pres;
    this.pargon = this.fargon * (1 - this.fh2o) * this.pres;

    // calculate the concentrations
    this.co2 = this.fo2 * (1 - this.fh2o) * this.c_total;
    this.cco2 = this.fco2 * (1 - this.fh2o) * this.c_total;
    this.cn2 = this.fn2 * (1 - this.fh2o) * this.c_total;
    this.cargon = this.fargon * (1 - this.fh2o) * this.c_total;
  }

  volume_in(dvol, comp_from) {
    // this method is called when volume is added to this components
    if (this.is_enabled && !this.fixed_composition) {
      // add volume
      this.vol += dvol;
    }

    if (this.vol > 0 && !this.fixed_composition) {
      let dfo2_dry = (comp_from.fo2_dry - this.fo2_dry) * dvol;
      this.fo2_dry = (this.fo2_dry * this.vol + dfo2_dry) / this.vol;

      let dfco2_dry = (comp_from.fco2_dry - this.fco2_dry) * dvol;
      this.fco2_dry = (this.fco2_dry * this.vol + dfco2_dry) / this.vol;

      let dfn2_dry = (comp_from.fn2_dry - this.fn2_dry) * dvol;
      this.fn2_dry = (this.fn2_dry * this.vol + dfn2_dry) / this.vol;

      let dfargon_dry = (comp_from.fargon_dry - this.fargon_dry) * dvol;
      this.fargon_dry = (this.fargon_dry * this.vol + dfargon_dry) / this.vol;
    }

    // guard against negative volumes (will probably never occur in this routine)
    return this.protect_mass_balance;
  }

  volume_out(dvol, comp_from) {
    // this method is called when volume is removed from this components
    if (this.is_enabled && !this.fixed_composition) {
      // add volume
      this.vol -= dvol;
    }

    // guard against negative volumes (will probably never occur in this routine)
    return this.protect_mass_balance;
  }

  exchange_gas(flux_o2, flux_co2) {
    // flux unit is in mmol so have to find a way to substract or add this to the gas and then we have to calculate back to the fo2_dry!

    // calculate the wet fo2
    this.fo2 = this.fo2_dry * (1 - this.fh2o);
    this.fco2 = this.fco2_dry * (1 - this.fh2o);

    // convert the wet fo2 to mmol O2, add the flux O2 and convert back to fo2
    let new_fo2 =
      (this.fo2 * this.c_total * this.vol + flux_o2) / this.vol / this.c_total;
    let new_fco2 =
      (this.fco2 * this.c_total * this.vol + flux_co2) /
      this.vol /
      this.c_total;

    // calculate back to the dry fo2
    this.fo2_dry = new_fo2 / (1 - this.fh2o);
    this.fco2_dry = new_fco2 / (1 - this.fh2o);
  }

  calculate_water_vapour_pressure(temp) {
    // calculate the water vapour pressure in air depending on the temperature
    return Math.pow(Math.E, 20.386 - 5132 / (temp + 273));
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

module.exports = GasCompliance;
