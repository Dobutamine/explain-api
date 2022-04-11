class Metabolism {
  constructor(_model) {
    this.model = _model;

    // define the properties
    this.name = "metabolism";
    this.description = "metabolism";
    this.model_type = "Metabolism";
    this.is_enabled = true;
    this.atp_need = 0.00014;
    this.resp_q = 0.8;
    this.p_atm = 760;
    this.outside_temp = 20;
    this.body_temp = 36.9;
    this.active_comps = [
      { comp: "RLB", fvatp: 0.185 },
      { comp: "KID", fvatp: 0.1 },
      { comp: "LS", fvatp: 0.1 },
      { comp: "INT", fvatp: 0.1 },
      { comp: "RUB", fvatp: 0.2 },
      { comp: "BR", fvatp: 0.25 },
      { comp: "COR", fvatp: 0.05 },
      { comp: "AA", fvatp: 0.005 },
      { comp: "AD", fvatp: 0.01 },
    ];

    this.initialized = false;
  }
  init() {
    this.initialized = true;
  }
  model_step() {
    if (this.is_enabled) {
      this.active_comps.forEach((active_comp) => {
        this.calculate_energy_use(active_comp);
      });
    }
  }

  calculate_energy_use(active_comp) {
    // store a reference to the component
    let comp = this.model.components[active_comp["comp"]];

    // find the stored fractional atp use
    let fvatp = active_comp["fvatp"];

    // get the component ATP need in molecules per second
    let atp_need = fvatp * this.atp_need;

    // now we need to know how much molecules ATP we need in this step
    let atp_need_step = atp_need * this.model.modeling_stepsize;

    // get the number of oxygen molecules available in this active compartment in mmol
    let o2_molecules_available = comp.to2 * comp.vol;

    // we state that 80% of these molecules are available for use
    let o2_molecules_available_for_use = 0.8 * o2_molecules_available;

    // how many molecules o2 do we need to burn in this step as 1 mmol of o2 gives 5 mmol of ATP when processed by oxydative phosphorylation
    let o2_to_burn = atp_need_step / 5.0;

    // how many needed ATP molecules can't be produced by aerobic respiration
    let anaerobic_atp =
      (o2_to_burn - o2_molecules_available_for_use / 4.0) * 5.0;

    // if negative then there are more o2 molecules available than needed and then shut down anaerobic fermentation
    if (anaerobic_atp < 0) {
      anaerobic_atp = 0;
    }

    // burn the required amount of o2 molecules
    let o2_burned = o2_to_burn;

    // if we need to burn more than we have then burn all available o2 molecules
    if (o2_to_burn > o2_molecules_available_for_use) {
      // burn all o2's
      o2_burned = o2_molecules_available_for_use;
    }

    // as we burn o2 molecules we have to substract them from the total number of o2 molecules
    o2_molecules_available -= o2_burned;

    // calculate the new tO2
    comp.to2 = o2_molecules_available / comp.vol;

    // guard against negative concentrations
    if (comp.to2 < 0) {
      comp.to2 = 0;
    }

    // we now how much o2 molecules we'v burned so we should be able to calculate how much co2 molecules we generated. This depends on the respiratory quotient
    let co2_molecules_produced = o2_burned * this.resp_q;

    // add the co2 molecules to the total co2 molecules
    comp.tco2 = (comp.tco2 * comp.vol + co2_molecules_produced) / comp.vol;

    // guard against negative concentrations
    if (comp.tco2 < 0) {
      comp.tco2 = 0;
    }
  }
}

module.exports = Metabolism;
