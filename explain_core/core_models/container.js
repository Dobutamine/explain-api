class Container {
  constructor(_model) {
    // get a reference to the model
    this.model = _model;

    // properties
    this.name = ""; // name of the compliance
    this.model_type = "Container"; // type of the model component
    this.content = ""; // content of the component (blood/gas/lymph)
    this.is_enabled = true; // determines whether or not the compliance is enabled
    this.vol = 0; // holds the volume in liters
    this.u_vol = 0; // holds the unstressed volume in liters
    this.u_vol_fac = 1.0; // holds the unstressed volume in liters
    this.pres = 0; // holds the transmural pressure in mmHg
    this.itp = 0;
    this.recoil_pressure = 0; // holds the recoil pressure in mmHg
    this.pres_outside = 0; // holds the pressure which is exerted on the compliance from the outside
    this.p_atm = 0;
    this.el_base = 1.0; // holds the baseline elastance
    this.el_base_fac = 1.0; // holds the baseline elastance
    this.el_k = 0; // holds the constant for the non-linear elastance function
    this.el_k_fac = 1.0; // holds the constant for the non-linear elastance function
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
    // first calculate the volume of the container
    this.vol = this.calculate_volume();

    // calculate the volume above the unstressed volume
    let vol_above_unstressed = this.vol - this.u_vol * this.u_vol_fac;

    // calculate the elastance, which is volume dependent in a non-linear way
    let elastance =
      this.el_base * this.el_base_fac +
      this.el_k * this.el_k_fac * Math.pow(vol_above_unstressed, 2);

    // calculate pressure in the compliance
    this.recoil_pressure = vol_above_unstressed * elastance;

    // calculate the transmural pressure
    this.pres =
      this.recoil_pressure + this.pres_outside + this.p_atm + this.itp;

    // reset the pressure outside
    this.pres_outside = 0;

    // reset the intrathoracic pressure
    this.itp = 0;

    // transfer the transmural pressures to the objects inside the container
    if (this.el_k != 1.0) {
      this.comps.forEach((enclosed_object) => {
        this.model.components[enclosed_object].pres_outside += this.pres;
      });
    }
  }

  calculate_volume() {
    // iterate over the enclosed objects to calculate the volumes
    let volume = 0;
    this.comps.forEach((enclosed_object) => {
      volume += this.model.components[enclosed_object].vol;
    });

    return volume;
  }
}

module.exports = Container;
