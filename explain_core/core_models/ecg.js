class Ecg {
  constructor(_model) {
    // state properties (accessible from outside)
    this.heart_rate = 0;
    this.pq_time = 0;
    this.qrs_time = 0;
    this.qt_time = 0;
    this.cqt_time = 0.3;
    this.ncc_atrial = 0;
    this.ncc_ventricular = -1;
    this.measured_heart_rate = 0;
    this.ecg_signal = 0;

    // local state properties
    this._sa_node_period = 0;
    this._sa_node_counter = 0;
    this._pq_running = false;
    this._pq_time_counter = 0;
    this._qrs_running = false;
    this._qrs_time_counter = 0;
    this._qt_running = false;
    this._ventricle_is_refractory = false;
    this._qt_time_counter = 0;
    this._measured_hr_time_counter = 0;
    this._measured_qrs_counter = 0;
    this._p_wave_signal_counter = 0;
    this._qrs_wave_signal_counter = 0;
    this._t_wave_signal_counter = 0;

    // store a reference to the rest of the model
    this.model = _model;

    // get the modeling stepsize from the model
    this._t = _model.modeling_stepsize;
  }
  init() {}
  model_step() {
    if (this.is_enabled) {
      this.ecg_cycle();
    }
  }

  ecg_cycle() {
    // calculate the correct qt time
    this.cqt_time = this.qtc() - this.qrs_time;

    // calculate the sa_node_time in seconds depending on the heart_rate
    if (this.heart_rate > 0) {
      this._sa_node_period = 60 / this.heart_rate;
    } else {
      this._sa_node_period = 60;
    }

    // has the sa node period elapsed?
    if (this._sa_node_counter > this._sa_node_period) {
      // reset the sa node time counter
      this._sa_node_counter = 0;
      // signal that the pq time starts running
      this._pq_running = true;
      // reset atrial activation function factor
      this.ncc_atrial = -1;
    }

    // has the pq time elapsed?
    if (this._pq_time_counter > this.pq_time) {
      // reset the pq time counter
      this._pq_time_counter = 0;
      // signal that the pq time counter has stopped
      this._pq_running = false;
      // check whether the ventricles are not refractory to another depolarisation
      if (this._ventricle_is_refractory == false) {
        // signal that the qrs time starts running
        this._qrs_running = true;
        // reset the ventricular activation function factor
        this.ncc_ventricular = -1;
        // increase the measured qrs counter with 1 beat
        this._measured_qrs_counter += 1;
      }
    }

    // has the qrs time elapsed?
    if (this._qrs_time_counter > this.qrs_time) {
      // reset the qrs time counter
      this._qrs_time_counter = 0;
      // reset the ecg signal to zero
      this.ecg_signal = 0;
      // signal that the qrs time counter has stopped
      this._qrs_running = false;
      // signal that the qt time starts running
      this._qt_running = true;
      // signal that the ventricles are going into the refractory state
      this._ventricle_is_refractory = true;
    }

    // has the qt time elapsed?
    if (this._qt_time_counter > this.cqt_time) {
      // reset the qt time counter
      this._qt_time_counter = 0;
      // signal that the qt time counter has stopped
      this._qt_running = false;
      // signal that the ventricles are no longer in a refractory state
      this._ventricle_is_refractory = false;
    }

    // increase the ecg timers
    // the sa node timer is always running
    this._sa_node_counter += this._t;
    // increase the pq time counter if pq time is running
    if (this._pq_running) {
      this._pq_time_counter += this._t;
      // increase the p wave signal counter
      this._p_wave_signal_counter += 1;
      // build the p wave
      this.buildDynamicPWave();
    } else {
      // reset the p wave signal counter if pq is not running
      this._p_wave_signal_counter = 0;
    }

    // increase the qrs time counter if qrs time is running
    if (this._qrs_running) {
      this._qrs_time_counter += this._t;
      // increase the qrs wave signal counter
      this._qrs_wave_signal_counter += 1;
      // build the qrs wave
      this.buildQRSWave();
    } else {
      // reset the qrs wave signal counter if qrs is not running
      this._qrs_wave_signal_counter = 0;
    }

    // increase the qt time counter if qt time is running
    if (this._qt_running) {
      this._qt_time_counter += this._t;
      // increase the t wave signal counter
      this._t_wave_signal_counter += 1;
      // build the t wave
      this.buildDynamicTWave();
    } else {
      // reset the t wave signal counter if qt is not running
      this._t_wave_signal_counter = 0;
    }

    // if nothing is running, so there's no electrical activity then reset the ecg signal
    if (
      this._qt_running == false &&
      this._qrs_running == false &&
      this._qt_running == false
    ) {
      this.ecg_signal = 0;
    }

    // calculate the measured heart_rate based on the ventricular rate every 5 seconds
    if (this._measured_hr_time_counter > 5) {
      this.measured_heart_rate =
        60.0 / (this._measured_hr_time_counter / this._measured_qrs_counter);
      this._measured_qrs_counter = 0;
      this._measured_hr_time_counter = 0;
    }

    // increase the time counter for measured heart_rate routine
    this._measured_hr_time_counter += this._t;

    // increase the contraction timers
    this.ncc_atrial += 1;
    this.ncc_ventricular += 1;
  }

  qtc() {
    // calculate the heart rate correct qt time
    if (this.heart_rate > 10) {
      return this.qt_time * Math.sqrt(60 / this.heart_rate);
    } else {
      return this.qt_time * Math.sqrt(60.0 / 10.0);
    }
  }

  buildDynamicPWave() {}

  buildQRSWave() {}

  buildDynamicTWave() {}
}

module.exports = Ecg;
