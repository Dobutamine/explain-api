class Blood {
  constructor(_model) {
    this.model = _model;

    // set the brent root finding properties
    this.brent_accuracy = 1e-8;
    this.max_iterations = 100.0;
    this.steps = 0;

    // acidbase constants
    this.kw = Math.pow(10.0, -13.6) * 1000.0;
    this.kc = Math.pow(10.0, -6.1) * 1000.0;
    this.kd = Math.pow(10.0, -10.22) * 1000.0;
    this.alpha_co2p = 0.03067;
    this.left_hp = Math.pow(10.0, -7.8) * 1000.0;
    this.right_hp = Math.pow(10.0, -6.8) * 1000.0;

    // oxygenation constants
    this.left_o2 = 0.01;
    this.right_o2 = 100;
    this.alpha_o2p = 0.0095;
    this.mmoltoml = 22.2674;

    // define the independent properties
    // - global
    this.circulating_blood_compounds = {};
    this.fixed_blood_compounds = {};

    // - acidbase
    this.sid = 41.6;
    this.albumin = 30;
    this.phosphates = 1.8;
    this.uma = 4;

    // - oxygenation
    this.dpg = 5;
    this.hemoglobin = 10;
    this.temp = 37;

    // define the dependent properties
    // - acidbase
    this.tco2 = 24.9;
    this.pco2 = 45;
    this.ph = 7.4;
    this.hco3 = 25;
    this.cco3 = 0;
    this.cco2 = 0;
    this.be = 0;

    // - oxygenation
    this.to2 = 9.1;
    this.po2 = 75;
    this.so2 = 0.98;

    // define a list which contains all components holding a blood volume
    this.blood_components = [];

    this.counter = 0;
  }
  init() {
    // now transform the components with content blood into oxygenation and acidbase capable components
    for (let [comp_name, comp] of Object.entries(this.model.components)) {
      if (comp.hasOwnProperty("content")) {
        if (comp.content == "blood") {
          // sets the p_atm independent variable as property
          comp["p_atm"] = this.p_atm;

          // add a reference to the component to the blood components list
          this.blood_components.push(comp);

          // set the fixed blood compounds as properties of the model component
          for (let [compound, value] of Object.entries(this.compounds)) {
            console.log(compound);
            comp[compound] = value;
          }

          // set the fixed blood compounds as properties of the model component
          for (let [compound, value] of Object.entries(
            this.fixed_blood_compounds
          )) {
            comp[compound] = value;
          }

          // set the circulating blood compounds as properties of the model component
          for (let [compound, value] of Object.entries(
            this.circulating_blood_compounds
          )) {
            comp[compound] = value;
          }

          // set the additional acidbase properties of the model component
          comp["acidbase_enabled"] = false;
          comp["pco2"] = this.pco2;
          comp["ph"] = this.ph;
          comp["hco3"] = this.hco3;
          comp["be"] = this.be;

          // set the additional oxygenation properties of the model component
          comp["oxy_enabled"] = false;
          comp["po2"] = this.po2;
          comp["so2"] = this.so2;
          comp["temp"] = this.temp;

          // the blood containing component is now transformed into a component with oxygenation and acidbase capabilities
        }
      }
    }
  }
  model_step() {
    if (this.is_enabled) {
      if (this.counter > 5) {
        // iterate over all blood components
        this.blood_components.forEach((comp) => {
          // if this component has the acidbase enabled then do the calculations
          if (comp.acidbase_enabled) {
            this.acidbase(comp);
          }

          // if this component has the oxygenation enabled then do the calculations
          if (comp.oxy_enabled) {
            this.oxygenation(comp);
          }
        });

        this.counter = 0;
      }
      this.counter += 1;
    }
  }

  acidbase(comp) {}
  oxygenation(comp) {
    // get the for the oxygenation independent parameters from the component
    this.to2 = comp.to2;
    this.dpg = comp.dpg;
    this.hemoglobin = comp.hemoglobin;
    this.be = comp.be;
    this.temp = comp.temp;

    // calculate the po2 from the to2 using a brent root finding function and oxygen dissociation curve
    this.po2 = this.brent(
      (po2) => this.oxygen_content(po2),
      this.left_o2,
      this.right_o2,
      this.max_iterations,
      this.brent_accuracy
    );

    // if a po2 is found then store the po2 and so2 into the component
    if (this.po2 > 0) {
      // convert the po2 to mmHg
      comp.po2 = this.po2 / 0.1333;
      comp.so2 = this.so2 * 100;
    }
  }

  oxygen_content(po2_estimate) {
    // calculate the saturation from the current po2 from the current po2 estimate
    this.so2 = this.oxygen_dissociation_curve(po2_estimate);

    // calculate the to2 from the current po2 estimate
    // convert the hemoglobin unit from mmol/l to g/dL
    // convert the po2 from kPa to mmHg
    // convert to output from ml O2/dL blood to ml O2/l blood
    let to2_new_estimate =
      (0.0031 * (po2_estimate / 0.1333) +
        1.36 * (this.hemoglobin / 0.6206) * this.so2) *
      10.0;

    // convert the ml O2/l to mmol/l
    to2_new_estimate = to2_new_estimate / this.mmoltoml;

    // calculate the difference between the real to2 and the to2 based on the new po2 estimate and return it to the brent root finding function
    let dto2 = this.to2 - to2_new_estimate;

    return dto2;
  }

  oxygen_dissociation_curve(po2) {
    // calculate the saturation from the po2 depending on the ph,be, temperature and dpg level.
    const a =
      1.04 * (7.4 - this.ph) + 0.005 * this.be + 0.07 * (this.dpg - 5.0);
    const b = 0.055 * (this.temp + 273.15 - 310.15);
    const y0 = 1.875;
    const x0 = 1.875 + a + b;
    const h0 = 3.5 + a;
    const k = 0.5343;
    const x = Math.log(po2, Math.E);
    const y = x - x0 + h0 * Math.tanh(k * (x - x0)) + y0;

    // return the o2 saturation
    return 1.0 / (Math.pow(Math.E, -y) + 1.0);
  }

  brent(func, lowerLimit, upperLimit, maxIter, errorTol) {
    var a = lowerLimit,
      b = upperLimit,
      c = a,
      fa = func(a),
      fb = func(b),
      fc = fa,
      s = 0,
      fs = 0,
      tol_act, // Actual tolerance
      new_step, // Step at this iteration
      prev_step, // Distance from the last but one to the last approximation
      p, // Interpolation step is calculated in the form p/q; division is delayed until the last moment
      q;

    // define a result object
    let result = {
      result: 10,
      iterations: 0,
      error: false,
    };

    let set_max_iterations = maxIter;

    errorTol = errorTol || 0;
    maxIter = maxIter || 1000;

    while (maxIter-- > 0) {
      prev_step = b - a;

      if (Math.abs(fc) < Math.abs(fb)) {
        // Swap data for b to be the best approximation
        (a = b), (b = c), (c = a);
        (fa = fb), (fb = fc), (fc = fa);
      }

      tol_act = 1e-15 * Math.abs(b) + errorTol / 2;
      new_step = (c - b) / 2;

      if (Math.abs(new_step) <= tol_act || fb === 0) {
        result.result = b;
        result.error = false;
        result.iterations = set_max_iterations - maxIter;
        return result.result; // Acceptable approx. is found
      }
      // Decide if the interpolation can be tried
      if (Math.abs(prev_step) >= tol_act && Math.abs(fa) > Math.abs(fb)) {
        // If prev_step was large enough and was in true direction, Interpolatiom may be tried
        var t1, cb, t2;
        cb = c - b;
        if (a === c) {
          // If we have only two distinct points linear interpolation can only be applied
          t1 = fb / fa;
          p = cb * t1;
          q = 1.0 - t1;
        } else {
          // Quadric inverse interpolation
          (q = fa / fc), (t1 = fb / fc), (t2 = fb / fa);
          p = t2 * (cb * q * (q - t1) - (b - a) * (t1 - 1));
          q = (q - 1) * (t1 - 1) * (t2 - 1);
        }

        if (p > 0) {
          q = -q; // p was calculated with the opposite sign; make p positive
        } else {
          p = -p; // and assign possible minus to q
        }

        if (
          p < 0.75 * cb * q - Math.abs(tol_act * q) / 2 &&
          p < Math.abs((prev_step * q) / 2)
        ) {
          // If (b + p / q) falls in [b,c] and isn't too large it is accepted
          new_step = p / q;
        }

        // If p/q is too large then the bissection procedure can reduce [b,c] range to more extent
      }

      if (Math.abs(new_step) < tol_act) {
        // Adjust the step to be not less than tolerance
        new_step = new_step > 0 ? tol_act : -tol_act;
      }

      (a = b), (fa = fb); // Save the previous approx.
      (b += new_step), (fb = func(b)); // Do step to a new approxim.

      if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
        (c = a), (fc = fa); // Adjust c for it to have a sign opposite to that of b
      }
    }

    // configure the return object if not within range
    result.result = -1;
    result.error = true;
    result.iterations = set_max_iterations - maxIter;
    return result.result; // No acceptable approximation. is found
  }
}
module.exports = Blood;
