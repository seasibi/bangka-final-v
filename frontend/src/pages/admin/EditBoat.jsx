import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import PageTitle from "../../components/PageTitle";
import { GEAR_MAP } from "../../constants/gearMap";
import BoatProfile from "../../components/BoatRegistry/BoatProfile"; // swapped in BoatProfile
import { 
  updateBoat,
  getBoatGearAssignmentsByBoat,
  createOrGetBoatGearAssignment,
  createBoatGearTypeAssignment,
  createBoatGearSubtypeAssignment,
  updateBoatGearTypeAssignment,
  updateBoatGearSubtypeAssignment,
  deleteBoatGearTypeAssignment,
  deleteBoatGearSubtypeAssignment
} from "../../services/boatService";
import { getGearTypes, getGearSubtypes } from "../../services/gearService";
import Modal from "../../components/Modal";
import SuccessModal from "../../components/SuccessModal";
import ConfirmModal from "../../components/ConfirmModal";
import Button from "../../components/Button";
import GearSection from "../../components/BoatRegistry/BoatRegistrationForm/GearSection";

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

const EditBoat = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [preview, setPreview] = useState(null);

  // Fix: Define currentDate before using it in formData
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const currentDate = `${yyyy}-${mm}-${dd}`;

  const NAME_TO_FIELD = Object.entries(GEAR_MAP).reduce((acc, [field, { name }]) => {
  acc[name] = field;
  return acc;
}, {});

  useEffect(() => {
    if (!id) {
      setError("No registration ID provided");
      setLoading(false);
      return;
    }

    const fetchBoat = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/boats/${id}/`);
        const boatData = response.data;
        const fisherfolk = boatData.fisherfolk; // ✅ safe reference
        const fisherAddress = fisherfolk?.address || {};

        const fullAddress = [
          fisherAddress.street,
          fisherAddress.barangay,
          fisherAddress.municipality,
          fisherAddress.province,
        ]
          .filter(Boolean)
          .join(", ");

          // ✅ handle gear_assignments if present
   const mappedGear = mapGearAssignmentsToFormData(
      boatData.gear_assignments || []
    );

        console.log("Fetched boat:", boatData);

        setFormData((prev) => ({
          ...prev,
          ...boatData,
          fisherfolk_registration_number: fisherfolk?.registration_number || "",
          owner_name: `${fisherfolk?.first_name || ""} ${
            fisherfolk?.middle_name
              ? fisherfolk.middle_name.charAt(0) + ". "
              : ""
          }${fisherfolk?.last_name || ""}`.trim(),
          owner_address: fullAddress,
          ...mappedGear, // ✅ merge gear data if any
        }));
      } catch (error) {
        console.error("Error fetching boat:", error);
        setError("Failed to load boat data.");
      }
    };

    fetchBoat();
    setLoading(false);
  }, [id]);

  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }

      // store file object in formData
      setFormData((prev) => ({
        ...prev,
        boat_image: file, // ✅ real file, not base64
      }));

      // generate preview (without touching formData)
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result); // ✅ base64 only for preview
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper function to update boat gears
  const updateBoatGears = async (mfbr_number, formData) => {
    try {
      console.log("Starting gear update for boat:", mfbr_number);
      
      // Fetch fresh gear types and subtypes for this update
      const freshGearTypes = await getGearTypes();
      const freshGearSubtypes = await getGearSubtypes();
      
      console.log("Fetched gear types:", freshGearTypes.length);
      console.log("Fetched gear subtypes:", freshGearSubtypes.length);
      
      if (freshGearTypes.length === 0 || freshGearSubtypes.length === 0) {
        console.warn("No gear types or subtypes available, skipping gear update");
        return;
      }
      
      // Get current gear assignments to use existing assignment ID
      const existingAssignments = await getBoatGearAssignmentsByBoat(mfbr_number);
      
      let assignmentId;
      if (existingAssignments && existingAssignments.length > 0) {
        // Use the FIRST existing assignment (don't create duplicates!)
        assignmentId = existingAssignments[0].id;
        console.log("✅ Using existing gear assignment ID:", assignmentId);
        
        // If there are duplicate assignments, warn about it
        if (existingAssignments.length > 1) {
          console.warn(`⚠️ Found ${existingAssignments.length} gear assignments for this boat! Using first one. Consider cleaning up duplicates.`);
        }
      } else {
        // Only create new if there's no existing assignment
        const gearAssignmentContainer = await createOrGetBoatGearAssignment(mfbr_number);
        assignmentId = gearAssignmentContainer.id;
        console.log("✅ Created new gear assignment ID:", assignmentId);
      }
      
      // Use the existing assignments we already fetched
      const currentGearAssignments = existingAssignments;
      console.log("📋 NAME_TO_FIELD keys (first 20):", Object.keys(NAME_TO_FIELD).slice(0, 20));
      console.log("📋 Looking for 'MTP Set Net' in NAME_TO_FIELD:", NAME_TO_FIELD["MTP Set Net"]);
      console.log("📋 All NAME_TO_FIELD entries with 'Set Net':");
      Object.keys(NAME_TO_FIELD).filter(k => k.includes('Set Net')).forEach(k => {
        console.log(`  "${k}" -> ${NAME_TO_FIELD[k]}`);
      });
      
      // Extract gear fields from formData
      const gearFields = {};
      Object.keys(formData).forEach(key => {
        if (key.startsWith('marine_') || key.startsWith('inland_')) {
          gearFields[key] = formData[key];
        }
      });
      
      console.log("Gear fields to update:", gearFields);
      
      // Build a map of current gear assignments by field name for easy lookup
      const currentGearMap = {};
      if (currentGearAssignments && currentGearAssignments.length > 0) {
        console.log("🐟 Current gear assignments from backend:", currentGearAssignments[0]);
        
        // Log all subtype names from backend
        console.log("🐟 ALL SUBTYPE NAMES FROM BACKEND:");
        currentGearAssignments[0].types_data?.forEach(typeData => {
          typeData.subtypes_data?.forEach(subtypeData => {
            const subtypeName = subtypeData.gear_subtype?.name;
            console.log(`  Backend subtype: "${subtypeName}"`);
          });
        });
        
        currentGearAssignments[0].types_data?.forEach(typeData => {
          const typeName = typeData.gear_type?.name;
          const fieldKey = NAME_TO_FIELD[typeName];
          if (fieldKey) {
            currentGearMap[fieldKey] = {
              typeAssignmentId: typeData.id,
              isPresent: typeData.is_present,
              typeName: typeName
            };
            console.log(`Mapped type: ${typeName} -> ${fieldKey} (ID: ${typeData.id})`);
          }
          
          typeData.subtypes_data?.forEach(subtypeData => {
            const subtypeName = subtypeData.gear_subtype?.name;
            console.log(`Trying to map subtype name: "${subtypeName}"`);
            const subfieldKey = NAME_TO_FIELD[subtypeName];
            console.log(`Result subfieldKey: ${subfieldKey}`);
            if (subfieldKey) {
              currentGearMap[subfieldKey] = {
                subtypeAssignmentId: subtypeData.id,
                isPresent: subtypeData.is_present,
                quantity: subtypeData.quantity,
                subtypeName: subtypeName
              };
              console.log(`Mapped subtype: ${subtypeName} -> ${subfieldKey} (ID: ${subtypeData.id})`);
            }
          });
        });
      }
      
      console.log("Current gear map:", currentGearMap);
      
      // Process each gear field
      for (const [fieldKey, value] of Object.entries(gearFields)) {
        const isQuantityField = fieldKey.endsWith('_no');
        console.log(`Processing field: ${fieldKey} = ${value} (type: ${typeof value})`);
        
        if (isQuantityField) {
          // Handle quantity fields (e.g., marine_surround_net_babyringnet_no)
          const baseField = fieldKey.replace('_no', '');
          const isChecked = gearFields[baseField];
          const quantity = value || 0;
          
          // Find the gear subtype
          const gearName = Object.keys(NAME_TO_FIELD).find(name => NAME_TO_FIELD[name] === baseField);
          if (!gearName) continue;
          
          const gearSubtype = freshGearSubtypes.find(st => st.name === gearName);
          if (!gearSubtype) {
            console.warn(`Gear subtype not found: ${gearName}`);
            continue;
          }
          
          const currentData = currentGearMap[baseField];
          
          if (isChecked) {
            // Gear is checked, create or update
            if (currentData && currentData.subtypeAssignmentId) {
              // Update existing
              if (currentData.isPresent !== isChecked || currentData.quantity != quantity) {
                await updateBoatGearSubtypeAssignment(currentData.subtypeAssignmentId, {
                  is_present: isChecked,
                  quantity: Number(quantity) || 0
                });
                console.log(`Updated subtype: ${gearName}`);
              }
            } else {
              // Create new
              await createBoatGearSubtypeAssignment({
                boat_gear_assignment: assignmentId,
                gear_subtype_id: gearSubtype.id,
                is_present: isChecked,
                quantity: Number(quantity) || 0
              });
              console.log(`Created subtype: ${gearName}`);
            }
          } else {
            // Gear is unchecked, delete if it exists
            console.log(`Checking delete for subtype ${gearName}: currentData =`, currentData);
            if (currentData && currentData.subtypeAssignmentId) {
              console.log(`Deleting subtype assignment ID: ${currentData.subtypeAssignmentId}`);
              await deleteBoatGearSubtypeAssignment(currentData.subtypeAssignmentId);
              console.log(`✅ Deleted subtype: ${gearName}`);
            } else {
              console.log(`⚠️ Skipping delete - no current data for: ${baseField}`);
            }
          }
        } else if (!fieldKey.endsWith('_no')) {
          // Handle gear type/subtype checkboxes (need to check if it's a type or subtype)
          const isChecked = Boolean(value);
          
          // Find the gear name and check its kind
          const gearName = Object.keys(NAME_TO_FIELD).find(name => NAME_TO_FIELD[name] === fieldKey);
          if (!gearName) continue;
          
          // Get the gear info from GEAR_MAP to check if it's a type or subtype
          const gearInfo = GEAR_MAP[fieldKey];
          if (!gearInfo) {
            console.warn(`Gear info not found in GEAR_MAP: ${fieldKey}`);
            continue;
          }
          
          // Skip if this is a subtype (subtypes are handled in the quantity field section)
          if (gearInfo.kind === 'subtype') {
            continue;
          }
          
          // Now we know it's a type, so find it in freshGearTypes
          const gearType = freshGearTypes.find(gt => gt.name === gearName);
          if (!gearType) {
            console.warn(`Gear type not found: ${gearName}`);
            continue;
          }
          
          const currentData = currentGearMap[fieldKey];
          
          if (isChecked) {
            // Gear is checked, create or update
            if (currentData && currentData.typeAssignmentId) {
              // Update existing
              if (currentData.isPresent !== isChecked) {
                await updateBoatGearTypeAssignment(currentData.typeAssignmentId, {
                  is_present: isChecked
                });
                console.log(`Updated type: ${gearName}`);
              }
            } else {
              // Create new
              await createBoatGearTypeAssignment({
                boat_gear_assignment: assignmentId,
                gear_type_id: gearType.id,
                is_present: isChecked
              });
              console.log(`Created type: ${gearName}`);
            }
          } else {
            // Gear is unchecked, delete if it exists
            console.log(`Checking delete for type ${gearName}: currentData =`, currentData);
            if (currentData && currentData.typeAssignmentId) {
              console.log(`Deleting type assignment ID: ${currentData.typeAssignmentId}`);
              await deleteBoatGearTypeAssignment(currentData.typeAssignmentId);
              console.log(`✅ Deleted type: ${gearName}`);
            } else {
              console.log(`⚠️ Skipping delete - no current data for type: ${fieldKey}`);
            }
          }
        }
      }
      
      console.log("Gear update completed successfully");
    } catch (error) {
      console.error("Error updating gears:", error);
      throw error;
    }
  };

  const handleSubmit = () => {
    // Show confirmation modal instead of directly submitting
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      setError(null);
      setShowConfirmModal(false); // Close confirmation modal
      
      // Extract only boat-related fields, exclude gear fields and extra UI fields
      const {
        mfbr_number,
        owner_name,
        owner_address,
        ...allData
      } = formData;
      
      // Filter out all gear fields (they start with marine_ or inland_)
      const boatOnlyData = {};
      Object.keys(allData).forEach(key => {
        // Only include fields that are NOT gear-related
        if (!key.startsWith('marine_') && !key.startsWith('inland_')) {
          boatOnlyData[key] = allData[key];
        }
      });

      // Decide payload type based on boat_image
      let payload = boatOnlyData;
      const hasNewImage = boatOnlyData.boat_image && boatOnlyData.boat_image instanceof File;
      if (hasNewImage) {
        const fd = new FormData();
        Object.entries(boatOnlyData).forEach(([k, v]) => fd.append(k, v));
        payload = fd;
      } else {
        // Do not send boat_image if it is just a URL string (unchanged)
        if (typeof boatOnlyData.boat_image === 'string') {
          delete boatOnlyData.boat_image;
        }
      }
      
      console.log("Updating boat with mfbr_number:", mfbr_number);
      console.log("Boat-only update data:", payload instanceof FormData ? Object.fromEntries(payload.entries()) : payload);
      
      // Update boat information
      await updateBoat(mfbr_number, payload);
      console.log("Boat updated successfully");
      
      // Update gear assignments
      console.log("Starting gear update...");
      await updateBoatGears(mfbr_number, formData);
      console.log("Gear update completed");
      
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error updating boat:", error);
      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "An error occurred while updating the boat"
      );
    }
  };

  const [formData, setFormData] = useState({
    // Boat
    mfbr_number: "",
    application_date: currentDate,
    type_of_registration: "",
    fisherfolk_registration_number: "",
    owner_name: "",
    owner_address: "",
    type_of_ownership: "",
    boat_name: "",
    boat_type: "",
    fishing_ground: "",
    fma_number: "",
    built_place: "",
    no_fishers: "",
    material_used: "",
    homeport: "",
    built_year: "",
    engine_make: "",
    serial_number: "",
    horsepower: "",
    is_active: true,

    // BoatMeasurements
    registered_length: "",
    registered_breadth: "",
    registered_depth: "",
    tonnage_length: "",
    tonnage_breadth: "",
    tonnage_depth: "",
    gross_tonnage: "",
    net_tonnage: "",

  // --- Marine Surround Net ---
  marine_surround_net: false,
  marine_surround_net_babyringnet: false,
  marine_surround_net_babyringnet_no: "",

  // --- Marine Falling Net ---
  marine_falling_net: false,
  marine_falling_net_castnet: false,
  marine_falling_net_castnet_no: "",

  // --- Marine Fishing Aggregating Device / Payao ---
  marine_fishing_aggr_device: false,
  marine_fishing_aggr_device_steeldrum: false,
  marine_fishing_aggr_device_steeldrum_no: "",
  marine_fishing_aggr_device_bamboo: false,
  marine_fishing_aggr_device_bamboo_no: "",
  marine_fishing_aggr_device_styropore: false,
  marine_fishing_aggr_device_styropore_no: "",
  marine_fishing_aggr_device_bambooraft: false,
  marine_fishing_aggr_device_bambooraft_no: "",

  // --- Marine Seine Net ---
  marine_seine_net: false,
  marine_seine_net_roundhaulseine: false,
  marine_seine_net_roundhaulseine_no: "",
  marine_seine_net_beachseine: false,
  marine_seine_net_beachseine_no: "",
  marine_seine_net_frydozer: false,
  marine_seine_net_frydozer_no: "",

  // --- Marine Scoop Net ---
  marine_scoop_net: false,
  marine_scoop_net_manpushnet: false,
  marine_scoop_net_manpushnet_no: "",
  marine_scoop_net_motorizedboatpushnet: false,
  marine_scoop_net_motorizedboatpushnet_no: "",
  marine_scoop_net_scoopnetchk: false,
  marine_scoop_net_scoopnetchk_no: "",

  // --- Marine Miscellaneous Gear ---
  marine_miscellaneous_gear: false,
  marine_miscellaneous_gear_gaffhook: false,
  marine_miscellaneous_gear_gaffhook_no: "",
  marine_miscellaneous_gear_rakedredge: false,
  marine_miscellaneous_gear_rakedredge_no: "",
  marine_miscellaneous_gear_squidluringdevice: false,
  marine_miscellaneous_gear_squidluringdevice_no: "",
  marine_miscellaneous_gear_octopusluringdevice: false,
  marine_miscellaneous_gear_octopusluringdevice_no: "",
  marine_miscellaneous_gear_miraclehole: false,
  marine_miscellaneous_gear_miraclehole_no: "",
  marine_miscellaneous_gear_speargun: false,
  marine_miscellaneous_gear_speargun_no: "",
  marine_miscellaneous_gear_spear: false,
  marine_miscellaneous_gear_spear_no: "",

  // --- Marine Lift Net ---
  marine_lift_net: false,
  marine_lift_net_bagnet: false,
  marine_lift_net_bagnet_no: "",
  marine_lift_net_stationaryliftnet: false,
  marine_lift_net_stationaryliftnet_no: "",

  // --- Marine Cast Net ---
  marine_cast_net: false,
  marine_cast_net_gillnet: false,
  marine_cast_net_gillnet_no: "",

  // --- Marine Traps & Pots ---
  marine_traps_n_pots: false,
  marine_traps_n_pots_lobstertrap: false,
  marine_traps_n_pots_lobstertrap_no: "",
  marine_traps_n_pots_levernet: false,
  marine_traps_n_pots_levernet_no: "",
  marine_traps_n_pots_shrimpliftnet: false,
  marine_traps_n_pots_shrimpliftnet_no: "",
  marine_traps_n_pots_setnet: false,
  marine_traps_n_pots_setnet_no: "",
  marine_traps_n_pots_fishcoral: false,
  marine_traps_n_pots_fishcoral_no: "",
  marine_traps_n_pots_flykenet: false,
  marine_traps_n_pots_flykenet_no: "",
  marine_traps_n_pots_crabpot: false,
  marine_traps_n_pots_crabpot_no: "",
  marine_traps_n_pots_fishpot: false,
  marine_traps_n_pots_fishpot_no: "",

  // --- Marine Gill Net ---
  marine_gill_net: false,
  marine_gill_net_encirclinggillnet: false,
  marine_gill_net_encirclinggillnet_no: "",
  marine_gill_net_crabentanglingnet: false,
  marine_gill_net_crabentanglingnet_no: "",
  marine_gill_net_trammelnet: false,
  marine_gill_net_trammelnet_no: "",
  marine_gill_net_bottomsetgillnet: false,
  marine_gill_net_bottomsetgillnet_no: "",
  marine_gill_net_midwatersetgillnet: false,
  marine_gill_net_midwatersetgillnet_no: "",
  marine_gill_net_inland_gill_net_surfacegillnet: false,
  marine_gill_net_inland_gill_net_surfacegillnet_no: "",
  marine_gill_net_smallpelagicdrift: false,
  marine_gill_net_smallpelagicdrift_no: "",
  marine_gill_net_tunabillfishdrift: false,
  marine_gill_net_tunabillfishdrift_no: "",

  // --- Marine Hook & Line ---
  marine_hook_n_line: false,
  marine_hook_n_line_demersalmhl: false,
  marine_hook_n_line_demersalmhl_no: "",
  marine_hook_n_line_tunamhl: false,
  marine_hook_n_line_tunamhl_no: "",
  marine_hook_n_line_smallpelagicmhl: false,
  marine_hook_n_line_smallpelagicmhl_no: "",
  marine_hook_n_line_tunahandline: false,
  marine_hook_n_line_tunahandline_no: "",
  marine_hook_n_line_threadfinbream: false,
  marine_hook_n_line_threadfinbream_no: "",
  marine_hook_n_line_mackarelscad: false,
  marine_hook_n_line_mackarelscad_no: "",

  // --- Inland Hook & Line ---
  inland_hook_n_line: false,
  inland_hook_n_line_polenline: false,
  inland_hook_n_line_polenline_no: "",
  inland_hook_n_line_stationarystick: false,
  inland_hook_n_line_stationarystick_no: "",

  // --- Inland Set Longline ---
  inland_set_longline: false,
  inland_set_longline_bottomsetlongline: false,
  inland_set_longline_bottomsetlongline_no: "",
  inland_set_longline_surfacesetlongline: false,
  inland_set_longline_surfacesetlongline_no: "",

  // --- Inland Gill Net ---
  inland_gill_net: false,
  inland_gill_net_surfacegillnet: false,
  inland_gill_net_surfacegillnet_no: "",
  inland_gill_net_bottomgillnet: false,
  inland_gill_net_bottomgillnet_no: "",

  // --- Inland Traps & Pots ---
  inland_traps_n_pots: false,
  inland_traps_n_pots_fishpottp: false,
  inland_traps_n_pots_fishpottp_no: "",
  inland_traps_n_pots_fishtraptp: false,
  inland_traps_n_pots_fishtraptp_no: "",
  inland_traps_n_pots_shrimptraptp: false,
  inland_traps_n_pots_shrimptraptp_no: "",
  inland_traps_n_pots_bamboowiretrap: false,
  inland_traps_n_pots_bamboowiretrap_no: "",
  inland_traps_n_pots_flyketnettp: false,
  inland_traps_n_pots_flyketnettp_no: "",
  inland_traps_n_pots_fishcorraltp: false,
  inland_traps_n_pots_fishcorraltp_no: "",

  // --- Inland Falling Gears ---
  inland_falling_gears: false,
  inland_falling_gears_castnetfg: false,
  inland_falling_gears_castnetfg_no: "",

  // --- Inland Scoop Net ---
  inland_scoop_net: false,
  inland_scoop_net_manpushnetsn: false,
  inland_scoop_net_manpushnetsn_no: "",
  inland_scoop_net_scoopnetsn: false,
  inland_scoop_net_scoopnetsn_no: "",

  // --- Inland Miscellaneous Gear ---
  inland_miscellaneous_gear: false,
  inland_miscellaneous_gear_spearmg: false,
  inland_miscellaneous_gear_spearmg_no: "",
  inland_miscellaneous_gear_speargunmg: false,
  inland_miscellaneous_gear_speargunmg_no: "",
  inland_miscellaneous_gear_rakedredgemg: false,
  inland_miscellaneous_gear_rakedredgemg_no: "",
  inland_miscellaneous_gear_fishsheltermg: false,
  inland_miscellaneous_gear_fishsheltermg_no: "",
    // Image
    boat_image: null,
  });

const mapGearAssignmentsToFormData = (gearAssignments) => {
  const formUpdate = {};

  // Only process the FIRST assignment (should be for current boat)
  // The API sometimes returns multiple assignments, we only want the first one
  if (gearAssignments.length === 0) {
    console.log("⚠️ No gear assignments to map");
    return formUpdate;
  }
  
  const assignment = gearAssignments[0]; // Only use the first one
  console.log("🔧 Mapping gear for boat:", assignment.boat);
  console.log("🔧 types_data length:", assignment.types_data?.length || 0);
  
  if (!assignment.types_data || assignment.types_data.length === 0) {
    console.log("✅ No gear types found for this boat - all gears will be false");
    return formUpdate; // Return empty object, form will use defaults (all false)
  }

  assignment.types_data.forEach((type) => {
    const typeKey = NAME_TO_FIELD[type.gear_type?.name];
    if (typeKey) {
      formUpdate[typeKey] = !!type.is_present;
      console.log(`Set ${typeKey} = ${!!type.is_present}`);
    }

    type.subtypes_data?.forEach((sub) => {
      const subtypeKey = NAME_TO_FIELD[sub.gear_subtype?.name];
      if (subtypeKey) {
        formUpdate[subtypeKey] = !!sub.is_present;
        formUpdate[`${subtypeKey}_no`] = sub.quantity || "";
        console.log(`Set ${subtypeKey} = ${!!sub.is_present}, quantity = ${sub.quantity || ""}`);
      }
    });
  });

  return formUpdate;
};



  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    // Restrict tonnage fields to 0-3
    if (["tonnage_length", "tonnage_breadth", "tonnage_depth"].includes(name)) {
      let numValue = parseFloat(value);
      if (isNaN(numValue)) numValue = "";
      else if (numValue < 0) numValue = 0;
      else if (numValue > 3) numValue = 3;
      setFormData((prev) => ({
        ...prev,
        [name]: numValue,
      }));
      return;
    }

    // Special handling for engine_make to auto-set horsepower for Kress and Supremo
    if (name === "engine_make" && (value === "Kress" || value === "Supremo")) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        horsepower: "16", // Auto-set horsepower to 16 for Kress and Supremo
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };

  const handleCancelClick = () => {
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
    setIsCancelModalOpen(false);
    navigate("/admin/boatRegistryManagement");
  };

  if (loading) {
    return (
      <div className="ml-20 h-full bg-gray-50">
        <div className="h-full px-4 py-6">
          <PageTitle value="Edit Boat" />
          <div className="flex justify-center items-center h-[calc(100%-4rem)]">
            <div className="text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-8 pb-15">
      <div className="flex items-center gap-4 mb-6">
        <Button
          type="button"
          onClick={() => navigate("/admin/boatRegistryManagement")}
          variant="icon"
        >
          {/* Back icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
        </Button>
        <PageTitle value="Edit Boat" />
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      <div
        className="space-y-6 relative font-montserrat"
        style={{ fontFamily: "Montserrat, sans-serif" }}
      >
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          {/* Registration Details */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
            Registration Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1st row */}
            <div>
              <label className="block text-sm font-medium">
                MFBR Number <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="mfbr_number"
                  value={formData.mfbr_number}
                  readOnly
                  disabled
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Type of Registration <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <select
                  name="type_of_registration"
                  value={formData.type_of_registration}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Type</option>
                  <option value="New/Initial Registration">
                    New/Initial Registration
                  </option>
                  <option value="Issuance of New Certificate Number">
                    Issuance of New Certificate Number
                  </option>
                  <option value="Re-Issuance of Certificate Number">
                    Re-Issuance of Certificate Number
                  </option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Application Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="application_date"
                value={formData.application_date}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
          {/* Owner/Operator Details */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Owner/Operator Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fisherfolk Registration Number{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="fisherfolk_registration_number"
                  disabled
                  value={formData.fisherfolk_registration_number}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Owner Name <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="owner_name"
                  value={formData.owner_name}
                  disabled
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Owner Address <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="owner_address"
                  value={formData.owner_address}
                  disabled
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fishing Ground <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="fishing_ground"
                  value={formData.fishing_ground}
                  disabled
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                FMA Number <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="fma_number"
                  value={formData.fma_number}
                  disabled
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Homeport <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="homeport"
                  value={formData.homeport}
                  disabled
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                  required
                />
              </div>
            </div>
          </div>
          {/* Boat Information */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Boat Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Boat Name <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="boat_name"
                  value={formData.boat_name}
                  onChange={handleInputChange}
                  placeholder="Enter Boat Name"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Boat Type <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <select
                  name="boat_type"
                  value={formData.boat_type}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Type</option>
                  <option value="Non-Motorized">Non-Motorized</option>
                  <option value="Motorized">Motorized</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Material Used <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <select
                  name="material_used"
                  value={formData.material_used}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Material</option>
                  <option value="Wood">Wood</option>
                  <option value="Fiber Glass">Fiber Glass</option>
                  <option value="Composite">Composite</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Built Place <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="built_place"
                  value={formData.built_place}
                  onChange={handleInputChange}
                  placeholder="Enter Built Place"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Year Built<span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  name="built_year"
                  value={formData.built_year}
                  placeholder="Enter Built Year e.g., 2020"
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  min="2000"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Type of Ownership <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <select
                  name="type_of_ownership"
                  value={formData.type_of_ownership}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Ownership</option>
                  <option value="Individual">Individual</option>
                  <option value="Group">Group</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Engine Make <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <select
                  name="engine_make"
                  value={formData.engine_make}
                  required
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option hidden value="">
                    Select Engine Make
                  </option>
                  <option value="Briggs & Stratton">Briggs & Stratton</option>
                  <option value="Kress">Kress</option>
                  <option value="Supremo">Supremo</option>
                  <option value="Others">Others</option>
                </select>

                {formData.engine_make === "Others" && (
                  <div className="mt-2 ml-6 border-l-2 border-blue-300 pl-4">
                    <input
                      type="text"
                      name="engine_make_other"
                      value={formData.engine_make_other || ""}
                      onChange={handleInputChange}
                      placeholder="Please specify engine make"
                      className="w-full px-4 py-2 border border-blue-300 rounded-lg mt-1"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Serial Number <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="serial_number"
                  value={formData.serial_number}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Horsepower <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                {formData.engine_make === "Briggs & Stratton" ? (
                  <select
                    name="horsepower"
                    value={formData.horsepower}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option hidden value="">
                      Select Horsepower
                    </option>
                    <option value="16">16</option>
                    <option value="20">20</option>
                  </select>
                ) : formData.engine_make === "Kress" ||
                  formData.engine_make === "Supremo" ? (
                  <input
                    type="text"
                    name="horsepower"
                    value={formData.horsepower || "16"}
                    readOnly
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed shadow-sm focus:outline-none"
                  />
                ) : formData.engine_make === "Others" ? (
                  <input
                    type="text"
                    name="horsepower"
                    value={formData.horsepower || ""}
                    onChange={handleInputChange}
                    placeholder="Enter Horsepower"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  // Default input before engine is selected
                  <input
                    type="text"
                    name="horsepower"
                    value={formData.horsepower || ""}
                    onChange={handleInputChange}
                    placeholder="Enter Horsepower"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                No. of Fishers <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  name="no_fishers"
                  value={formData.no_fishers}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  min="1"
                />
              </div>
            </div>
          </div>
          {/* Attachments */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Attachments
          </h2>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Upload Photo <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="file"
                accept="image/*"
                onChange={handlePictureChange}
                className="block w-full max-w-xs text-sm text-gray-600 
        file:mr-4 file:py-2 file:px-4
        file:rounded-lg file:border-0
        file:text-sm file:font-medium
        file:bg-blue-50 file:text-blue-700
        hover:file:bg-blue-100 cursor-pointer"
                required={!formData.boat_image}
              />
            </div>

            {(preview || formData.boat_image) && (
              <div className="mt-3">
                <img
                  src={preview || formData.boat_image}
                  alt="Boat Image"
                  className="w-40 h-40 object-cover rounded-xl border border-gray-300 shadow-md"
                />
              </div>
            )}
          </div>

          {/* Boat Marine Gear Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Boat Marine Gear
          </h2>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-white border rounded-lg shadow-md"
            style={{
              borderColor: "#3863CF",
              maxWidth: "100%",
              boxSizing: "border-box",
            }}
          >
            <GearSection
              label="Surrounding Net"
              mainField="marine_surround_net"
              subItems={[
                {
                  label: "Baby Ring Net",
                  field: "marine_surround_net_babyringnet",
                  quantityField: "marine_surround_net_babyringnet_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Falling Net"
              mainField="marine_falling_net"
              subItems={[
                {
                  label: "Cast Net",
                  field: "marine_falling_net_castnet",
                  quantityField: "marine_falling_net_castnet_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Fishing Aggregating Device/Payao"
              mainField="marine_fishing_aggr_device"
              subItems={[
                {
                  label: "Steel Drum",
                  field: "marine_fishing_aggr_device_steeldrum",
                  quantityField: "marine_fishing_aggr_device_steeldrum_no",
                },
                {
                  label: "Bamboo (Arong)",
                  field: "marine_fishing_aggr_device_bamboo",
                  quantityField: "marine_fishing_aggr_device_bamboo_no",
                },
                {
                  label: "Styropore",
                  field: "marine_fishing_aggr_device_styropore",
                  quantityField: "marine_fishing_aggr_device_styropore_no",
                },
                {
                  label: "Bamboo Raft",
                  field: "marine_fishing_aggr_device_bambooraft",
                  quantityField: "marine_fishing_aggr_device_bambooraft_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Seine Net"
              mainField="marine_seine_net"
              subItems={[
                {
                  label: "Round Haul Seine",
                  field: "marine_seine_net_roundhaulseine",
                  quantityField: "marine_seine_net_roundhaulseine_no",
                },
                {
                  label: "Beach Seine",
                  field: "marine_seine_net_beachseine",
                  quantityField: "marine_seine_net_beachseine_no",
                },
                {
                  label: "Fry Dozer or Gatherer",
                  field: "marine_seine_net_frydozer",
                  quantityField: "marine_seine_net_frydozer_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Scoop Net"
              mainField="marine_scoop_net"
              subItems={[
                {
                  label: "Man Push Net",
                  field: "marine_scoop_net_manpushnet",
                  quantityField: "marine_scoop_net_manpushnet_no",
                },
                {
                  label: "Motorized Boat Push Net",
                  field: "marine_scoop_net_motorizedboatpushnet",
                  quantityField: "marine_scoop_net_motorizedboatpushnet_no",
                },
                {
                  label: "Scoop Net",
                  field: "marine_scoop_net_scoopnetchk",
                  quantityField: "marine_scoop_net_scoopnetchk_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Miscellaneous Gear"
              mainField="marine_miscellaneous_gear"
              subItems={[
                {
                  label: "Gaff Hook",
                  field: "marine_miscellaneous_gear_gaffhook",
                  quantityField: "marine_miscellaneous_gear_gaffhook_no",
                },
                {
                  label: "Rake/Dredge (Sell Collector)",
                  field: "marine_miscellaneous_gear_rakedredge",
                  quantityField: "marine_miscellaneous_gear_rakedredge_no",
                },
                {
                  label: "Squid Luring Device",
                  field: "marine_miscellaneous_gear_squidluringdevice",
                  quantityField:
                    "marine_miscellaneous_gear_squidluringdevice_no",
                },
                {
                  label: "Octopus Luring Device",
                  field: "marine_miscellaneous_gear_octopusluringdevice",
                  quantityField:
                    "marine_miscellaneous_gear_octopusluringdevice_no",
                },
                {
                  label: "Miracle Hole",
                  field: "marine_miscellaneous_gear_miraclehole",
                  quantityField: "marine_miscellaneous_gear_miraclehole_no",
                },
                {
                  label: "Spear Gun",
                  field: "marine_miscellaneous_gear_speargun",
                  quantityField: "marine_miscellaneous_gear_speargun_no",
                },
                {
                  label: "Spear",
                  field: "marine_miscellaneous_gear_spear",
                  quantityField: "marine_miscellaneous_gear_spear_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Lift Net"
              mainField="marine_lift_net"
              subItems={[
                {
                  label: "Bagnet",
                  field: "marine_lift_net_bagnet",
                  quantityField: "marine_lift_net_bagnet_no",
                },
                {
                  label: "Stationary Lift Net",
                  field: "marine_lift_net_stationaryliftnet",
                  quantityField: "marine_lift_net_stationaryliftnet_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Cast Net"
              mainField="marine_cast_net"
              subItems={[
                {
                  label: "Bagnet",
                  field: "marine_cast_net_gillnet",
                  quantityField: "marine_cast_net_gillnet_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Traps and Pots"
              mainField="marine_traps_n_pots"
              subItems={[
                {
                  label: "Lobster Trap",
                  field: "marine_traps_n_pots_lobstertrap",
                  quantityField: "marine_traps_n_pots_lobstertrap_no",
                },
                {
                  label: "Lever Net",
                  field: "marine_traps_n_pots_levernet",
                  quantityField: "marine_traps_n_pots_levernet_no",
                },
                {
                  label: "Shrimp Lift Net",
                  field: "marine_traps_n_pots_shrimpliftnet",
                  quantityField: "marine_traps_n_pots_shrimpliftnet_no",
                },
                {
                  label: "Set Net (Lambaklad)",
                  field: "marine_traps_n_pots_setnet",
                  quantityField: "marine_traps_n_pots_setnet_no",
                },
                {
                  label: "Fish Coral (Baklad)",
                  field: "marine_traps_n_pots_fishcoral",
                  quantityField: "marine_traps_n_pots_fishcoral_no",
                },
                {
                  label: "Flyke Net/Filter Net",
                  field: "marine_traps_n_pots_flykenet",
                  quantityField: "marine_traps_n_pots_flykenet_no",
                },
                {
                  label: "Crab Pot",
                  field: "marine_traps_n_pots_crabpot",
                  quantityField: "marine_traps_n_pots_crabpot_no",
                },
                {
                  label: "Fish Pot",
                  field: "marine_traps_n_pots_fishpot",
                  quantityField: "marine_traps_n_pots_fishpot_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Gill Net"
              mainField="marine_gill_net"
              subItems={[
                {
                  label: "Encircling Gill Net",
                  field: "marine_gill_net_encirclinggillnet",
                  quantityField: "marine_gill_net_encirclinggillnet_no",
                },
                {
                  label: "Crab Entangling Net",
                  field: "marine_gill_net_crabentanglingnet",
                  quantityField: "marine_gill_net_crabentanglingnet_no",
                },
                {
                  label: "Trammel Net",
                  field: "marine_gill_net_trammelnet",
                  quantityField: "marine_gill_net_trammelnet_no",
                },
                {
                  label: "Bottom Set Gill Net",
                  field: "marine_gill_net_bottomsetgillnet",
                  quantityField: "marine_gill_net_bottomsetgillnet_no",
                },
                {
                  label: "Midwater Set Gill Net",
                  field: "marine_gill_net_midwatersetgillnet",
                  quantityField: "marine_gill_net_midwatersetgillnet_no",
                },
                {
                  label: "Surface Gill Net (Largarete)",
                  field: "marine_gill_net_surfacegillnet",
                  quantityField: "marine_gill_net_surfacegillnet_no",
                },
                {
                  label: "Small Pelagic Drift Gill Net (Small Mesh)",
                  field: "marine_gill_net_smallpelagicdrift",
                  quantityField: "marine_gill_net_smallpelagicdrift_no",
                },
                {
                  label: "Tuna/Bill Fish Drift Gill Net (Large Mesh)",
                  field: "marine_gill_net_tunabillfishdrift",
                  quantityField: "marine_gill_net_tunabillfishdrift_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Hook and Line"
              mainField="marine_hook_n_line"
              formData={formData}
              handleInputChange={handleInputChange}
              subItemGroups={[
                {
                  sectionLabel: "Multiple Hook and Line (MHL)",
                  items: [
                    {
                      field: "marine_hook_n_line_demersalmhl",
                      label: "Demersal MHL",
                      quantityField: "marine_hook_n_line_demersalmhl_no",
                    },
                    {
                      field: "marine_hook_n_line_tunamhl",
                      label: "Tuna MHL",
                      quantityField: "marine_hook_n_line_tunamhl_no",
                    },
                    {
                      field: "marine_hook_n_line_smallpelagicmhl",
                      label: "Small Pelagic MHL",
                      quantityField: "marine_hook_n_line_smallpelagicmhl_no",
                    },
                  ],
                },
                {
                  sectionLabel: "Simple-Handline (Single Hook and Line)",
                  items: [
                    {
                      field: "marine_hook_n_line_tunahandline",
                      label: "Tuna Handline",
                      quantityField: "marine_hook_n_line_tunahandline_no",
                    },
                    {
                      field: "marine_hook_n_line_threadfinbream",
                      label: "Threadfin Bream/Snapper (Demersal & Reef Fishes)",
                      quantityField: "marine_hook_n_line_threadfinbream_no",
                    },
                    {
                      field: "marine_hook_n_line_mackarelscad",
                      label: "Mackerel/Scad (Small Pelagics)",
                      quantityField: "marine_hook_n_line_mackarelscad_no",
                    },
                  ],
                },
              ]}
            />
          </div>

           {/* Boat Inland Gear Section */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
              Boat Inland Gear
            </h2>
            <div
              className="grid grid-cols-3 gap-4 p-4 bg-white border rounded-lg shadow-md col-start-1 row-end-4"
              style={{
                borderColor: "#3863CF",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <GearSection
              label="Hook and Line"
              mainField="inland_hook_n_line"
              subItems={[
                {
                  label: "Pole and Line",
                  field: "inland_hook_n_line_polenline",
                  quantityField: "inland_hook_n_line_polenline_no",
                },
                {
                  label: "Stationary Stick and Line",
                  field: "inland_hook_n_line_stationarystick",
                  quantityField: "inland_hook_n_line_stationarystick_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Set Longline"
              mainField="inland_set_longline"
              subItems={[
                {
                  label: "Bottom Set Longline",
                  field: "inland_set_longline_bottomsetlongline",
                  quantityField: "inland_set_longline_bottomsetlongline_no",
                },
                {
                  label: "Surface Set Longline",
                  field: "inland_set_longline_surfacesetlongline",
                  quantityField: "inland_set_longline_surfacesetlongline_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Gill Net"
              mainField="inland_gill_net"
              subItems={[
                {
                  label: "Surface Gill Net",
                  field: "inland_gill_net_surfacegillnet",
                  quantityField: "inland_gill_net_surfacegillnet_no",
                },
                {
                  label: "Bottom Gill Net",
                  field: "inland_gill_net_bottomgillnet",
                  quantityField: "inland_gill_net_bottomgillnet_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Traps and Pots"
              mainField="inland_traps_n_pots"
              subItems={[
                {
                  label: "Fish Pot (Wire/Bamboo/Net)",
                  field: "inland_traps_n_pots_fishpottp",
                  quantityField: "inland_traps_n_pots_fishpottp_no",
                },
                {
                  label: "Fish Trap (Bamboo/Net)",
                  field: "inland_traps_n_pots_fishtraptp",
                  quantityField: "inland_traps_n_pots_fishtraptp_no",
                },
                {
                  label: "Shrimp Trap (Bamboo/Net)",
                  field: "inland_traps_n_pots_shrimptraptp",
                  quantityField: "inland_traps_n_pots_shrimptraptp_no",
                },
                {
                  label: "Bamboo Wire/Trap (Asar)",
                  field: "inland_traps_n_pots_bamboowiretrap",
                  quantityField: "inland_traps_n_pots_bamboowiretrap_no",
                },
                {
                  label: "Flyke Net",
                  field: "inland_traps_n_pots_flyketnettp",
                  quantityField: "inland_traps_n_pots_flyketnettp_no",
                },
                {
                  label: "Fish Corral (Baklad)",
                  field: "inland_traps_n_pots_fishcorraltp",
                  quantityField: "inland_traps_n_pots_fishcorraltp_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Falling Gears"
              mainField="inland_falling_gears"
              subItems={[
                {
                  label: "Cast Net",
                  field: "inland_falling_gears_castnetfg",
                  quantityField: "inland_falling_gears_castnetfg_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Scoop Net"
              mainField="inland_scoop_net"
              subItems={[
                {
                  label: "Man Push Net",
                  field: "inland_scoop_net_manpushnetsn",
                  quantityField: "inland_scoop_net_manpushnetsn_no",
                },
                {
                  label: "Scoop Net",
                  field: "inland_scoop_net_scoopnetsn",
                  quantityField: "inland_scoop_net_scoopnetsn_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            <GearSection
              label="Miscellaneous Gear"
              mainField="inland_miscellaneous_gear"
              subItems={[
                {
                  label: "Spear (Sibat)",
                  field: "inland_miscellaneous_gear_spearmg",
                  quantityField: "inland_miscellaneous_gear_spearmg_no",
                },
                {
                  label: "Spear Gun",
                  field: "inland_miscellaneous_gear_speargunmg",
                  quantityField: "inland_miscellaneous_gear_speargunmg_no",
                },
              {
                  label: "Rake/Dredge",
                  field: "inland_miscellaneous_gear_rakedredgemg",
                  quantityField: "inland_miscellaneous_gear_rakedredgemg_no",
                },
                {
                  label: "Fish Shelter",
                  field: "inland_miscellaneous_gear_fishsheltermg",
                  quantityField: "inland_miscellaneous_gear_fishsheltermg_no",
                },
              ]}
              formData={formData}
              handleInputChange={handleInputChange}
            />

            </div>
        </div>
        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" variant="secondary" onClick={handleCancelClick}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Changes"
        message="Are you sure you want to cancel? Any unsaved changes will be lost."
        confirmText="Yes, Cancel"
        cancelText="No, Keep Editing"
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        message="Boat information has been successfully updated!"
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/admin/boatRegistryManagement");
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm Update"
        message="Are you sure you want to save these changes to the boat information?"
      />
    </div>
  );
};

export default EditBoat;
