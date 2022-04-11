class Ans {
  constructor(_model) {
    // get a reference to the whole model
    this.model = _model;

    //
    this.d_map_hp = 0;
    this.d_map_cont = 0;
    this.d_map_venpool = 0;
    this.d_map_res = 0;

    this.d_lungvol_hp = 0;
    this.d_po2_hp = 0;
    this.d_pco2_hp = 0;

    this.d_po2_ve = 0;
    this.d_pco2_ve = 0;
    this.d_ph_ve = 0;

    this.a_map = 0;
    this.a_lungvol = 0;
    this.a_po2 = 0;
    this.a_pco2 = 0;
    this.a_ph = 0;

    this._update_timer = 0;
    this.ans_update_interval = 0.015;

    this.input_hp = ["AA"];
    this.input_ve = ["AA"];
    this.input_cont = ["AA"];
    this.input_venpool = ["AA"];
    this.input_res = ["AA"];

    this.targets_hp = ["ecg"];
    this.targets_ve = ["breathing"];
    this.targets_cont = ["LV", "RV"];
    this.targets_venpool = ["IVCE", "SVC"];
    this.targets_res = ["AD_RLB", "AD_KID", "AD_INT", "AD_LS"];

    // define the update counters as the ANS doesn't need to be updated every 0.5 ms
    this.update_counter = 0;
    this.update_interval = 0.005;

    // set the init flag to false
    this.initialized = true;

    this.ref_uvol_ivce = 0;
    this.ref_uvol_svc = 0;

    this.delta_vol = 0;
    this.prev_delta_vol = 0;
  }

  init() {
    // switch on the acidbase and oxygenation capabilities of the inputs
    this.input_hp.forEach((comp) => {
      this.model.components[comp].oxy_enabled = true;
      this.model.components[comp].acidbase_enabled = true;
    });

    this.ref_uvol_ivce = this.model.components["IVCE"].u_vol;

    // set the initialization flag to true
    this.initialized = true;
  }

  model_step() {
    if (this.is_enabled) {
      if (this.update_counter > this.update_interval) {
        this.update_counter = 0;
        this.ans_activity();
      }
      this.update_counter += this.model.modeling_stepsize;
    }
  }

  ans_activity() {
    // check whether or not the model is initialized
    if (!this.initialized) {
      this.initialize();
    }

    // activate the inputs
    this.model.components["AA"].oxy_enabled = true;
    this.model.components["AA"].acidbase_enabled = true;

    // calculate the activation functions
    this.a_map = this.activation_function(
      this.model.components["AA"].pres,
      this.sa_map,
      this.op_map,
      this.th_map
    );
    this.a_po2 = this.activation_function(
      this.model.components["AA"].po2,
      this.sa_po2,
      this.op_po2,
      this.th_po2
    );
    this.a_pco2 = this.activation_function(
      this.model.components["AA"].pco2,
      this.sa_pco2,
      this.op_pco2,
      this.th_pco2
    );
    this.a_ph = this.activation_function(
      this.model.components["AA"].ph,
      this.sa_ph,
      this.op_ph,
      this.th_ph
    );

    // calculate the effectors
    this.d_map_hp =
      this.update_interval *
        ((1 / this.tc_map_hp) * (-this.d_map_hp + this.a_map)) +
      this.d_map_hp;
    this.d_po2_hp =
      this.update_interval *
        ((1 / this.tc_po2_hp) * (-this.d_po2_hp + this.a_po2)) +
      this.d_po2_hp;
    this.d_pco2_hp =
      this.update_interval *
        ((1 / this.tc_pco2_hp) * (-this.d_pco2_hp + this.a_pco2)) +
      this.d_pco2_hp;

    this.d_po2_ve =
      this.update_interval *
        ((1 / this.tc_po2_ve) * (-this.d_po2_ve + this.a_po2)) +
      this.d_po2_ve;
    this.d_pco2_ve =
      this.update_interval *
        ((1 / this.tc_pco2_ve) * (-this.d_pco2_ve + this.a_pco2)) +
      this.d_pco2_ve;
    this.d_ph_ve =
      this.update_interval *
        ((1 / this.tc_ph_ve) * (-this.d_ph_ve + this.a_ph)) +
      this.d_ph_ve;

    this.d_map_cont =
      this.update_interval *
        ((1 / this.tc_map_cont) * (-this.d_map_cont + this.a_map)) +
      this.d_map_cont;
    this.d_map_venpool =
      this.update_interval *
        ((1 / this.tc_map_venpool) * (-this.d_map_venpool + this.a_map)) +
      this.d_map_venpool;
    this.d_map_res =
      this.update_interval *
        ((1 / this.tc_map_res) * (-this.d_map_res + this.a_map)) +
      this.d_map_res;

    // apply the effects

    // if blood pressure above operating point the this.d_map_hp is positive and this.g_map_hp is positive
    let heartrate_ref = this.model.components["ecg"].heart_rate_ref;
    let new_heartrate =
      60000.0 /
      (60000.0 / heartrate_ref +
        this.g_map_hp * this.d_map_hp +
        this.g_pco2_hp * this.d_pco2_hp +
        this.g_po2_hp * this.d_po2_hp);
    if (new_heartrate < 0) {
      new_heartrate = 0;
    }
    this.model.components["ecg"].heart_rate = new_heartrate;

    let mv_ref = this.model.components["breathing"].ref_minute_volume;
    let new_mv =
      mv_ref +
      this.g_ph_ve * this.d_ph_ve +
      this.g_pco2_ve * this.d_pco2_ve +
      this.g_po2_ve * this.d_po2_ve;
    if (new_mv < 0) {
      new_mv = 0;
    }
    this.model.components["breathing"].target_minute_volume = new_mv;

    this.delta_vol = this.g_map_venpool * this.d_map_venpool;
    this.model.components["IVCE"].u_vol = this.ref_uvol_ivce + this.delta_vol;

    // to conserve the mass balance we have to change the volume of the IVCE according to delta_vol
    this.model.components["IVCE"].vol -= this.delta_vol - this.prev_delta_vol;
    this.prev_delta_vol = this.delta_vol;
  }

  activation_function(value, saturation, operating_point, threshold) {
    let activation = 0;

    if (value >= saturation) {
      activation = saturation - operating_point;
    } else {
      if (value <= threshold) {
        activation = threshold - operating_point;
      } else {
        activation = value - operating_point;
      }
    }
    if (isNaN(activation)) {
      return 0;
    } else {
      return activation;
    }
  }
}

module.exports = Ans;
