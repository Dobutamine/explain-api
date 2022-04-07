class Heart {
  constructor(_model) {
    // set the independent properties

    // dependent properties (accessible from outside)
    this.aaf = 0.0;
    this.aaf_old = 0.0;
    this.aaf_exp = 0.0;
    this.vaf = 0.0;
    this.vaf_old = 0.0;
    this.vaf_exp = 0.0;

    this.aaf10 = 0.0;
    this.vaf10 = 0.0;

    // systolic or diastolic state, 0 = diastolic, 1 = systolic
    this.state = 0;
    this.prev_state = 0;

    // store a reference to the rest of the model
    this.model = _model;

    // get the modeling stepsize from the model
    this._t = _model.modeling_stepsize;
  }

  init() {}

  model_step() {
    if (this.is_enabled) {
      this.heart_contraction();
    }
  }

  heart_contraction() {
    this.ecg_model = this.model.components["ecg"];

    // get the relevant timings from the ecg model
    let ncc_atrial = this.ecg_model.ncc_atrial;
    let atrial_duration = this.ecg_model.pq_time;
    let ncc_ventricular = this.ecg_model.ncc_ventricular;
    let ventricular_duration =
      this.ecg_model.cqt_time + this.ecg_model.qrs_time;

    let a_atrium = 10.0;
    // varying elastance activation function of the atria
    if (ncc_atrial >= 0 && ncc_atrial < atrial_duration / this._t) {
      // the atrial activation curve consists of two gaussian curves on top of each other
      // gaussian curve => y = a * exp(-((t - b) / c)^2) where
      // a = height
      // b = position of the peak
      // c = atrial duration

      const a = 1.0;
      const b = 0.5 * atrial_duration;
      const c = 0.2 * atrial_duration;
      const t = ncc_atrial * this._t;

      this.aaf = a * Math.exp(-Math.pow((t - b) / c, 2));
    }

    // varying elastance activation function of the ventricles
    if (
      ncc_ventricular >= 0 &&
      ncc_ventricular < ventricular_duration / this._t
    ) {
      // the ventricular activation curve consists of two gaussian curves on top of each other
      // gaussian curve => y = a * exp(-((t - b) / c)^2) where
      // a = height
      // b = position of the peak
      // c = atrial duration

      const a1 = 0.5;
      const b1 = 0.5 * ventricular_duration;
      const c1 = 0.2 * ventricular_duration;

      const a2 = 0.59;
      const b2 = 0.6 * ventricular_duration;
      const c2 = 0.13 * ventricular_duration;

      const t = ncc_ventricular * this._t;
      const vaf1 = a1 * Math.exp(-Math.pow((t - b1) / c1, 2));
      const vaf2 = a2 * Math.exp(-Math.pow((t - b2) / c2, 2));

      this.vaf = vaf1 + vaf2;

      // set the state as systolic
      this.state = 1;
    } else {
      // set the state as diastolic
      this.state = 0;
    }
    this.prev_state = this.state;
    // transfer the activation function to the heart compartments and the coronaries
    this.model.components["RA"].varying_elastance_factor = this.aaf;
    this.model.components["RV"].varying_elastance_factor = this.vaf;
    this.model.components["LA"].varying_elastance_factor = this.aaf;
    this.model.components["LV"].varying_elastance_factor = this.vaf;
    this.model.components["COR"].varying_elastance_factor = this.vaf;
  }
}

module.exports = Heart;
