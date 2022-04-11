class Breathing {
  constructor(_model) {
    // get a reference to the rest of the model
    this.model = _model;

    // set the local properties
    this.spont_breathing_enabled = true;
    this.spont_resp_rate = 35;
    this.ref_minute_volume = 0.63;
    this.ref_tidal_volume = 0.018;
    this.target_minute_volume = 0.63;
    this.target_tidal_volume = 0.018;
    this.vtrr_ratio = 0.00038;
    this.resp_muscle_pressure = 0;
    this.prev_resp_muscle_pressure = 0;
    this.max_amp = 50;
    this.breath_duration = 1000;

    this._amp = 2.0;
    this._temp_min_volume = 10000;
    this._temp_max_volume = -10000;
    this._volume_time_counter = 0;
    this._breath_timer_period = 0;
    this._breath_timer_counter = 0;
    this._volume_time_counter = 0;

    this.tidal_volume = 0;
    this.tv100 = 0;
    this.minute_volume = 0;

    this.initialized = false;
  }
  init() {
    this.initialized = true;
  }
  model_step() {
    if (this.is_enabled) {
      this.breathing_cycle();
    }
  }

  breathing_cycle() {
    // determine the breathing timings
    if (this.spont_resp_rate > 0 && this.spont_breathing_enabled) {
      this._breath_timer_period = 60 / this.spont_resp_rate;
    } else {
      this._breath_timer_period = 60;
    }

    // calculate the respiratory rate depending on the target minute volume and the vt_rr ratio
    this.vt_rr_controller();

    // is it time for a new breath yet?
    if (this._breath_timer_counter > this._breath_timer_period) {
      this.start_breath();
    }

    // generate the muscle signal
    if (this.spont_resp_rate > 0 && this.spont_breathing_enabled) {
      this.resp_muscle_pressure = this.generate_muscle_signal();
    } else {
      this.resp_muscle_pressure = 0;
    }

    // transfer the respiratory muscle force to the chestwalls
    this.targets.forEach((target) => {
      this.model.components[target].pres_outside += this.resp_muscle_pressure;
    });

    // store the current volumes
    let volume =
      this.model.components["ALL"].vol + this.model.components["ALR"].vol;

    if (volume > this._temp_max_volume) {
      this._temp_max_volume = volume;
    }
    if (volume < this._temp_min_volume) {
      this._temp_min_volume = volume;
    }

    // calculate the volumes if not breathing quickly enough
    if (this._volume_time_counter > 5.0) {
      this.calculate_volumes();
    }

    //increase the timers
    this._volume_time_counter += this.model.modeling_stepsize;
    this._breath_timer_counter += this.model.modeling_stepsize;
  }

  calculate_volumes() {
    // calculate the tidal and minute volumes
    this.tidal_volume = this._temp_max_volume - this._temp_min_volume;
    this.tv100 = this.tidal_volume * 100.0;
    this.minute_volume = this.tidal_volume * this.spont_resp_rate;

    // reset max and mins
    this._temp_min_volume = 10000;
    this._temp_max_volume = -10000;

    // reset the volumes counter
    this._volume_time_counter = 0;
  }

  start_breath() {
    // calculate the current tidal and minute volume
    this.calculate_volumes();

    // has the target tidal volume been reached or exceeded?
    let d_tv = this.tidal_volume - this.target_tidal_volume;

    // adjust the respiratory power to the resp muscles
    if (d_tv < -0.0001) {
      this._amp -= 0.05 * d_tv * 1000;
    }

    if (this._amp > this.max_amp) {
      this._amp = this.max_amp;
    }

    if (d_tv > 0.0001) {
      this._amp -= 0.05 * d_tv * 1000;
    }

    if (this._amp < 0) {
      this._amp = 0;
    }

    // reset the breathing timer
    this._breath_timer_counter = 0;
  }

  generate_muscle_signal() {
    return (
      -this._amp *
      Math.exp(
        -25.0 *
          (Math.pow(this._breath_timer_counter - this.breath_duration / 2, 2) /
            Math.pow(this.breath_duration, 2))
      )
    );
  }

  vt_rr_controller() {
    //calculate the spontaneous resp rate depending on the target minute volume (from ANS) and the set vt-rr ratio
    this.spont_resp_rate = Math.sqrt(
      this.target_minute_volume / this.vtrr_ratio
    );

    // calculate the target tidal volume depending on the target resp rate and target minute volume (from ANS)
    this.target_tidal_volume = this.target_minute_volume / this.spont_resp_rate;
  }
}

module.exports = Breathing;
