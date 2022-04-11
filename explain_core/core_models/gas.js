class Gas {
  constructor(_model) {
    this.model = _model;

    // define dictionaries for the independent variables
    this.temp_settings = {};
    this.dry_air_composition = {};
    this.gas_compounds = {};

    this.initialized = false;
  }
  init() {
    // now transform the components with content gas into gas components
    for (let [comp_name, comp] of Object.entries(this.model.components)) {
      if (comp.hasOwnProperty("content")) {
        if (comp.content == "gas") {
          //                     print(comp.name)
          // now transform the model component into a gas containing object by injecting the necessary methods and properties
          comp["p_atm"] = this.p_atm; // sets the p_atm independent variable as property of the gas object
          comp["c_total"] = 0; // sets the c_total dependent variable as property of the gas object
          comp["c_total_dry"] = 0; // sets the c_total_dry dependent variable as property of the gas object

          // set the temperature and the water vapour pressure which is temperature dependent as properties of the gas object
          for (let [comp_name, temp] of Object.entries(this.temp_settings)) {
            if (comp_name == comp.name) {
              comp["gas_constant"] = this.gas_constant;
              comp["temp"] = temp;
              comp["ph2o"] = this.calculate_water_vapour_pressure(temp);
            }
          }

          // calculate concentration of all gas molecules in the gas compartment at atmospheric pressure
          comp.c_total =
            (this.p_atm / (comp.gas_constant * (273.15 + comp.temp))) * 1000;

          // calculate the fraction of h2o
          comp["fh2o"] = comp.ph2o / this.p_atm;
          comp["ch2o"] = comp.fh2o * comp.c_total;

          // we can now calculate the h2o corrected fractions of the other gasses as the total of fractions should 1.0

          // initialize the gas object with the wet air composition fractions (as a starting condition)
          for (let [compound, value] of Object.entries(
            this.dry_gas_fractions
          )) {
            // set the fraction
            comp["f" + compound] = value * (1.0 - comp.fh2o);
            // print(f'f{compound} = {value * (1.0 - comp.fh2o)}')

            // calculate the concentration of the compound in the dry part of the gas
            comp["c" + compound] = value * (1.0 - comp.fh2o) * comp.c_total;

            // calculate the partial pressure of the gas compound
            comp["p" + compound] = value * (1.0 - comp.fh2o) * this.p_atm;
          }

          let sum_f_wet =
            comp.fh2o + comp.fo2 + comp.fco2 + comp.fn2 + comp.fargon;
          let sum_c_wet =
            comp.ch2o + comp.co2 + comp.cco2 + comp.cn2 + comp.cargon;

          // dry air part
          // comp.c_total_dry = comp.c_total - comp.ch2o
          comp.c_total_dry =
            (this.p_atm / (comp.gas_constant * (273.15 + comp.temp))) * 1000;

          for (let [compound, value] of Object.entries(
            this.dry_gas_fractions
          )) {
            // set the fraction
            comp["f" + compound + "_dry"] = value;
            // print(f'f{compound}_dry = {value}')

            // calculate the concentration of the compound in the dry part of the gas
            comp["c" + compound + "_dry"] = value * comp.c_total_dry;

            // calculate the partial pressure of the gas compound
            comp["p" + compound + "_dry"] = value * this.p_atm;
          }

          let sum_f_dry =
            comp.fo2_dry + comp.fco2_dry + comp.fn2_dry + comp.fargon_dry;
          let sum_c_dry =
            comp.co2_dry + comp.cco2_dry + comp.cn2_dry + comp.cargon_dry;
        }
      }
    }
  }
  model_step() {}

  calculate_water_vapour_pressure(temp) {
    // calculate the water vapour pressure in air depending on the temperature
    return Math.pow(Math.E, 20.386 - 5132 / (temp + 273));
  }
}

module.exports = Gas;
