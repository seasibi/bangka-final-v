export const GEAR_MAP = {
  // --- Marine Surround Net ---
  marine_surround_net:{ kind: "type", name: "Marine Surrounding Net" },                          // GearType: Surround Net
  marine_surround_net_babyringnet: { kind: "subtype", name: "SN Baby Ring Net" },             // Subtype: Baby Ring Net               // Subtype: Ring Net (if exists)

  // --- Marine Falling Net ---
  marine_falling_net: { kind: "type", name: "Marine Falling Net" },                                      // GearType: Falling Net
  marine_falling_net_castnet:{ kind: "subtype", name: "FN Cast Net" },                  // Subtype: Cast Net

  // --- Marine Fishing Aggregating Device / Payao ---
  marine_fishing_aggr_device: { kind: "type", name: "Marine Fishing Aggregating Device / Payao" },                              // GearType: Fishing Aggregating Device
  marine_fishing_aggr_device_steeldrum: { kind: "subtype", name: "FAD Steel Drum" },        // Subtype: Steel Drum
  marine_fishing_aggr_device_bamboo: { kind: "subtype", name: "FAD Bamboo" },           // Subtype: Bamboo (Arong)
  marine_fishing_aggr_device_styropore: { kind: "subtype", name: "FAD Styropore" },        // Subtype: Styropore
  marine_fishing_aggr_device_bambooraft: { kind: "subtype", name: "FAD Bamboo Raft" },       // Subtype: Bamboo Raft

  // --- Marine Seine Net ---
  marine_seine_net: { kind: "type", name: "Marine Seine Net" },                                    // GearType: Seine Net
  marine_seine_net_roundhaulseine: { kind: "subtype", name: "SNT Round Haul Seine" },             // Subtype: Round Haul Seine
  marine_seine_net_beachseine: { kind: "subtype", name: "SNT Beach Seine" },                 // Subtype: Beach Seine
  marine_seine_net_frydozer: { kind: "subtype", name: "SNT Frydozer" },                   // Subtype: Fry Dozer or Gatherer

  // --- Marine Scoop Net ---
  marine_scoop_net: { kind: "type", name: "Marine Scoop Net" },                                    // GearType: Scoop Net
  marine_scoop_net_manpushnet: { kind: "subtype", name: "SCN Man Push Net" },                 // Subtype: Man Push Net
  marine_scoop_net_motorizedboatpushnet: { kind: "subtype", name: "SCN Motorized Boat Push Net" },       // Subtype: Motorized Boat Push Net
  marine_scoop_net_scoopnetchk: { kind: "subtype", name: "SCN Scoop Net" }, 
  
marine_miscellaneous_gear: { kind: "type", name: "Marine Miscellaneous Gear" },       // GearType: Miscellaneous
  marine_miscellaneous_gear_gaffhook: { kind: "subtype", name: "MMG Gaff Hook" },
  marine_miscellaneous_gear_rakedredge: { kind: "subtype", name: "MMG Rake / Dredge" },
  marine_miscellaneous_gear_squidluringdevice: { kind: "subtype", name: "MMG Squid Luring Device" },
  marine_miscellaneous_gear_octopusluringdevice: { kind: "subtype", name: "MMG Octupus Luring Device" },
  marine_miscellaneous_gear_miraclehole: { kind: "subtype", name: "MMG Miracle Hole" },
  marine_miscellaneous_gear_speargun: { kind: "subtype", name: "MMG Spear Gun" },
  marine_miscellaneous_gear_spear: { kind: "subtype", name: "MMG Spear" },

  // ===== MARINE (Lift Net) =====
  marine_lift_net: { kind: "type", name: "Marine Lift Net" },       // GearType: Lift Net
  marine_lift_net_bagnet: { kind: "subtype", name: "LN Bagnet" },
  marine_lift_net_stationaryliftnet: { kind: "subtype", name: "LN Stationary Lift Net" },

  // ===== MARINE (Cast Net → with Gillnet subtype) =====
  marine_cast_net:{ kind: "type", name: "Marine Cast Net" },       // GearType: Cast Net
  marine_cast_net_gillnet: { kind: "subtype", name: "CN Gill Net" },

  // ===== MARINE (Traps & Pots) =====
  marine_traps_n_pots: { kind: "type", name: "Marine Traps and Pots" },       // GearType: Traps & Pots
  marine_traps_n_pots_lobstertrap: { kind: "subtype", name: "MTP Lobster Trap" },
  marine_traps_n_pots_levernet: { kind: "subtype", name: "MTP Lever Net" },
  marine_traps_n_pots_shrimpliftnet: { kind: "subtype", name: "MTP Shrimp Lift Net" },
  marine_traps_n_pots_setnet: { kind: "subtype", name: "MTP Set Net" },
  marine_traps_n_pots_fishcoral: { kind: "subtype", name: "MTP Fish Coral" },
  marine_traps_n_pots_flykenet: { kind: "subtype", name: "MTP Flyke Net" },
  marine_traps_n_pots_crabpot: { kind: "subtype", name: "MTP Crab Pot" },
  marine_traps_n_pots_fishpot: { kind: "subtype", name: "MTP Fish Pot" },// Subtype: Scoop Net


  // ===== MARINE (pt 3 – Gill Net)
  marine_gill_net: { kind: "type", name: "Marine Gill Net" },      
  marine_gill_net_encirclinggillnet: { kind: "subtype", name: "GN Encircling Gill Net" },
  marine_gill_net_crabentanglingnet: { kind: "subtype", name: "GN Crab Gill Net" },
  marine_gill_net_trammelnet: { kind: "subtype", name: "GN Trammel Net" },
  marine_gill_net_bottomsetgillnet: { kind: "subtype", name: "GN Bottom Set Gill Net" },
  marine_gill_net_midwatersetgillnet: { kind: "subtype", name: "GN Midwater Set Gill Net" },
  marine_gill_net_inland_gill_net_surfacegillnet: { kind: "subtype", name: "GN Surface Gill Net" }, // Surface Gill Net (Largarete)
  marine_gill_net_smallpelagicdrift: { kind: "subtype", name: "GN Small Pelagic Drift Gill Net" }, // Small Pelagic Drift Gill Net
  marine_gill_net_tunabillfishdrift: { kind: "subtype", name: "GN Tuna/Bill Fish Frift Gill Net" }, // Tuna/Bill Fish Drift Gill Net

  // ===== MARINE (pt 3 – Hook & Line)
  marine_hook_n_line: { kind: "type", name: "Marine Hook and Line" },      
  marine_hook_n_line_demersalmhl: { kind: "subtype", name: "HL Demersal Hook and Line" },
  marine_hook_n_line_tunamhl: { kind: "subtype", name: "HL Tuna Hook and Line" },
  marine_hook_n_line_smallpelagicmhl: { kind: "subtype", name: "HL Small Pelagic Hook and Line" },
  marine_hook_n_line_tunahandline: { kind: "subtype", name: "HL Tuna Handline" },
  marine_hook_n_line_threadfinbream: { kind: "subtype", name: "HL Thread Fin Bream" },
  marine_hook_n_line_mackarelscad: { kind: "subtype", name: "HL Mackarel Scad" },

   // --- Inland Hook & Line ---
  inland_hook_n_line: { kind: "type", name: "Inland Hook and Line" },                                // GearType: Hook & Line
  inland_hook_n_line_polenline: { kind: "subtype", name: "HL Pole and Line" },              // Subtype: Pole and Line
  inland_hook_n_line_stationarystick: { kind: "subtype", name: "HL Stationary Stick" },        // Subtype: Stationary Stick & Line

  // --- Inland Set Longline ---
  inland_set_longline: { kind: "type", name: "Inland Set Longline" },                               // GearType: Set Longline
  inland_set_longline_bottomsetlongline: { kind: "subtype", name: "SL Bottom Set Longline" },     // Subtype: Bottom Set Longline
  inland_set_longline_surfacesetlongline: { kind: "subtype", name: "SL Surface Set Longline" },     // Subtype: Surface Set Longline

  // --- Inland Gill Net ---
  inland_gill_net: { kind: "type", name: "Inland Gill Net" },                                   // GearType: Gill Net
  inland_gill_net_surfacegillnet:  { kind: "subtype", name: "GL Surface Set Longline" },             // Subtype: Surface Gill Net
  inland_gill_net_bottomgillnet:  { kind: "subtype", name: "GL Bottom Set Longline" },              // Subtype: Bottom Gill Net

  // --- Inland Traps & Pots ---
  inland_traps_n_pots: { kind: "type", name: "Inland Traps and Pots" },                              // GearType: Traps and Pots
  inland_traps_n_pots_fishpottp:  { kind: "subtype", name: "ITP Fish Pot" },             // Subtype: Fish Pot (Wire/Bamboo/Net)
  inland_traps_n_pots_fishtraptp: { kind: "subtype", name: "ITP Fish Trap" },           // Subtype: Fish Trap (Bamboo/Net)
  inland_traps_n_pots_shrimptraptp: { kind: "subtype", name: "ITP Shrimp Trap" },         // Subtype: Shrimp Trap
  inland_traps_n_pots_bamboowiretrap: { kind: "subtype", name: "ITP Bamboo Wire Trap" },       // Subtype: Bamboo Wire Trap (Asar)
  inland_traps_n_pots_flyketnettp: { kind: "subtype", name: "ITP Flyke Net" },          // Subtype: Flyke Net
  inland_traps_n_pots_fishcorraltp: { kind: "subtype", name: "ITP Fish Corral (Baklad)" },         // Subtype: Fish Corral (Baklad)

  // --- Inland Falling Gears ---
  inland_falling_gears: { kind: "type", name: "Inland Falling Gear" },                            // GearType: Falling Gears
  inland_falling_gears_castnetfg: { kind: "subtype", name: "FG Cast Net" },           // Subtype: Cast Net

  // --- Inland Scoop Net ---
  inland_scoop_net: { kind: "type", name: "Inland Scoop Net" },                                 // GearType: Scoop Net
  inland_scoop_net_manpushnetsn: { kind: "subtype", name: "ISCN Man Push Net" },            // Subtype: Man Push Net
  inland_scoop_net_scoopnetsn: { kind: "subtype", name: "ISCN Scoop Net" },             // Subtype: Scoop Net

  // --- Inland Miscellaneous Gear ---
  inland_miscellaneous_gear: { kind: "type", name: "Inland Miscellaneous Gear" },                        // GearType: Miscellaneous Gear
  inland_miscellaneous_gear_spearmg: { kind: "subtype", name: "IMG Spear" },        // Subtype: Spear (Sibat)
  inland_miscellaneous_gear_speargunmg: { kind: "subtype", name: "IMG Spear Gun" },     // Subtype: Spear Gun
  inland_miscellaneous_gear_rakedredgemg: { kind: "subtype", name: "IMG Rake / Dredge" },   // Subtype: Rake / Dredge
  inland_miscellaneous_gear_fishsheltermg: { kind: "subtype", name: "IMG Fish Shelter" },
};
