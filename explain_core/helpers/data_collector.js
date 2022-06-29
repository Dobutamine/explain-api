class Datacollector {
  constructor(_model) {
    // store a reference to the model instance
    this.model = _model;
    this.initialized = false;
    this.is_enabled = true;

    // define the watch list
    this.watch_list = [];

    // define the data sample interval
    this.sample_interval = 0.015;
    this.update_interval = 1.0;

    // define the counters
    this._sample_interval_counter = 0;
    this._update_interval_counter = 0;

    // get the modeling stepsize from the model
    this.modeling_stepsize = _model.modeling_stepsize;

    // define the data list
    this.collected_data = [];

    // define a data copy for export
    this.data = {};

    this.data_ready = false;
  }

  init() {
    // try to add two always needed ecg properties to the watchlist
    this.ncc_ventricular = {
      label: "ecg.ncc_ventricular",
      model: this.model.components["ecg"],
      prop: "ncc_ventricular",
    };
    this.ncc_atrial = {
      label: "ecg.ncc_atrial",
      model: this.model.components["ecg"],
      prop: "ncc_atrial",
    };

    // add the two always there
    this.watch_list.push(this.ncc_atrial);
    this.watch_list.push(this.ncc_ventricular);

    this.initialized = true;
  }

  model_step() {
    if (this.is_enabled) {
      this.collect_data(this.model.model_time_total);
    }
  }

  clear_data() {
    this._update_interval_counter = 0;
    this._sample_interval_counter = 0;
    this.collected_data = [];
  }

  clear_watchlist() {
    // first clear all data
    this.clear_data();

    // empty the watch list
    this.watch_list = [];

    // add the two always there
    this.watch_list.append(self.ncc_atrial);
    this.watch_list.append(self.ncc_ventricular);
  }

  set_sample_interval(new_interval) {
    console.log(
      "MODEL-ENGINE: datacollector sample interval set to: " + new_interval
    );
    this.sample_interval = parseFloat(new_interval);
  }

  set_update_interval(new_interval) {
    console.log(
      "MODEL-ENGINE: datacollector update interval set to: " + new_interval
    );
    this.update_interval = parseFloat(new_interval);
  }

  add_to_watchlist(property) {
    // first clear all data
    this.clear_data();

    // add to the watchlist
    this.watch_list.push(property);
  }

  add_to_watchlist_raw(property) {
    this.clear_data();

    let object_to_watch = {
      label: property.label,
      prop: property.prop,
      model: this.model.components[property.model],
    };
    console.log(
      `MODEL-ENGINE: datacollector added ${property.model}.${property.prop} to watchlist.`
    );
    this.watch_list.push(object_to_watch);
  }

  collect_data(model_clock) {
    // gather data with a specific dataresolution
    if (this._sample_interval_counter >= this.sample_interval) {
      this._sample_interval_counter = 0;
      let data_object = {
        time: model_clock.toFixed(4),
      };
      this.watch_list.forEach((parameter) => {
        const label = parameter["label"];
        const prop = parameter["prop"];
        let weight = 1;
        let time = 1;
        if (prop == "flow") {
          weight = this.model.weight;
          time = 60;
        }
        if (prop == "vol") {
          weight = this.model.weight;
        }

        if (parameter["model"] != null) {
          let value = parameter["model"][parameter["prop"]];
          data_object[label] = (value / weight) * time;
        }
      });
      this.collected_data.push(data_object);
    }
    this._sample_interval_counter += this.modeling_stepsize;

    // check the update interval
    if (this._update_interval_counter >= this.update_interval) {
      // reset the data ready counter
      this._update_interval_counter = 0;

      // save a copy of the collected data
      this.data = { ...this.collected_data };

      // clear the data buffer
      this.collected_data = [];

      // set the data ready flag
      this.data_ready = true;
    }
    // console.log(this._update_interval_counter)
    this._update_interval_counter += this.modeling_stepsize;
  }
}

module.exports = Datacollector;
