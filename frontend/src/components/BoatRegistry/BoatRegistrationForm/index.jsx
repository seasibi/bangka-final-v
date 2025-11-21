import React, { useState, useEffect, useRef } from "react";
import { getFisherfolk } from "../../../services/fisherfolkService";
import { apiClient } from "../../../services/api_urls";
import PropTypes from "prop-types";
import { GEAR_MAP } from "../../../constants/gearMap";
import FisherfolkSearchForm from "../FisherfolkSearchForm";
import RegistrationDetails from "./RegistrationDetails";
import { getMunicipalities } from "../../../services/municipalityService";
import { useAuth } from "../../../contexts/AuthContext";

// Normalize municipality names for comparison (treat aliases equally, case-insensitive)
const normalizeMunicipality = (name) => {
  const raw = (name || "").toString().trim();
  const s = raw.toLowerCase();
  if (!s) return raw;
  const map = new Map([
    ["san fernando", "San Fernando"],
    ["city of san fernando", "San Fernando"],
    ["sto. tomas", "Santo Tomas"],
    ["santo tomas", "Santo Tomas"],
  ]);
  return map.get(s) || raw;
};
const muniInList = (name, list) => {
  const n = normalizeMunicipality(name);
  return list.some((m) => normalizeMunicipality(m) === n);
};
import BoatProfile from "./BoatProfile";
import BoatDimensions from "./BoatDimensions";
import ConfirmDetails from "./ConfirmDetails";
import { getSignatories } from "../../../services/signatoriesService";
import axios from "axios";
import {
  getBoats,
  createBoat,
  createBoatMeasurements,
  createBoatGearTypeAssignment,
  createBoatGearSubtypeAssignment,
  createOrGetBoatGearAssignment,
  getBoatById,
} from "../../../services/boatService";
import Loader from "../../Loader";
import AlertModal from "../../AlertModal";
import ConfirmModal from "../../ConfirmModal";
import { useLocation } from "react-router-dom";

const formatNameWithMiddleInitial = (first, middle, last) => {
  const f = (first || "").trim();
  const l = (last || "").trim();
  const m = (middle || "").trim();
  const middleInitial = m ? m.charAt(0).toUpperCase() + "." : "";
  return [f, middleInitial, l].filter(Boolean).join(" ");
};

const steps = [
  "Fisherfolk Search", // step 0
  "Registration Details", // step 1
];

const BoatRegistrationForm = ({ onSubmit, initialData, anotherAction }) => {
  const location = useLocation();
  const fisherfolkFromState = location.state?.fisherfolk;
  const initialFromNav = location?.state?.initialData;

  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(
    initialData.fisherfolk_registration_number ? 1 : 0
  );
  const [loading, setLoading] = useState(false);
  const [latestFisherfolk, setLatestFisherfolk] = useState([]);
  const [selectedFisherfolkId, setSelectedFisherfolkId] = useState(null);
  const [selectedFisherfolk, setSelectedFisherfolk] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });
  const [showAnotherModal, setShowAnotherModal] = useState(false);
  const lastSubmissionRef = useRef(null);
  const anotherKeyRef = useRef(anotherAction?.id ?? 0);
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [mfbrMunicipality, setMfbrMunicipality] = useState("");
  const [mfbrNumber, setMfbrNumber] = useState("");

  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [boatNameError, setBoatNameError] = useState("");
  const [isCheckingBoatName, setIsCheckingBoatName] = useState(false);
  const [mfbrCheck, setMfbrCheck] = useState({ status: "idle" }); // idle|checking|available|taken

  // When the parent page confirms Another + picks reuse/clear, apply here
  useEffect(() => {
    const currentId = anotherAction?.id ?? 0;
    if (anotherKeyRef.current !== currentId) {
      anotherKeyRef.current = currentId;
      try {
        applyRegisterAnother(!!anotherAction?.reuse);
      } catch (e) {
        console.error('applyRegisterAnother failed', e);
      }
    }
  }, [anotherAction]);
  const boatNameTimeout = useRef(null);

  // Signatories for Certification section
  const [signatories, setSignatories] = useState({
    fisheryCoordinator: null,
    notedBy: null
  });
  const [loadingSignatories, setLoadingSignatories] = useState(false);
  const [municipalitiesList, setMunicipalitiesList] = useState([]);

  // Fix: Define currentDate before using it in formData
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const currentDate = `${yyyy}-${mm}-${dd}`;

  // Helper function to populate form data from fisherfolk
  const populateFormDataFromFisherfolk = (fisherfolk) => {
    const fma_number = fisherfolk.fma_number || "";
    const fishing_ground = fisherfolk.fishing_ground || "";

    const address = fisherfolk.address || {};
    const street = address.street || fisherfolk.street || "";
    const barangay = address.barangay || fisherfolk.barangay || "";
    const municipality = fisherfolk.municipality || address.municipality || "";
    const muniNorm = normalizeMunicipality(municipality);
    const province = address.province || fisherfolk.province || "La Union";

    let addressParts = [];
    if (street) addressParts.push(street);
    if (barangay) addressParts.push(barangay);
    if (municipality) addressParts.push(municipality);
    if (province && addressParts.length > 0) addressParts.push(province);
    const finalAddress =
      addressParts.length > 0
        ? addressParts.join(", ")
        : province || "Address not specified";

    // Auto-set MFBR municipality from fisherfolk (normalize aliases)
    setMfbrMunicipality(muniNorm);

    setFormData((prev) => ({
      ...prev,
      fisherfolk_registration_number: fisherfolk.registration_number || "",
      owner_name: `${fisherfolk.first_name} ${fisherfolk.middle_name ? fisherfolk.middle_name.charAt(0) + ". " : ""}${fisherfolk.last_name}`,
      owner_address: finalAddress,
      homeport: "Lingayen Gulf",
      fma_number,
      fishing_ground: fishing_ground,
      is_active: true,
    }));
  };

  useEffect(() => {
    if (fisherfolkFromState) {
      const regNum = fisherfolkFromState.registration_number || "";
      setSelectedFisherfolkId(regNum);
      setSelectedFisherfolk(fisherfolkFromState);
      // Populate form data when coming from Add Fisherfolk
      populateFormDataFromFisherfolk(fisherfolkFromState);
      setCurrentStep(1);
    } else if (initialFromNav) {
      setFormData((prev) => ({ ...prev, ...initialFromNav }));
      setCurrentStep(1);
    } else if (initialData?.fisherfolk_registration_number) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        fisherfolk_registration_number:
          initialData.fisherfolk_registration_number || "",
        owner_name: initialData.owner_name || "",
        owner_address: initialData.owner_address || "",
        homeport: initialData.homeport || "",
        fma_number: initialData.fma_number || "",
        fishing_ground: initialData.fishing_ground || "",
      }));
      setCurrentStep(1);
    } else {
      setCurrentStep(0);
    }
  }, [fisherfolkFromState, initialFromNav, initialData]);

  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setAlertModal({
          isOpen: true,
          title: "Invalid File Type",
          message: "Please upload an image file."
        });
        return;
      }

      // store file object in formData
      setFormData((prev) => ({
        ...prev,
        boat_image: file, // real file, not base64
      }));

      // generate preview (without touching formData)
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result); // base64 only for preview
      };
      reader.readAsDataURL(file);
    }
  };


  // Fetch latest fisherfolk for quick selection
  useEffect(() => {
    const fetchLatestFisherfolk = async () => {
      try {
        const allFisherfolk = await getFisherfolk();

        // Define coastal municipalities
        const coastalMunicipalities = [
          "Agoo", "Aringay", "Bacnotan", "Balaoan", "Bangar",
          "Bauang", "Caba", "Luna", "Rosario", "San Fernando",
          "San Juan", "Santo Tomas", "Sudipen"
        ];

        // Fetch addresses for all active fisherfolk
        const activeFisherfolk = allFisherfolk.filter(f => f.is_active === true);
        const addressPromises = activeFisherfolk.map(async (fisherfolk) => {
          try {
            const res = await apiClient.get(
              `/addresses/?fisherfolk=${fisherfolk.registration_number}`
            );
            if (Array.isArray(res.data) && res.data.length > 0) {
              return { ...fisherfolk, address: res.data[0] };
            }
          } catch (err) {
            console.error(`Failed to fetch address for ${fisherfolk.registration_number}`, err);
          }
          return fisherfolk;
        });

        const fisherfolkWithAddresses = await Promise.all(addressPromises);

        // Filter by coastal municipalities and sort
        let latest = fisherfolkWithAddresses
          .filter(f => {
            const municipality = f.address?.municipality || f.municipality;
            const isCoastal = muniInList(municipality, coastalMunicipalities);
            return isCoastal;
          });

        // If logged-in user is a Municipal Agriculturist, restrict to their municipality
        if (user?.user_role === "municipal_agriculturist" && user?.municipality) {
          latest = latest.filter(f => {
            const municipality = f.address?.municipality || f.municipality;
            return muniInList(municipality, [user.municipality]);
          });
        }

        latest = latest
          .sort((a, b) => new Date(b.date_added) - new Date(a.date_added))
          .slice(0, 8);
        setLatestFisherfolk(latest);
      } catch (error) {
        console.error("Error fetching latest fisherfolk:", error);
      }
    };
    fetchLatestFisherfolk();
  }, [user]);

  // Municipality codes mapping
  const municipalityCodes = {
    "Agoo": "AGO",
    "Aringay": "ARI",
    "Bacnotan": "BAC",
    "Balaoan": "BAL",
    "Bangar": "BNG",
    "Bauang": "BAU",
    "Caba": "CAB",
    "Luna": "LUN",
    "Rosario": "ROS",
    "San Fernando": "CSF",
    "San Juan": "SJN",
    "Santo Tomas": "STO",
    "Sudipen": "SUD"
  };

  const [formData, setFormData] = useState({
    // Boat
    mfbr_number: "",
    application_date: currentDate,
    type_of_registration: "New/Initial Registration",
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

    // BoatMarineGear
    marine_surround_net: false,
    marine_surround_net_no: "",
    falling_net: false,
    falling_net_no: "",
    seine_net: false,
    seine_net_no: "",
    scoop_net: false,
    scoop_net_no: "",
    lift_net: false,
    lift_net_no: "",
    gill_net: false,
    gill_net_no: "",
    fishing_aggr_device: false,
    fishing_aggr_device_no: "",
    traps_n_pots: false,
    traps_n_pots_no: "",
    miscellaneous_gear: false,
    miscellaneous_gear_no: "",

    // BoatInlandGear
    inland_hook_n_line: false,
    inland_hook_n_line_no: "",
    inland_set_longline: false,
    inland_set_longline_no: "",
    inland_traps_n_pots: false,
    inland_traps_n_pots_no: "",
    inland_falling_gears: false,
    inland_falling_gears_no: "",
    inland_scoop_net: false,
    inland_scoop_net_no: "",
    inland_gill_net: false,
    inland_gill_net_no: "",
    inland_miscellaneous_gear: false,
    inland_miscellaneous_gear_no: "",

    // Image
    boat_image: null,
    ...initialData,
    ...initialFromNav,
  });

  // Restore preview from boat_image if it exists (when navigating back)
  useEffect(() => {
    if (formData.boat_image && formData.boat_image instanceof File && !preview) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(formData.boat_image);
    }
  }, [currentStep, formData.boat_image, preview]);

  // Parse existing MFBR number when form is loaded with data
  useEffect(() => {
    if (formData.mfbr_number && !mfbrMunicipality && !mfbrNumber) {
      // Parse format: LU-XX-###
      const match = formData.mfbr_number.match(/^LU-([A-Z]{2})-(\d{1,3})$/);
      if (match) {
        const code = match[1];
        const number = match[2];

        // Municipality codes for parsing
        const codes = {
          "Agoo": "AO", "Aringay": "AR", "Bacnotan": "BC", "Balaoan": "BL",
          "Bangar": "BN", "Bauang": "BU", "Caba": "CB", "Luna": "LN",
          "Rosario": "RS", "San Fernando City": "SF", "San Juan": "SJ",
          "Santo Tomas": "ST", "Sudipen": "SD"
        };

        // Find municipality by code
        const municipality = Object.keys(codes).find(
          key => codes[key] === code
        );

        if (municipality) {
          setMfbrMunicipality(municipality);
          setMfbrNumber(number);
        }
      }
    }
  }, [formData.mfbr_number, mfbrMunicipality, mfbrNumber]);

  // Debounced MFBR uniqueness check
  useEffect(() => {
    let timer;
    const code = mfbrMunicipality ? municipalityCodes[mfbrMunicipality] : "";
    const padded = (mfbrNumber || "").padStart(3, "0");
    const full = code && mfbrNumber ? `LU-${code}-${padded}` : null;
    if (!full) {
      setMfbrCheck({ status: "idle" });
      return;
    }
    setMfbrCheck({ status: "checking" });
    timer = setTimeout(async () => {
      try {
        await getBoatById(full);
        setMfbrCheck({ status: "taken" });
      } catch (e) {
        if (e?.response?.status === 404) {
          setMfbrCheck({ status: "available" });
        } else {
          setMfbrCheck({ status: "idle" });
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [mfbrMunicipality, mfbrNumber]);

  // Fetch signatories when municipality is available (for step 2 confirmation)
  useEffect(() => {
    // load municipalities once for mapping name -> id
    let mounted = true;
    (async () => {
      try {
        const list = await getMunicipalities();
        if (mounted) setMunicipalitiesList(Array.isArray(list) ? list : []);
      } catch (e) {
        if (mounted) setMunicipalitiesList([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch signatories when municipality is available (for step 2 confirmation)
  useEffect(() => {
    const fetchSignatories = async () => {
      // Get municipality from either mfbrMunicipality or formData
      const municipalityName = mfbrMunicipality || formData.municipality;
      if (!municipalityName) {
        return;
      }

      try {
        setLoadingSignatories(true);
        // Map municipality name -> id for API filter
        const muni = (municipalitiesList || []).find(
          (m) => normalizeMunicipality(m.name) === normalizeMunicipality(municipalityName)
        );
        const municipality_id = muni?.municipality_id;
        const allSignatories = municipality_id
          ? await getSignatories({ municipality_id })
          : await getSignatories();

        // Find Municipal Fishery Coordinator (for Enumerator)
        const fisheryCoordinator = allSignatories.find(
          sig => sig.position === 'Municipal Fishery Coordinator' &&
            (sig.municipality?.id === municipality_id || sig.municipality_id === municipality_id)
        );

        // Find Noted By (Priority: Municipal Agriculturist > Provincial Agriculturist)
        const municipalAgriculturist = allSignatories.find(
          sig => sig.position === 'Municipal Agriculturist' &&
            (sig.municipality?.id === municipality_id || sig.municipality_id === municipality_id)
        );

        // If no municipal agriculturist, try to get provincial agriculturist
        let notedBy = municipalAgriculturist;
        if (!notedBy) {
          // Fetch Provincial Agriculturist (not municipality-specific)
          const provincialSigs = await getSignatories();
          notedBy = provincialSigs.find(sig => sig.position === 'Provincial Agriculturist');
        }

        setSignatories({
          fisheryCoordinator,
          notedBy
        });
      } catch (error) {
        console.error('Error fetching signatories:', error);
      } finally {
        setLoadingSignatories(false);
      }
    };

    fetchSignatories();
  }, [mfbrMunicipality, formData.municipality]);

  const handleFisherfolkSelect = (fisherfolk) => {
    const regNum = fisherfolk.registration_number || "";

    // Toggle selection: if clicking the same fisherfolk, unselect it
    if (selectedFisherfolkId === regNum) {
      setSelectedFisherfolkId(null);
      setSelectedFisherfolk(null);
    } else {
      // Set selected fisherfolk for visual feedback (highlighting)
      setSelectedFisherfolkId(regNum);
      setSelectedFisherfolk(fisherfolk);
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 0: {
        if (!selectedFisherfolk) {
          setErrorModal({ isOpen: true, message: "Please select a fisherfolk to continue." });
          return false;
        }
        return true;
      }
      case 1: {
        const missingFields = [];
        if (!formData.type_of_ownership)
          missingFields.push("Type of Ownership");
        if (!formData.no_fishers) missingFields.push("Number of Fishers");
        if (!formData.homeport) missingFields.push("Homeport");
        if (missingFields.length > 0) {
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const handleNext = (e) => {
    if (e) {
      e.preventDefault();
    }
    if (validateStep(currentStep)) {
      // If moving from step 0, populate form data with selected fisherfolk
      if (currentStep === 0 && selectedFisherfolk) {
        populateFormDataFromFisherfolk(selectedFisherfolk);
      }
      setCurrentStep((prev) => prev + 1);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // We have 3 logical steps in renderStep: 0, 1, and 2 (review/confirmation).
    // Only when we're on the last logical step (2) should we show the confirm modal.
    const LAST_STEP_INDEX = 2;

    if (currentStep < LAST_STEP_INDEX) {
      handleNext();
      return;
    }

    // Show confirmation modal on final step
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    // Close the confirm modal before running the full submit flow
    setShowConfirmModal(false);
    setLoading(true);
    try {
      // --------- 1. Boat creation (FormData, with file) ---------
      const formDataObj = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, value);
      });

      const createdBoat = await createBoat(formDataObj);
      const mfbr_number = createdBoat.mfbr_number; // primary key
      // --------- 2. Boat measurements (JSON) ---------
      const measurementPayload = {
        boat: mfbr_number,
        registered_length: formData.registered_length,
        registered_breadth: formData.registered_breadth,
        registered_depth: formData.registered_depth,
        tonnage_length: formData.tonnage_length,
        tonnage_breadth: formData.tonnage_breadth,
        tonnage_depth: formData.tonnage_depth,
        gross_tonnage: formData.gross_tonnage,
        net_tonnage: formData.net_tonnage,
      };

      await createBoatMeasurements(measurementPayload);
      // --------- 3. Gear assignments (JSON) ---------

      const gearAssignment = await createOrGetBoatGearAssignment(
        formData.mfbr_number
      );

      const typesRes = await axios.get("/api/gear-types/");
      const subsRes = await axios.get("/api/gear-subtypes/");

      const gearTypes = typesRes.data;
      const gearSubtypes = subsRes.data;

      // Normalizer
      const norm = (s) =>
        (s || "")
          .toString()
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");

      // 🔹 Build lookup maps
      const typeIdByName = new Map(
        (gearTypes || []).map((t) => [norm(t.name), t.id])
      );
      const subtypeIdByName = new Map(
        (gearSubtypes || []).map((s) => [norm(s.name), s.id])
      );

      const assignments = [];

      Object.entries(formData).forEach(([key, value]) => {
        const mapEntry = GEAR_MAP[key];

        // 🔹 Handle gear TYPES from their checkbox fields
        if (mapEntry && mapEntry.kind === "type" && value === true) {
          const lookupName = norm(mapEntry.name);
          const typeId = typeIdByName.get(lookupName);
          if (typeId) {
            assignments.push({
              boat_gear_assignment: gearAssignment.id,
              gear_type: typeId, // ✅ real DB ID
              is_present: true,
            });
          } else {
            console.warn("⚠️ Gear type not found:", mapEntry.name);
          }
        }

        // 🔹 Handle gear SUBTYPES from their quantity fields ("*_no"),
        // similar to EditBoat.updateBoatGears
        if (key.endsWith("_no")) {
          const baseField = key.replace("_no", "");
          const baseEntry = GEAR_MAP[baseField];
          if (!baseEntry || baseEntry.kind !== "subtype") return;

          // Only create a subtype assignment if the corresponding checkbox is checked
          const isChecked = !!formData[baseField];
          if (!isChecked) return;

          const qty = parseInt(value, 10) || 0;
          if (!qty) return; // skip zero/empty quantities

          const lookupName = norm(baseEntry.name);
          const subId = subtypeIdByName.get(lookupName);
          if (subId) {
            assignments.push({
              boat_gear_assignment: gearAssignment.id,
              gear_subtype: subId, // ✅ real DB ID
              quantity: qty,
              is_present: true,
            });
          } else {
            console.warn("⚠️ Gear subtype not found:", baseEntry.name);
          }
        }
      });

      // POST each assignment
      for (const gear of assignments) {
        try {
          let payload = { ...gear };

          if (gear.gear_subtype) {
            // ✅ rename to gear_subtype_id
            payload = {
              ...gear,
              gear_subtype_id: gear.gear_subtype,
            };
            delete payload.gear_subtype;

            await createBoatGearSubtypeAssignment(payload);
          } else if (gear.gear_type) {
            // ✅ rename to gear_type_id
            payload = {
              ...gear,
              gear_type_id: gear.gear_type,
            };
            delete payload.gear_type;

            await createBoatGearTypeAssignment(payload);
          }
        } catch (err) {
          console.error("❌ Error saving gear:", err.response?.data || err);
        }
      }

      // Store last submission and a snapshot of current technical fields for reuse
      const snapshot = {
        boat_type: formData.boat_type,
        material_used: formData.material_used,
        built_place: formData.built_place,
        built_year: formData.built_year,
        type_of_ownership: formData.type_of_ownership,
        engine_make: formData.engine_make,
        horsepower: formData.horsepower,
        no_fishers: formData.no_fishers,
        registered_length: formData.registered_length,
        registered_breadth: formData.registered_breadth,
        registered_depth: formData.registered_depth,
        tonnage_length: formData.tonnage_length,
        tonnage_breadth: formData.tonnage_breadth,
        tonnage_depth: formData.tonnage_depth,
        gross_tonnage: formData.gross_tonnage,
        net_tonnage: formData.net_tonnage,
        // include gear selections if present
        ...Object.fromEntries(Object.entries(formData).filter(([k]) => k.includes('_gear') || k.endsWith('_no'))),
      };
      lastSubmissionRef.current = { createdBoat, snapshot };
      // Immediately notify parent to show Success modal
      if (typeof onSubmit === 'function') {
        onSubmit({ ...formData, ...(lastSubmissionRef.current || {}) }, true);
      }
    } catch (err) {
      console.error(
        "Boat registration error:",
        err.response?.data || err.message
      );
      let errorMsg = "Failed to submit boat registration.";

      // Parse error response for better display
      if (err?.response?.data) {
        const errorData = err.response.data;

        // Handle field-specific errors (e.g., boat_name unique constraint)
        if (typeof errorData === 'object' && !Array.isArray(errorData)) {
          const errorMessages = [];
          for (const [field, messages] of Object.entries(errorData)) {
            // Format field name (boat_name -> Boat Name)
            const formattedField = field
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            if (Array.isArray(messages)) {
              errorMessages.push(`${formattedField}: ${messages.join(', ')}`);
            } else {
              errorMessages.push(`${formattedField}: ${messages}`);
            }
          }
          errorMsg = errorMessages.join('\n');
        } else if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else {
          errorMsg = JSON.stringify(errorData, null, 2);
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      // Show error in modal
      setAlertModal({
        isOpen: true,
        title: "Registration Failed",
        message: errorMsg
      });
      console.error("Boat registration error:", err);
    }
    setLoading(false);
  };

  const applyRegisterAnother = (reuseDetails) => {
    try {
      console.log("[applyRegisterAnother] reuseDetails=", reuseDetails);
    } catch (e) { }
    // Base fields always retained (context and owner)
    const baseKept = {
      application_date: formData.application_date,
      type_of_registration: formData.type_of_registration,
      fisherfolk_registration_number: formData.fisherfolk_registration_number,
      owner_name: formData.owner_name,
      owner_address: formData.owner_address,
      fishing_ground: formData.fishing_ground,
      fma_number: formData.fma_number,
      homeport: formData.homeport,
      is_active: true,
    };

    // Technical + measurement fields (reuse from snapshot to avoid stale/cleared formData)
    const snap = lastSubmissionRef.current?.snapshot || {};
    const technical = reuseDetails
      ? {
        boat_type: snap.boat_type || "",
        material_used: snap.material_used || "",
        built_place: snap.built_place || "",
        built_year: snap.built_year || "",
        type_of_ownership: snap.type_of_ownership || "",
        engine_make: snap.engine_make || "",
        horsepower: snap.horsepower || "",
        no_fishers: snap.no_fishers || "",
        registered_length: snap.registered_length || "",
        registered_breadth: snap.registered_breadth || "",
        registered_depth: snap.registered_depth || "",
        tonnage_length: snap.tonnage_length || "",
        tonnage_breadth: snap.tonnage_breadth || "",
        tonnage_depth: snap.tonnage_depth || "",
        gross_tonnage: snap.gross_tonnage || "",
        net_tonnage: snap.net_tonnage || "",
      }
      : {
        boat_type: '',
        material_used: '',
        built_place: '',
        built_year: '',
        type_of_ownership: '',
        engine_make: '',
        horsepower: '',
        no_fishers: '',
        registered_length: '',
        registered_breadth: '',
        registered_depth: '',
        tonnage_length: '',
        tonnage_breadth: '',
        tonnage_depth: '',
        gross_tonnage: '',
        net_tonnage: '',
      };

    // Optionally reuse gear selections when reusing details
    const gearPart = reuseDetails
      ? Object.fromEntries(
        Object.entries(snap).filter(([k]) => k.includes('_gear') || k.endsWith('_no'))
      )
      : {};

    // Compute MFBR prefix (keep municipality code) but blank number
    let newMfbrNumber = '';
    if (mfbrMunicipality) {
      const code = municipalityCodes[mfbrMunicipality];
      newMfbrNumber = code ? `LU-${code}-` : '';
    }

    const nextData = {
      ...formData,
      ...baseKept,
      ...technical,
      ...gearPart,
      mfbr_number: newMfbrNumber,
      boat_name: '',
      serial_number: '',
      boat_image: null,
    };
    try {
      console.log("[applyRegisterAnother] nextData preview:", {
        boat_type: nextData.boat_type,
        material_used: nextData.material_used,
        built_place: nextData.built_place,
        built_year: nextData.built_year,
        type_of_ownership: nextData.type_of_ownership,
        engine_make: nextData.engine_make,
        horsepower: nextData.horsepower,
        no_fishers: nextData.no_fishers,
        registered_length: nextData.registered_length,
        registered_breadth: nextData.registered_breadth,
        registered_depth: nextData.registered_depth,
        tonnage_length: nextData.tonnage_length,
        tonnage_breadth: nextData.tonnage_breadth,
        tonnage_depth: nextData.tonnage_depth,
        gross_tonnage: nextData.gross_tonnage,
        net_tonnage: nextData.net_tonnage,
      });
    } catch (e) { }
    setFormData(nextData);
    setPreview(null);
    setMfbrNumber('');
    setErrors({});
    // Go back to details step 1
    setCurrentStep(1);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { }
  };

  const handleDoNotRegisterAnother = () => {
    setShowAnotherModal(false);
    // Proceed with original parent callback if provided
    if (typeof onSubmit === 'function') {
      onSubmit({ ...formData, ...(lastSubmissionRef.current || {}) }, true);
    }
  };

  // Handle MFBR number change (3 digits)
  const handleMfbrNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    const limitedValue = value.slice(0, 3); // Limit to 3 digits
    setMfbrNumber(limitedValue);

    // Update formData with complete MFBR number
    if (mfbrMunicipality && limitedValue) {
      const code = municipalityCodes[mfbrMunicipality];
      const paddedNumber = limitedValue.padStart(3, '0');
      setFormData((prev) => ({
        ...prev,
        mfbr_number: `LU-${code}-${paddedNumber}`
      }));
    } else if (mfbrMunicipality) {
      const code = municipalityCodes[mfbrMunicipality];
      setFormData((prev) => ({
        ...prev,
        mfbr_number: `LU-${code}-`
      }));
    }
  };

  const dimensionLimits = {
    registered_length: { min: 20, max: 25 },
    registered_breadth: { min: 0.75, max: 0.8 },
    registered_depth: { min: 0.75, max: 0.8 },
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    // Restrict registered dimensions
    if (["registered_length", "registered_breadth", "registered_depth"].includes(name)) {
      let numValue = parseFloat(value);
      if (isNaN(numValue)) {
        numValue = "";
      } else {
        const limits = dimensionLimits[name];
        if (limits) {
          const { min, max } = limits;
          if (typeof min === "number" && typeof max === "number") {
            numValue = Math.max(min, Math.min(max, numValue));
          }
        }
      }

      setFormData((prev) => ({
        ...prev,
        [name]: numValue === "" ? "" : numValue,
      }));
      return;
    }

    // Restrict tonnage fields to 1-3
    if (["tonnage_length", "tonnage_breadth", "tonnage_depth"].includes(name)) {
      let numValue = parseFloat(value);
      if (isNaN(numValue)) numValue = "";
      else if (numValue < 1) numValue = 1;
      else if (numValue > 3) numValue = 3;

      // Update form data with the new tonnage value
      const updatedFormData = {
        ...formData,
        [name]: numValue,
      };
      setFormData(updatedFormData);

      // Auto-calculate tonnage if all three fields are filled
      const length = parseFloat(updatedFormData.tonnage_length) || 0;
      const breadth = parseFloat(updatedFormData.tonnage_breadth) || 0;
      const depth = parseFloat(updatedFormData.tonnage_depth) || 0;

      if (length > 0 && breadth > 0 && depth > 0) {
        const gross = (depth * length * breadth * 0.7) / 2.83;
        const net = gross * 0.9;
        setFormData((prev) => ({
          ...prev,
          [name]: numValue,
          gross_tonnage: gross.toFixed(2),
          net_tonnage: net.toFixed(2),
        }));
      }
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

    const newVal = type === "checkbox" ? checked : type === "file" ? files[0] : value;
    setFormData((prev) => ({
      ...prev,
      [name]: newVal,
    }));

    // Live validate certain fields
    try {
      validateField(name, newVal);
    } catch (err) {
      console.error('validateField error', err);
    }
  };

  const validateField = (name, value) => {
    const newErrors = { ...(errors || {}) };
    switch (name) {
      case 'boat_name': {
        if (!value || value.trim() === '') {
          newErrors.boat_name = 'Boat name is required.';
        } else {
          delete newErrors.boat_name;
          // Debounced uniqueness check
          if (boatNameTimeout.current) clearTimeout(boatNameTimeout.current);
          setIsCheckingBoatName(true);
          boatNameTimeout.current = setTimeout(async () => {
            try {
              const boats = await getBoats();
              const exists = boats.some(b => (b.boat_name || '').toLowerCase() === (value || '').toLowerCase());
              if (exists) {
                setBoatNameError('Boat name already exists.');
                setErrors(prev => ({ ...(prev || {}), boat_name: 'Boat name already exists.' }));
              } else {
                setBoatNameError('');
                setErrors(prev => {
                  const copy = { ...(prev || {}) };
                  delete copy.boat_name;
                  return copy;
                });
              }
            } catch (err) {
              console.error('Boat name check failed', err);
              setBoatNameError('');
            } finally {
              setIsCheckingBoatName(false);
            }
          }, 500);
        }
        break;
      }
      case 'serial_number': {
        if (!value || value.trim() === '') newErrors.serial_number = 'Serial number is required.';
        else delete newErrors.serial_number;
        break;
      }
      case 'mfbr_number': {
        if (!value || value.trim() === '') newErrors.mfbr_number = 'MFBR number is required.';
        else delete newErrors.mfbr_number;
        break;
      }
      default: {
        // For select/text required quick checks used in validateStep
        const requiredQuick = ['type_of_registration', 'application_date', 'type_of_ownership', 'no_fishers', 'homeport', 'boat_name', 'boat_type', 'material_used', 'built_place', 'built_year', 'engine_make', 'serial_number', 'horsepower'];
        if (requiredQuick.includes(name)) {
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            newErrors[name] = 'This field is required.';
          } else {
            delete newErrors[name];
          }
        }
      }
    }
    setErrors(newErrors);
  };

  const renderStep = () => {
    if (currentStep === 0) {
      return (
        <div
          className="space-y-6"
          style={{ fontFamily: "Montserrat, sans-serif" }}
        >
          <div className="bg-white p-6 rounded-lg shadow">
            {/* <h2 className="text-xl font-semibold text-blue-800 mb-4 bg-blue-100 rounded px-4 py-3 shadow-sm"> */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
              Search Fisherfolk
            </h2>
            <p className="text-sm text-blue-700 mb-2">
              Please search and select a fisherfolk to begin registration.
            </p>

            <FisherfolkSearchForm
              onSelectFisherfolk={handleFisherfolkSelect}
              selectedFisherfolkId={selectedFisherfolkId}
            />

            {/* Latest Added Fisherfolk */}
            {latestFisherfolk.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Latest Added Fisherfolk
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          {/* Select column */}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Registration Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Barangay
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Municipality
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {latestFisherfolk.map((fisherfolk) => {
                        const isSelected = selectedFisherfolkId === fisherfolk.registration_number;
                        return (
                          <tr
                            key={fisherfolk.registration_number}
                            onClick={() => handleFisherfolkSelect(fisherfolk)}
                            className={`${isSelected ? "bg-blue-50 border-l-4 border-blue-600" : ""
                              } hover:bg-gray-50 transition-all duration-150 cursor-pointer`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                                  }`}>
                                  {isSelected && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {fisherfolk.registration_number || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {`${fisherfolk.first_name} ${fisherfolk.middle_name
                                ? fisherfolk.middle_name.charAt(0) + ". "
                                : ""
                                }${fisherfolk.last_name}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {fisherfolk.address?.barangay || fisherfolk.barangay || "Not specified"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {fisherfolk.address?.municipality || fisherfolk.municipality || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${fisherfolk.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                                  }`}
                              >
                                {fisherfolk.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    if (currentStep === 1) {
      return (
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
                <div className="mt-1 grid grid-cols-12 gap-2">
                  {/* Fixed LU prefix */}
                  <div className="col-span-2">
                    <input
                      type="text"
                      value="LU"
                      disabled
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 text-center font-semibold"
                    />
                  </div>
                  {/* Municipality (auto-filled from fisherfolk) */}
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={mfbrMunicipality ? municipalityCodes[mfbrMunicipality] || mfbrMunicipality : ""}
                      disabled
                      placeholder="Auto-filled from fisherfolk"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 text-center font-semibold"
                    />
                  </div>
                  {/* 3-digit number */}
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={mfbrNumber}
                      onChange={handleMfbrNumberChange}
                      placeholder="000"
                      maxLength={3}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    {mfbrCheck.status === "checking" && (
                      <span className="mt-1 text-xs text-gray-500 block">Checking availability…</span>
                    )}
                    {mfbrCheck.status === "available" && (
                      <span className="mt-1 text-xs text-green-600 block">Available</span>
                    )}
                    {mfbrCheck.status === "taken" && (
                      <span className="mt-1 text-xs text-red-600 block">Already taken</span>
                    )}
                    {errors.mfbr_number && (
                      <span className="mt-1 text-xs text-red-600 block">{errors.mfbr_number}</span>
                    )}
                  </div>
                </div>
                {/* Display formatted MFBR */}
                {formData.mfbr_number && (
                  <p className="mt-2 text-sm text-gray-600">
                    MFBR: <span className="font-semibold text-blue-600">{formData.mfbr_number}</span>
                  </p>
                )}
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
                    <option value="" hidden>Select Type</option>
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
                  {errors.type_of_registration && (
                    <span className="mt-1 text-xs text-red-600 block">{errors.type_of_registration}</span>
                  )}
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
                {errors.application_date && (
                  <span className="mt-1 text-xs text-red-600 block">{errors.application_date}</span>
                )}
              </div>
            </div>

            {/* Owner/Operator Details */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
              Owner/Operator Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Fisherfolk Registration Number <span className="text-red-500">*</span>
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
                  {isCheckingBoatName && <p className="mt-1 text-xs text-blue-600">Checking boat name...</p>}
                  {boatNameError && <span className="mt-1 text-xs text-red-600 block">{boatNameError}</span>}
                  {errors.boat_name && !boatNameError && (
                    <span className="mt-1 text-xs text-red-600 block">{errors.boat_name}</span>
                  )}
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
                    <option value="" hidden selected >Select Type</option>
                    <option value="Non-Motorized">Non-Motorized</option>
                    <option value="Motorized">Motorized</option>
                  </select>
                  {errors.material_used && (
                    <span className="mt-1 text-xs text-red-600 block">{errors.material_used}</span>
                  )}
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
                    <option value="" hidden selected>Select Material</option>
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
                {errors.built_place && (
                  <span className="mt-1 text-xs text-red-600 block">{errors.built_place}</span>
                )}
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
                {errors.built_year && (
                  <span className="mt-1 text-xs text-red-600 block">{errors.built_year}</span>
                )}
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
                    <option value="" selected hidden>Select Ownership</option>
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
                  {errors.engine_make && (
                    <span className="mt-1 text-xs text-red-600 block">{errors.engine_make}</span>
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
                  {errors.serial_number && (
                    <span className="mt-1 text-xs text-red-600 block">{errors.serial_number}</span>
                  )}
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
                {errors.no_fishers && (
                  <span className="mt-1 text-xs text-red-600 block">{errors.no_fishers}</span>
                )}
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
              <p className="text-xs text-gray-500">Suggested: clear image of the boat with the owner beside it.</p>
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

              {preview && (
                <div className="mt-3">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-40 h-40 object-cover rounded-xl border border-gray-300 shadow-md"
                  />
                </div>
              )}
            </div>

            {/* Boat Dimensions and Tonnages Section */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
              Boat Dimensions and Tonnages
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="row-start-1">
                <label className="block text-sm font-medium text-gray-700">
                  Registered Length (m)<span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    name="registered_length"
                    value={formData.registered_length}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter length"
                    required
                    min="20"
                    max="25"
                    step="1"
                  />
                  <p className="mt-1 text-xs text-gray-500">Allowed range: 20–25 meters.</p>
                  {errors.registered_length && (
                    <span className="mt-1 text-xs text-red-600 block">{errors.registered_length}</span>
                  )}
                </div>
              </div>
              <div className="row-start-2">
                <label className="block text-sm font-medium text-gray-700">
                  Registered Breadth (m)<span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    name="registered_breadth"
                    value={formData.registered_breadth}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter breadth"
                    required
                    min="0.75"
                    max="0.8"
                    step="0.01"
                  />
                  <p className="mt-1 text-xs text-gray-500">Allowed range: 0.75–0.80 meters.</p>
                  {errors.registered_breadth && (
                    <span className="mt-1 text-xs text-red-600 block">{errors.registered_breadth}</span>
                  )}
                </div>
              </div>
              <div className="row-start-3">
                <label className="block text-sm font-medium text-gray-700">
                  Registered Depth (m)<span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    name="registered_depth"
                    value={formData.registered_depth}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter depth"
                    required
                    min="0.75"
                    max="0.8"
                    step="0.01"
                  />
                  <p className="mt-1 text-xs text-gray-500">Allowed range: 0.75–0.80 meters.</p>
                  {errors.registered_depth && (
                    <span className="mt-1 text-xs text-red-600 block">{errors.registered_depth}</span>
                  )}
                </div>
              </div>

              {/* calculate tonnages */}
              <label className="block text-sm font-medium text-gray-700 col-start-2 row-start-1">
                Calculate Tonnage<span className="text-red-500">*</span>
              </label>
              <div
                className="p-4 bg-white border rounded-lg shadow-md col-start-2 row-start-1 row-end-4 mt-6 p-4"
                style={{ borderColor: "#3863CF" }}
              >
                <div className="grid grid-cols-3 ">
                  <label className="block text-sm font-medium text-gray-700">
                    Tonnage Length <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      name="tonnage_length"
                      value={formData.tonnage_length}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 col-span-2"
                      min={1}
                      max={3}
                      placeholder="Enter Tonnage Length"
                      required
                      step="1"
                    />
                    <p className="mt-1 text-xs text-gray-500">Allowed range: 1–3.</p>
                    {errors.tonnage_length && (
                      <span className="mt-1 text-xs text-red-600 block">{errors.tonnage_length}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Tonnage Breadth <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      name="tonnage_breadth"
                      value={formData.tonnage_breadth}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 col-span-2"
                      min={1}
                      max={3}
                      placeholder="Enter Tonnage Breadth"
                      required
                      step="1"
                    />
                    <p className="mt-1 text-xs text-gray-500">Allowed range: 1–3.</p>
                    {errors.tonnage_breadth && (
                      <span className="mt-1 text-xs text-red-600 block">{errors.tonnage_breadth}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Tonnage Depth <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      name="tonnage_depth"
                      value={formData.tonnage_depth}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 col-span-2"
                      min={1}
                      max={3}
                      placeholder="Enter Tonnage Depth"
                      required
                      step="1"
                    />
                    <p className="mt-1 text-xs text-gray-500">Allowed range: 1–3.</p>
                    {errors.tonnage_depth && (
                      <span className="mt-1 text-xs text-red-600 block">{errors.tonnage_depth}</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Gross Tonnage <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    name="gross_tonnage"
                    disabled
                    value={formData.gross_tonnage}
                    onChange={handleInputChange}
                    placeholder="Auto-calculated"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 placeholder-gray-500"
                    required
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Net Tonnage <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    name="net_tonnage"
                    disabled
                    value={formData.net_tonnage}
                    onChange={handleInputChange}
                    placeholder="Auto-calculated"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                    required
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Boat Marine Gear Section */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
              Boat Marine Gear
            </h2>
            <div
              className="grid grid-cols-3 gap-4 p-4 bg-white border rounded-lg shadow-md col-start-1 row-end-4"
              style={{
                borderColor: "#3863CF",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <div className="col-start-1 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_surround_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_surround_net"
                      type="checkbox"
                      name="marine_surround_net"
                      checked={formData.marine_surround_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_surround_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_surround_net_babyringnet",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_surround_net_babyringnet_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Surrounding Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_surround_net ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if marine_surround_net is checked */}
                {formData.marine_surround_net && (
                  <div className="px-6 pb-4">
                    {/* Sub-item: Baby Ring Net */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_surround_net_babyringnet"
                        checked={
                          formData.marine_surround_net_babyringnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_surround_net_babyringnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_surround_net_babyringnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Baby Ring Net
                      </span>
                      {formData.marine_surround_net_babyringnet && (
                        <input
                          type="number"
                          name="marine_surround_net_babyringnet_no"
                          value={
                            formData.marine_surround_net_babyringnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-2 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_falling_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_falling_net"
                      type="checkbox"
                      name="marine_falling_net"
                      checked={formData.marine_falling_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_falling_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_falling_net_castnet",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_falling_net_castnet_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Falling Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_falling_net ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fallingnet is checked */}
                {formData.marine_falling_net && (
                  <div className="px-6 pb-4">
                    {/* Sub-item: Cast Net */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="castnet"
                        checked={formData.marine_falling_net_castnet === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_falling_net_castnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_falling_net_castnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Cast Net</span>
                      {formData.marine_falling_net_castnet && (
                        <input
                          type="number"
                          name="marine_falling_net_castnet_no"
                          value={formData.marine_falling_net_castnet_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-3 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_fishing_aggr_device"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_fishing_aggr_device"
                      type="checkbox"
                      name="marine_fishing_aggr_device"
                      checked={formData.marine_fishing_aggr_device === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_fishing_aggr_device",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_fishing_aggr_device_steeldrum",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_fishing_aggr_device_steeldrum_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Fishing Aggregating Device/Payao
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_fishing_aggr_device ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_fishing_aggr_device && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: Steel Drum */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_fishing_aggr_device_steeldrum"
                        checked={
                          formData.marine_fishing_aggr_device_steeldrum === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_fishing_aggr_device_steeldrum",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_fishing_aggr_device_steeldrum_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Steel Drum</span>
                      {formData.marine_fishing_aggr_device_steeldrum && (
                        <input
                          type="number"
                          name="marine_fishing_aggr_device_steeldrum_no"
                          value={
                            formData.marine_fishing_aggr_device_steeldrum_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: Floating Net */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_fishing_aggr_device_bamboo"
                        checked={
                          formData.marine_fishing_aggr_device_bamboo === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_fishing_aggr_device_bamboo",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_fishing_aggr_device_bamboo_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Bamboo (Arong)
                      </span>
                      {formData.marine_fishing_aggr_device_bamboo && (
                        <input
                          type="number"
                          name="marine_fishing_aggr_device_bamboo_no"
                          value={
                            formData.marine_fishing_aggr_device_bamboo_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* third Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_fishing_aggr_device_styropore"
                        checked={
                          formData.marine_fishing_aggr_device_styropore === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_fishing_aggr_device_styropore",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_fishing_aggr_device_styropore_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Styropore</span>
                      {formData.marine_fishing_aggr_device_styropore && (
                        <input
                          type="number"
                          name="marine_fishing_aggr_device_styropore_no"
                          value={
                            formData.marine_fishing_aggr_device_styropore_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* fourth Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_fishing_aggr_device_bambooraft"
                        checked={
                          formData.marine_fishing_aggr_device_bambooraft ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_fishing_aggr_device_bambooraft",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_fishing_aggr_device_bambooraft_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Bamboo Raft</span>
                      {formData.marine_fishing_aggr_device_bambooraft && (
                        <input
                          type="number"
                          name="marine_fishing_aggr_device_bambooraft_no"
                          value={
                            formData.marine_fishing_aggr_device_bambooraft_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              {/* 2nd line */}
              <div className="col-start-1 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_seine_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_seine_net"
                      type="checkbox"
                      name="marine_seine_net"
                      checked={formData.marine_seine_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_seine_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_seine_net_roundhaulseine",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_seine_net_roundhaulseine_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Seine Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_seine_net ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_seine_net && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: roundhaulseine */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_seine_net_roundhaulseine"
                        checked={
                          formData.marine_seine_net_roundhaulseine === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_seine_net_roundhaulseine",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_seine_net_roundhaulseine_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Round Haul Seine
                      </span>
                      {formData.marine_seine_net_roundhaulseine && (
                        <input
                          type="number"
                          name="marine_seine_net_roundhaulseine_no"
                          value={
                            formData.marine_seine_net_roundhaulseine_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: beachseine */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_seine_net_beachseine"
                        checked={formData.marine_seine_net_beachseine === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_seine_net_beachseine",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_seine_net_beachseine_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Beach Seine</span>
                      {formData.marine_seine_net_beachseine && (
                        <input
                          type="number"
                          name="beachseine_no"
                          value={formData.marine_seine_net_beachseine_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* third Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_seine_net_frydozer"
                        checked={formData.marine_seine_net_frydozer === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_seine_net_frydozer",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_seine_net_frydozer_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Fry Dozer or Gatherer
                      </span>
                      {formData.marine_seine_net_frydozer && (
                        <input
                          type="number"
                          name="marine_seine_net_frydozer_no"
                          value={formData.marine_seine_net_frydozer_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-2 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_scoop_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_scoop_net"
                      type="checkbox"
                      name="marine_scoop_net"
                      checked={formData.marine_scoop_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_scoop_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_scoop_net_manpushnet",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_scoop_net_manpushnet_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Scoop Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_scoop_net ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_scoop_net && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: manpushnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_scoop_net_manpushnet"
                        checked={formData.marine_scoop_net_manpushnet === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_scoop_net_manpushnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_scoop_net_manpushnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Man Push Net
                      </span>
                      {formData.marine_scoop_net_manpushnet && (
                        <input
                          type="number"
                          name="marine_scoop_net_manpushnet_no"
                          value={formData.marine_scoop_net_manpushnet_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: motorizedboatpushnet */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_scoop_net_motorizedboatpushnet"
                        checked={
                          formData.marine_scoop_net_motorizedboatpushnet ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_scoop_net_motorizedboatpushnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_scoop_net_motorizedboatpushnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Motorized Boat Push Net
                      </span>
                      {formData.marine_scoop_net_motorizedboatpushnet && (
                        <input
                          type="number"
                          name="marine_scoop_net_motorizedboatpushnet_no"
                          value={
                            formData.marine_scoop_net_motorizedboatpushnet_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* third Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_scoop_net_scoopnetchk"
                        checked={formData.marine_scoop_net_scoopnetchk === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_scoop_net_scoopnetchk",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_scoop_net_scoopnetchk_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Scoop Net</span>
                      {formData.marine_scoop_net_scoopnetchk && (
                        <input
                          type="number"
                          name="marine_scoop_net_scoopnetchk_no"
                          value={formData.marine_scoop_net_scoopnetchk_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-3 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_miscellaneous_gear"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_miscellaneous_gear"
                      type="checkbox"
                      name="marine_miscellaneous_gear"
                      checked={formData.marine_miscellaneous_gear === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_miscellaneous_gear",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_gaffhook",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_gaffhook_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Miscellaneous Gear
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_miscellaneous_gear ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_miscellaneous_gear && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: gaffhook */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_miscellaneous_gear_gaffhook"
                        checked={
                          formData.marine_miscellaneous_gear_gaffhook === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_gaffhook",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_miscellaneous_gear_gaffhook_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Gaff Hook</span>
                      {formData.marine_miscellaneous_gear_gaffhook && (
                        <input
                          type="number"
                          name="marine_miscellaneous_gear_gaffhook_no"
                          value={
                            formData.marine_miscellaneous_gear_gaffhook_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: rakedredge */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_miscellaneous_gear_rakedredge"
                        checked={
                          formData.marine_miscellaneous_gear_rakedredge === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_rakedredge",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_miscellaneous_gear_rakedredge_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Rake/Dredge (Sell Collector)
                      </span>
                      {formData.marine_miscellaneous_gear_rakedredge && (
                        <input
                          type="number"
                          name="marine_miscellaneous_gear_rakedredge_no"
                          value={
                            formData.marine_miscellaneous_gear_rakedredge_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* third Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_miscellaneous_gear_squidluringdevice"
                        checked={
                          formData.marine_miscellaneous_gear_squidluringdevice ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_squidluringdevice",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_miscellaneous_gear_squidluringdevice_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Squid Luring Device
                      </span>
                      {formData.marine_miscellaneous_gear_squidluringdevice && (
                        <input
                          type="number"
                          name="marine_miscellaneous_gear_squidluringdevice_no"
                          value={
                            formData.marine_miscellaneous_gear_squidluringdevice_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* fourth Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_miscellaneous_gear_octopusluringdevice"
                        checked={
                          formData.marine_miscellaneous_gear_octopusluringdevice ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_octopusluringdevice",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_miscellaneous_gear_octopusluringdevice_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Octopus Luring Device
                      </span>
                      {formData.marine_miscellaneous_gear_octopusluringdevice && (
                        <input
                          type="number"
                          name="marine_miscellaneous_gear_octopusluringdevice_no"
                          value={
                            formData.marine_miscellaneous_gear_octopusluringdevice_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* fifth Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_miscellaneous_gear_miraclehole"
                        checked={
                          formData.marine_miscellaneous_gear_miraclehole ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_miraclehole",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_miscellaneous_gear_miraclehole_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Miracle Hole
                      </span>
                      {formData.marine_miscellaneous_gear_miraclehole && (
                        <input
                          type="number"
                          name="marine_miscellaneous_gear_miraclehole_no"
                          value={
                            formData.marine_miscellaneous_gear_miraclehole_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* sixth Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_miscellaneous_gear_speargun"
                        checked={
                          formData.marine_miscellaneous_gear_speargun === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_speargun",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_miscellaneous_gear_speargun_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Spear Gun</span>
                      {formData.marine_miscellaneous_gear_speargun && (
                        <input
                          type="number"
                          name="marine_miscellaneous_gear_speargun_no"
                          value={
                            formData.marine_miscellaneous_gear_speargun_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* seventh Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_miscellaneous_gear_spear"
                        checked={
                          formData.marine_miscellaneous_gear_spear === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_miscellaneous_gear_spear",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_miscellaneous_gear_spear_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Spear</span>
                      {formData.marine_miscellaneous_gear_spear && (
                        <input
                          type="number"
                          name="marine_miscellaneous_gear_spear_no"
                          value={
                            formData.marine_miscellaneous_gear_spear_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-1 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_lift_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_lift_net"
                      type="checkbox"
                      name="marine_lift_net"
                      checked={formData.marine_lift_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_lift_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_lift_net_bagnet",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_lift_net_bagnet_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Lift Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_lift_net ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_lift_net && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: bagnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_lift_net_bagnet"
                        checked={formData.marine_lift_net_bagnet === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_lift_net_bagnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_lift_net_bagnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Bagnet</span>
                      {formData.marine_lift_net_bagnet && (
                        <input
                          type="number"
                          name="marine_lift_net_bagnet_no"
                          value={formData.marine_lift_net_bagnet_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: stationaryliftnet */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_lift_net_stationaryliftnet"
                        checked={
                          formData.marine_lift_net_stationaryliftnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_lift_net_stationaryliftnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_lift_net_stationaryliftnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Stationary Lift Net
                      </span>
                      {formData.marine_lift_net_stationaryliftnet && (
                        <input
                          type="number"
                          name="marine_lift_net_stationaryliftnet_no"
                          value={
                            formData.marine_lift_net_stationaryliftnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-2 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_cast_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_cast_net"
                      type="checkbox"
                      name="marine_cast_net"
                      checked={formData.marine_cast_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_cast_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_cast_net_gillnet",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_cast_net_gillnet_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Cast Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_cast_net ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_cast_net && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: bagnet */}
                    <span className="text-gray-700 text-sm font-medium">
                      Set Longline
                    </span>
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_cast_net_gillnet"
                        checked={formData.marine_cast_net_gillnet === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_cast_net_gillnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_cast_net_gillnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Gill Net</span>
                      {formData.marine_cast_net_gillnet && (
                        <input
                          type="number"
                          name="marine_cast_net_gillnet_no"
                          value={formData.marine_cast_net_gillnet_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-3 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_traps_n_pots"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_traps_n_pots"
                      type="checkbox"
                      name="marine_traps_n_pots"
                      checked={formData.marine_traps_n_pots === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_traps_n_pots",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_lobstertrap",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_lobstertrap_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Traps and Pots
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_traps_n_pots ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_traps_n_pots && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: gaffhook */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="lobstertrap"
                        checked={
                          formData.marine_traps_n_pots_lobstertrap === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_lobstertrap",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_traps_n_pots_lobstertrap_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Lobster Trap
                      </span>
                      {formData.marine_traps_n_pots_lobstertrap && (
                        <input
                          type="number"
                          name="marine_traps_n_pots_lobstertrap_no"
                          value={
                            formData.marine_traps_n_pots_lobstertrap_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: levernet */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_traps_n_pots_levernet"
                        checked={formData.marine_traps_n_pots_levernet === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "levemarine_traps_n_pots_levernetrnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_traps_n_pots_levernet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Lever Net</span>
                      {formData.marine_traps_n_pots_levernet && (
                        <input
                          type="number"
                          name="marine_traps_n_pots_levernet_no"
                          value={formData.marine_traps_n_pots_levernet_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* third Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_traps_n_pots_shrimpliftnet"
                        checked={
                          formData.marine_traps_n_pots_shrimpliftnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_shrimpliftnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_traps_n_pots_shrimpliftnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Shrimp Lift Net
                      </span>
                      {formData.marine_traps_n_pots_shrimpliftnet && (
                        <input
                          type="number"
                          name="marine_traps_n_pots_shrimpliftnet_no"
                          value={
                            formData.marine_traps_n_pots_shrimpliftnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* fourth Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_traps_n_pots_setnet"
                        checked={formData.marine_traps_n_pots_setnet === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_setnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_traps_n_pots_setnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Set Net (Lambaklad)
                      </span>
                      {formData.marine_traps_n_pots_setnet && (
                        <input
                          type="number"
                          name="marine_traps_n_pots_setnet_no"
                          value={formData.marine_traps_n_pots_setnet_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* fifth Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_traps_n_pots_fishcoral"
                        checked={
                          formData.marine_traps_n_pots_fishcoral === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_fishcoral",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_traps_n_pots_fishcoral_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Fish Coral (Baklad)
                      </span>
                      {formData.marine_traps_n_pots_fishcoral && (
                        <input
                          type="number"
                          name="marine_traps_n_pots_fishcoral_no"
                          value={
                            formData.marine_traps_n_pots_fishcoral_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* sixth Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_traps_n_pots_flykenet"
                        checked={formData.marine_traps_n_pots_flykenet === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_flykenet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_traps_n_pots_flykenet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Flyke Net/Filter Net
                      </span>
                      {formData.marine_traps_n_pots_flykenet && (
                        <input
                          type="number"
                          name="marine_traps_n_pots_flykenet_no"
                          value={formData.marine_traps_n_pots_flykenet_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* seventh Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_traps_n_pots_crabpot"
                        checked={formData.marine_traps_n_pots_crabpot === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_crabpot",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_traps_n_pots_crabpot_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Crab Pot</span>
                      {formData.marine_traps_n_pots_crabpot && (
                        <input
                          type="number"
                          name="marine_traps_n_pots_crabpot_no"
                          value={formData.marine_traps_n_pots_crabpot_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* seventh Sub-item */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_traps_n_pots_fishpot"
                        checked={formData.marine_traps_n_pots_fishpot === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_traps_n_pots_fishpot",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_traps_n_pots_fishpot_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Fish Pot</span>
                      {formData.marine_traps_n_pots_fishpot && (
                        <input
                          type="number"
                          name="marine_traps_n_pots_fishpot_no"
                          value={formData.marine_traps_n_pots_fishpot_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-1 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_gill_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_gill_net"
                      type="checkbox"
                      name="marine_gill_net"
                      checked={formData.marine_gill_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_gill_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_encirclinggillnet",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_encirclinggillnet_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Gill Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_gill_net ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_gill_net && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: encirclinggillnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_gill_net_encirclinggillnet"
                        checked={
                          formData.marine_gill_net_encirclinggillnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_encirclinggillnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_gill_net_encirclinggillnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Encircling Gill Net
                      </span>
                      {formData.marine_gill_net_encirclinggillnet && (
                        <input
                          type="number"
                          name="marine_gill_net_encirclinggillnet_no"
                          value={
                            formData.marine_gill_net_encirclinggillnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: crabentanglingnet */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_gill_net_crabentanglingnet"
                        checked={
                          formData.marine_gill_net_crabentanglingnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_crabentanglingnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_gill_net_crabentanglingnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Crab Entangling Net
                      </span>
                      {formData.marine_gill_net_crabentanglingnet && (
                        <input
                          type="number"
                          name="marine_gill_net_crabentanglingnet_no"
                          value={
                            formData.marine_gill_net_crabentanglingnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: trammelnet */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_gill_net_trammelnet"
                        checked={formData.marine_gill_net_trammelnet === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_trammelnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_gill_net_trammelnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Trammel Net</span>
                      {formData.marine_gill_net_trammelnet && (
                        <input
                          type="number"
                          name="marine_gill_net_trammelnet_no"
                          value={formData.marine_gill_net_trammelnet_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: trammelnet */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_gill_net_bottomsetgillnet"
                        checked={
                          formData.marine_gill_net_bottomsetgillnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_bottomsetgillnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_gill_net_bottomsetgillnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Bottom Set Gill Net
                      </span>
                      {formData.marine_gill_net_bottomsetgillnet && (
                        <input
                          type="number"
                          name="marine_gill_net_bottomsetgillnet_no"
                          value={
                            formData.marine_gill_net_bottomsetgillnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: midwatersetgillnet */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_gill_net_midwatersetgillnet"
                        checked={
                          formData.marine_gill_net_midwatersetgillnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_midwatersetgillnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_gill_net_midwatersetgillnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Midwater Set Gill Net
                      </span>
                      {formData.marine_gill_net_midwatersetgillnet && (
                        <input
                          type="number"
                          name="midwatersetgillnet_no"
                          value={
                            formData.marine_gill_net_midwatersetgillnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: inland_gill_net_surfacegillnet */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_gill_net_surfacegillnet"
                        checked={
                          formData.marine_gill_net_surfacegillnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_surfacegillnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_gill_net_surfacegillnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Surface Gill Net (Largarete)
                      </span>
                      {formData.marine_gill_net_surfacegillnet && (
                        <input
                          type="number"
                          name="marine_gill_net_inland_gill_net_surfacegillnet_no"
                          value={
                            formData.marine_gill_net_surfacegillnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: smallpelagicdrift */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_gill_net_smallpelagicdrift"
                        checked={
                          formData.marine_gill_net_smallpelagicdrift === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_smallpelagicdrift",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_gill_net_smallpelagicdrift_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Small Pelagic Drift Gill Net (Small Mesh)
                      </span>
                      {formData.marine_gill_net_smallpelagicdrift && (
                        <input
                          type="number"
                          name="marine_gill_net_smallpelagicdrift_no"
                          value={
                            formData.marine_gill_net_smallpelagicdrift_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: tunabillfishdrift */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="marine_gill_net_tunabillfishdrift"
                        checked={
                          formData.marine_gill_net_tunabillfishdrift === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_gill_net_tunabillfishdrift",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_gill_net_tunabillfishdrift_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Tuna/Bill Fish Drift Gill Net (Large Mesh)
                      </span>
                      {formData.marine_gill_net_tunabillfishdrift && (
                        <input
                          type="number"
                          name="marine_gill_net_tunabillfishdrift_no"
                          value={
                            formData.marine_gill_net_tunabillfishdrift_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-2 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="marine_hook_n_line"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="marine_hook_n_line"
                      type="checkbox"
                      name="marine_hook_n_line"
                      checked={formData.marine_hook_n_line === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "marine_hook_n_line",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "marine_hook_n_line_demersalmhl",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "marine_hook_n_line_demersalmhl_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Hook and Line
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.marine_hook_n_line ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.marine_hook_n_line && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: bagnet */}
                    <span className="text-gray-700 text-sm font-medium">
                      Multiple Hook and Line (MHL)
                    </span>
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_hook_n_line_demersalmhl"
                        checked={
                          formData.marine_hook_n_line_demersalmhl === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_hook_n_line_demersalmhl",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_hook_n_line_demersalmhl_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Demersal MHL
                      </span>
                      {formData.marine_hook_n_line_demersalmhl && (
                        <input
                          type="number"
                          name="marine_hook_n_line_demersalmhl_no"
                          value={
                            formData.marine_hook_n_line_demersalmhl_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* First Sub-item: bagnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_hook_n_line_tunamhl"
                        checked={formData.marine_hook_n_line_tunamhl === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_hook_n_line_tunamhl",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_hook_n_line_tunamhl_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Tuna MHL</span>
                      {formData.marine_hook_n_line_tunamhl && (
                        <input
                          type="number"
                          name="marine_hook_n_line_tunamhl_no"
                          value={formData.marine_hook_n_line_tunamhl_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* First Sub-item: bagnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_hook_n_line_smallpelagicmhl"
                        checked={
                          formData.marine_hook_n_line_smallpelagicmhl === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_hook_n_line_smallpelagicmhl",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_hook_n_line_smallpelagicmhl_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Small Pelagic MHL
                      </span>
                      {formData.marine_hook_n_line_smallpelagicmhl && (
                        <input
                          type="number"
                          name="marine_hook_n_line_smallpelagicmhl_no"
                          value={
                            formData.marine_hook_n_line_smallpelagicmhl_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* First Sub-item: bagnet */}
                    <span className="text-gray-700 text-sm font-medium">
                      Simple-Handline (Single Hook and Line)
                    </span>
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_hook_n_line_tunahandline"
                        checked={
                          formData.marine_hook_n_line_tunahandline === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_hook_n_line_tunahandline",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_hook_n_line_tunahandline_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Tuna Handline
                      </span>
                      {formData.marine_hook_n_line_tunahandline && (
                        <input
                          type="number"
                          name="marine_hook_n_line_tunahandline_no"
                          value={
                            formData.marine_hook_n_line_tunahandline_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* First Sub-item: bagnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_hook_n_line_threadfinbream"
                        checked={
                          formData.marine_hook_n_line_threadfinbream === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_hook_n_line_threadfinbream",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_hook_n_line_threadfinbream_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Threadfin Bream/Snapper (Demersal & Reef Fishes)
                      </span>
                      {formData.marine_hook_n_line_threadfinbream && (
                        <input
                          type="number"
                          name="marine_hook_n_line_threadfinbream_no"
                          value={
                            formData.marine_hook_n_line_threadfinbream_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* First Sub-item: bagnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="marine_hook_n_line_mackarelscad"
                        checked={
                          formData.marine_hook_n_line_mackarelscad === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "marine_hook_n_line_mackarelscad",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "marine_hook_n_line_mackarelscad_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Mackarel/Scad (Small Pelagics)
                      </span>
                      {formData.marine_hook_n_line_mackarelscad && (
                        <input
                          type="number"
                          name="marine_hook_n_line_mackarelscad_no"
                          value={
                            formData.marine_hook_n_line_mackarelscad_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>
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
              {/* first line */}
              <div className="col-start-1 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="inland_hook_n_line"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="inland_hook_n_line"
                      type="checkbox"
                      name="inland_hook_n_line"
                      checked={formData.inland_hook_n_line === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "inland_hook_n_line",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "inland_hook_n_line_polenline",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "inland_hook_n_line_polenline_no",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Hook and Line
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.inland_hook_n_line ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.inland_hook_n_line && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: polenline */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_hook_n_line_polenline"
                        checked={formData.inland_hook_n_line_polenline === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_hook_n_line_polenline",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_hook_n_line_polenline_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Pole and Line
                      </span>
                      {formData.inland_hook_n_line_polenline && (
                        <input
                          type="number"
                          name="inland_hook_n_line_polenline_no"
                          value={formData.inland_hook_n_line_polenline_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* Second Sub-item: Another item, example: stationarystick */}
                    <label className="flex items-center space-x-2 mt-4 mb-2">
                      <input
                        type="checkbox"
                        name="inland_hook_n_line_stationarystick"
                        checked={
                          formData.inland_hook_n_line_stationarystick === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_hook_n_line_stationarystick",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_hook_n_line_stationarystick_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Stationary Stick and Line
                      </span>
                      {formData.inland_hook_n_line_stationarystick && (
                        <input
                          type="number"
                          name="inland_hook_n_line_stationarystick_no"
                          value={
                            formData.inland_hook_n_line_stationarystick_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-2 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="inland_set_longline"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="inland_set_longline"
                      type="checkbox"
                      name="inland_set_longline"
                      checked={formData.inland_set_longline === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "inland_set_longline",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "inland_set_longline_bottomsetlongline",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "inland_set_longline_bottomsetlongline",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Set Longline
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.inland_set_longline ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if fishingaggregatingdevice is checked */}
                {formData.inland_set_longline && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: bottomsetlongline */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_set_longline_bottomsetlongline"
                        checked={
                          formData.inland_set_longline_bottomsetlongline ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_set_longline_bottomsetlongline",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_set_longline_bottomsetlongline_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Bottom Set Longline
                      </span>
                      {formData.inland_set_longline_bottomsetlongline && (
                        <input
                          type="number"
                          name="inland_set_longline_bottomsetlongline_no"
                          value={
                            formData.inland_set_longline_bottomsetlongline_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                    {/* 2nd Sub-item: surfacesetlongline */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_set_longline_surfacesetlongline"
                        checked={
                          formData.inland_set_longline_surfacesetlongline ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_set_longline_surfacesetlongline",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_set_longline_surfacesetlongline_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Surface Set Longline
                      </span>
                      {formData.inland_set_longline_surfacesetlongline && (
                        <input
                          type="number"
                          name="inland_set_longline_surfacesetlongline_no"
                          value={
                            formData.inland_set_longline_surfacesetlongline_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-3 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="inland_gill_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="inland_gill_net"
                      type="checkbox"
                      name="inland_gill_net"
                      checked={formData.inland_gill_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "inland_gill_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "inland_gill_net_surfacegillnet",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: { name: "inland_gill_net", value: "" },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Gill Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.inland_gill_net ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if inland_gill_net is checked */}
                {formData.inland_gill_net && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: inland_gill_net_surfacegillnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_gill_net_surfacegillnet"
                        checked={
                          formData.inland_gill_net_surfacegillnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_gill_net_surfacegillnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_gill_net_surfacegillnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Surface Gill Net
                      </span>
                      {formData.inland_gill_net_surfacegillnet && (
                        <input
                          type="number"
                          name="inland_gill_net_surfacegillnet_no"
                          value={
                            formData.inland_gill_net_surfacegillnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                    {/* 2nd Sub-item: inland_gill_net_bottomgillnet */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_gill_net_bottomgillnet"
                        checked={
                          formData.inland_gill_net_bottomgillnet === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_gill_net_bottomgillnet",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_gill_net_bottomgillnet_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Bottom Gill Net
                      </span>
                      {formData.inland_gill_net_bottomgillnet && (
                        <input
                          type="number"
                          name="inland_gill_net_bottomgillnet_no"
                          value={
                            formData.inland_gill_net_bottomgillnet_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-1 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="inland_traps_n_pots"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="inland_traps_n_pots"
                      type="checkbox"
                      name="inland_traps_n_pots"
                      checked={formData.inland_traps_n_pots === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "inland_traps_n_pots",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "inland_traps_n_pots_fishpottp",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "inland_traps_n_pots_fishpottp",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Traps and Pots
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.inland_traps_n_pots ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if inland_traps_n_pots is checked */}
                {formData.inland_traps_n_pots && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: inland_traps_n_pots_fishpottp */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_traps_n_pots_fishpottp"
                        checked={
                          formData.inland_traps_n_pots_fishpottp === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_traps_n_pots_fishpottp",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_traps_n_pots_fishpottp_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Fish Pot (Wire/Bamboo/Net)
                      </span>
                      {formData.inland_traps_n_pots_fishpottp && (
                        <input
                          type="number"
                          name="inland_traps_n_pots_fishpottp_no"
                          value={
                            formData.inland_traps_n_pots_fishpottp_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                    {/* 2nd Sub-item: inland_traps_n_pots_fishtraptp */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_traps_n_pots_fishtraptp"
                        checked={
                          formData.inland_traps_n_pots_fishtraptp === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_traps_n_pots_fishtraptp",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_traps_n_pots_fishtraptp_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Fish Trap (Bamboo/Net)
                      </span>
                      {formData.inland_traps_n_pots_fishtraptp && (
                        <input
                          type="number"
                          name="inland_traps_n_pots_fishtraptp_no"
                          value={
                            formData.inland_traps_n_pots_fishtraptp_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* 3rd Sub-item: inland_traps_n_pots_shrimptraptp */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_traps_n_pots_shrimptraptp"
                        checked={
                          formData.inland_traps_n_pots_shrimptraptp === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_traps_n_pots_shrimptraptp",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_traps_n_pots_shrimptraptp_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Shrimp Trap (Bamboo/Net)
                      </span>
                      {formData.inland_traps_n_pots_shrimptraptp && (
                        <input
                          type="number"
                          name="inland_traps_n_pots_shrimptraptp_no"
                          value={
                            formData.inland_traps_n_pots_shrimptraptp_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* 4th Sub-item: inland_traps_n_pots_bamboowiretrap */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_traps_n_pots_bamboowiretrap"
                        checked={
                          formData.inland_traps_n_pots_bamboowiretrap === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_traps_n_pots_bamboowiretrap",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_traps_n_pots_bamboowiretrap_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Bamboo Wire/Trap (Asar)
                      </span>
                      {formData.inland_traps_n_pots_bamboowiretrap && (
                        <input
                          type="number"
                          name="inland_traps_n_pots_bamboowiretrap_no"
                          value={
                            formData.inland_traps_n_pots_bamboowiretrap_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* 5th Sub-item: inland_traps_n_pots_flyketnettp */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_traps_n_pots_flyketnettp"
                        checked={
                          formData.inland_traps_n_pots_flyketnettp === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_traps_n_pots_flyketnettp",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_traps_n_pots_flyketnettp_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Flyke Net</span>
                      {formData.inland_traps_n_pots_flyketnettp && (
                        <input
                          type="number"
                          name="inland_traps_n_pots_flyketnettp_no"
                          value={
                            formData.inland_traps_n_pots_flyketnettp_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* 6th Sub-item: inland_traps_n_pots_fishcorraltp */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_traps_n_pots_fishcorraltp"
                        checked={
                          formData.inland_traps_n_pots_fishcorraltp === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_traps_n_pots_fishcorraltp",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_traps_n_pots_fishcorraltp_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Fish Corral (Baklad)
                      </span>
                      {formData.inland_traps_n_pots_fishcorraltp && (
                        <input
                          type="number"
                          name="inland_traps_n_pots_fishcorraltp_no"
                          value={
                            formData.inland_traps_n_pots_fishcorraltp_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-2 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="inland_falling_gears"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="inland_falling_gears"
                      type="checkbox"
                      name="inland_falling_gears"
                      checked={formData.inland_falling_gears === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "inland_falling_gears",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "inland_falling_gears_castnetfg",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "inland_falling_gears_castnetfg",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Falling Gears
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.inland_falling_gears ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if inland_traps_n_pots is checked */}
                {formData.inland_falling_gears && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: inland_falling_gears_castnetfg */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_falling_gears_castnetfg"
                        checked={
                          formData.inland_falling_gears_castnetfg === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_falling_gears_castnetfg",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_falling_gears_castnetfg_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Cast Net</span>
                      {formData.inland_falling_gears_castnetfg && (
                        <input
                          type="number"
                          name="inland_falling_gears_castnetfg_no"
                          value={
                            formData.inland_falling_gears_castnetfg_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-3 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="inland_scoop_net"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="inland_scoop_net"
                      type="checkbox"
                      name="inland_scoop_net"
                      checked={formData.inland_scoop_net === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "inland_scoop_net",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "inland_scoop_net_manpushnetsn",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "inland_scoop_net_manpushnetsn",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Scoop Net
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.inland_falling_gears ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if inland_traps_n_pots is checked */}
                {formData.inland_scoop_net && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: inland_scoop_net_manpushnetsn */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_scoop_net_manpushnetsn"
                        checked={
                          formData.inland_scoop_net_manpushnetsn === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_scoop_net_manpushnetsn",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_scoop_net_manpushnetsn_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Man Push Net
                      </span>
                      {formData.inland_scoop_net_manpushnetsn && (
                        <input
                          type="number"
                          name="inland_scoop_net_manpushnetsn_no"
                          value={
                            formData.inland_scoop_net_manpushnetsn_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* 2nd Sub-item: inland_scoop_net_scoopnetsn */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_scoop_net_scoopnetsn"
                        checked={formData.inland_scoop_net_scoopnetsn === true}
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_scoop_net_scoopnetsn",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_scoop_net_scoopnetsn_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Scoop Net</span>
                      {formData.inland_scoop_net_scoopnetsn && (
                        <input
                          type="number"
                          name="inland_scoop_net_scoopnetsn_no"
                          value={formData.inland_scoop_net_scoopnetsn_no || ""}
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>

              <div className="col-start-1 border border-black rounded-lg shadow-sm">
                {/* Card header with main checkbox */}
                <label
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  htmlFor="inland_miscellaneous_gear"
                >
                  <div className="flex items-center space-x-2">
                    <input
                      id="inland_miscellaneous_gear"
                      type="checkbox"
                      name="inland_miscellaneous_gear"
                      checked={formData.inland_miscellaneous_gear === true}
                      onChange={(e) => {
                        handleInputChange({
                          target: {
                            name: "inland_miscellaneous_gear",
                            value: e.target.checked,
                          },
                        });
                        if (!e.target.checked) {
                          // Clear sub-item quantities if collapsing
                          handleInputChange({
                            target: {
                              name: "inland_miscellaneous_gear_spearmg",
                              value: false,
                            },
                          });
                          handleInputChange({
                            target: {
                              name: "inland_miscellaneous_gear_spearmg",
                              value: "",
                            },
                          });
                        }
                      }}
                      className="form-checkbox text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium text-sm">
                      Miscellaneous Gear
                    </span>
                  </div>
                  {/* Optional Expand/Collapse Icon */}
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${formData.inland_falling_gears ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </label>

                {/* Collapsible Content: show only if inland_traps_n_pots is checked */}
                {formData.inland_miscellaneous_gear && (
                  <div className="px-6 pb-4">
                    {/* First Sub-item: inland_miscellaneous_gear_spearmg */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_miscellaneous_gear_spearmg"
                        checked={
                          formData.inland_miscellaneous_gear_spearmg === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_miscellaneous_gear_spearmg",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_miscellaneous_gear_spearmg_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Spear (Sibat)
                      </span>
                      {formData.inland_miscellaneous_gear_spearmg && (
                        <input
                          type="number"
                          name="inland_miscellaneous_gear_spearmg_no"
                          value={
                            formData.inland_miscellaneous_gear_spearmg_no || ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* 2nd Sub-item: inland_miscellaneous_gear_speargunmg */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_miscellaneous_gear_speargunmg"
                        checked={
                          formData.inland_miscellaneous_gear_speargunmg === true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_miscellaneous_gear_speargunmg",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_miscellaneous_gear_speargunmg_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Spear Gun</span>
                      {formData.inland_miscellaneous_gear_speargunmg && (
                        <input
                          type="number"
                          name="inland_miscellaneous_gear_speargunmgn_no"
                          value={
                            formData.inland_miscellaneous_gear_speargunmg_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* 3rd Sub-item: inland_miscellaneous_gear_rakedredgemg */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_miscellaneous_gear_rakedredgemg"
                        checked={
                          formData.inland_miscellaneous_gear_rakedredgemg ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_miscellaneous_gear_rakedredgemg",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_miscellaneous_gear_rakedredgemg_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">Rake/Dredge</span>
                      {formData.inland_miscellaneous_gear_rakedredgemg && (
                        <input
                          type="number"
                          name="inland_miscellaneous_gear_rakedredgemg_no"
                          value={
                            formData.inland_miscellaneous_gear_rakedredgemg_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>

                    {/* 4th Sub-item: inland_miscellaneous_gear_fishsheltermg */}
                    <label className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        name="inland_miscellaneous_gear_fishsheltermg"
                        checked={
                          formData.inland_miscellaneous_gear_fishsheltermg ===
                          true
                        }
                        onChange={(e) => {
                          handleInputChange({
                            target: {
                              name: "inland_miscellaneous_gear_fishsheltermg",
                              value: e.target.checked,
                            },
                          });
                          if (!e.target.checked) {
                            handleInputChange({
                              target: {
                                name: "inland_miscellaneous_gear_fishsheltermg_no",
                                value: "",
                              },
                            });
                          }
                        }}
                        className="form-checkbox text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700 text-sm">
                        Fish Shelter
                      </span>
                      {formData.inland_miscellaneous_gear_fishsheltermg && (
                        <input
                          type="number"
                          name="inland_miscellaneous_gear_fishsheltermg_no"
                          value={
                            formData.inland_miscellaneous_gear_fishsheltermg_no ||
                            ""
                          }
                          onChange={handleInputChange}
                          placeholder="Enter quantity"
                          min={1}
                          className="block w-70 border-b border-blue-600 focus:outline-none focus:ring-0 focus:border-blue-700 text-sm"
                        />
                      )}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Certification */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Certification
          </h2>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700 mb-4">
              I certify that the information provided in this application is true and correct.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-500">Name of Applicant</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={`${formData.owner_name || 'Automatic from fisherfolk name'}`}
                    readOnly
                    className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900 italic"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Automatic name from fisherfolk data
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-500">Date of Application</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={`${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
                    readOnly
                    className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900 italic"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Automatic date
                </p>
              </div>
            </div>
          </div>

          {/* Signatories */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Signatories
          </h2>
          {loadingSignatories ? (
            <div className="text-center py-4">
              <Loader />
            </div>
          ) : (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 place-items-center">
                <div className="text-center flex flex-col items-center">
                  <label className="block text-sm text-gray-500">Enumerator</label>
                  <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
                    {signatories.fisheryCoordinator
                      ? formatNameWithMiddleInitial(
                        signatories.fisheryCoordinator.first_name,
                        signatories.fisheryCoordinator.middle_name,
                        signatories.fisheryCoordinator.last_name
                      ).toUpperCase()
                      : 'NOT ASSIGNED'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Municipal Fishery Coordinator</p>
                </div>
                <div className="text-center flex flex-col items-center">
                  <label className="block text-sm text-gray-500">Noted by</label>
                  <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
                    {signatories.notedBy
                      ? formatNameWithMiddleInitial(
                        signatories.notedBy.first_name,
                        signatories.notedBy.middle_name,
                        signatories.notedBy.last_name
                      ).toUpperCase()
                      : 'NOT ASSIGNED'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{signatories.notedBy?.position === 'Provincial Agriculturist' ? 'Provincial Agriculturist' : 'Municipal Agriculturist'}</p>
                </div>
              </div>
            </div>
          )}

        </div>
      );
    }
    if (currentStep === 2) {
      return (
        <div
          className="space-y-6"
          style={{ fontFamily: "Montserrat, sans-serif" }}
        >
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            {/* Confirmation/summary step, grouped by section */}
            {/* Registration Details summary */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
              Registration Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <span className="block text-sm text-gray-600">MFBR Number</span>
                <p className="text-base font-semibold text-gray-900">{formData.mfbr_number}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Type of Registration</span>
                <p className="text-base font-semibold text-gray-900">{formData.type_of_registration}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Application Date</span>
                <p className="text-base font-semibold text-gray-900">{formData.application_date}</p>
              </div>

            </div>

            {/* Owner/Operator summary */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
              Owner/Operator Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
              <span className="block text-sm text-gray-600">Fisherfolk Registration Number</span>
              <p className="text-base font-semibold text-gray-900">{formData.fisherfolk_registration_number}</p>
            </div>
              <div>
                <span className="block text-sm text-gray-600">Owner Name</span>
                <p className="text-base font-semibold text-gray-900">{formData.owner_name}</p>
              </div>

              <div>
                <span className="block text-sm text-gray-600">Owner Address</span>
                <p className="text-base font-semibold text-gray-900">{formData.owner_address}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Fishing Ground</span>
                <p className="text-base font-semibold text-gray-900">{formData.fishing_ground}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">FMA Number</span>
                <p className="text-base font-semibold text-gray-900">{formData.fma_number}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Homeport</span>
                <p className="text-base font-semibold text-gray-900">{formData.homeport}</p>
              </div>
            </div>

            {/* Boat Information summary */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
              Boat Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="block text-sm text-gray-600">Boat Name</span>
                <p className="text-base font-semibold text-gray-900">{formData.boat_name}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Boat Type</span>
                <p className="text-base font-semibold text-gray-900">{formData.boat_type}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Material Used</span>
                <p className="text-base font-semibold text-gray-900">{formData.material_used}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Built Place</span>
                <p className="text-base font-semibold text-gray-900">{formData.built_place}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Year Built</span>
                <p className="text-base font-semibold text-gray-900">{formData.built_year}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Type of Ownership</span>
                <p className="text-base font-semibold text-gray-900">{formData.type_of_ownership}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Engine Make</span>
                <p className="text-base font-semibold text-gray-900">{formData.engine_make}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Serial Number</span>
                <p className="text-base font-semibold text-gray-900">{formData.serial_number}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">Horsepower</span>
                <p className="text-base font-semibold text-gray-900">{formData.horsepower}</p>
              </div>
              <div>
                <span className="block text-sm text-gray-600">No. of Fishers</span>
                <p className="text-base font-semibold text-gray-900">{formData.no_fishers}</p>
              </div>
            </div>

            <h4
              className="text-xl font-medium mb-3 bg-blue-100 rounded px-3 py-2 border-b-2 mt-6"
              style={{ color: "#3863CF", borderBottomColor: "#3863CF" }}
            >
              Boat Measurements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong>Registered Length:</strong> {formData.registered_length}
              </div>
              <div>
                <strong>Registered Breadth:</strong>{" "}
                {formData.registered_breadth}
              </div>
              <div>
                <strong>Registered Depth:</strong> {formData.registered_depth}
              </div>
              <div>
                <strong>Tonnage Length:</strong> {formData.tonnage_length}
              </div>
              <div>
                <strong>Tonnage Breadth:</strong> {formData.tonnage_breadth}
              </div>
              <div>
                <strong>Tonnage Depth:</strong> {formData.tonnage_depth}
              </div>
              <div>
                <strong>Gross Tonnage:</strong> {formData.gross_tonnage}
              </div>
              <div>
                <strong>Net Tonnage:</strong> {formData.net_tonnage}
              </div>
            </div>
            <h4
              className="text-xl font-medium mb-3 bg-blue-100 rounded px-3 py-2 border-b-2 mt-6"
              style={{ color: "#3863CF", borderBottomColor: "#3863CF" }}
            >
              Marine Gears
            </h4>
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Marine Column */}
                <div>
                  <h4 className="text-lg font-semibold text-blue-700 border-b border-blue-200 pb-1 mb-3">
                    Marine Gear Types
                  </h4>
                  {[
                    ["marine_surround_net", "Surround Net"],
                    ["marine_falling_net", "Falling Net"],
                    ["marine_seine_net", "Seine Net"],
                    ["marine_scoop_net", "Scoop Net"],
                    ["marine_lift_net", "Lift Net"],
                    ["marine_cast_net", "Cast Net"],
                    ["marine_gill_net", "Gill Net"],
                    [
                      "marine_fishing_aggr_device",
                      "Fishing Aggregating Device",
                    ],
                    ["marine_traps_n_pots", "Traps & Pots"],
                    ["marine_hook_n_line", "Hooks & Line"],
                    ["marine_miscellaneous_gear", "Miscellaneous Gear"],
                  ]
                    .filter(([field]) => formData[field])
                    .map(([field, label]) => {

                      // Collect subgears
                      const subgears = Object.keys(formData)
                        .filter(
                          (key) =>
                            key.startsWith(field + "_") &&
                            !key.endsWith("_no") &&
                            formData[key]
                        )
                        .map((specKey) =>
                          formData[specKey + "_no"] && formData[specKey]
                            ? {
                              name: specKey
                                .replace(field + "_", "")
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c) => c.toUpperCase()),
                              qty: formData[specKey + "_no"],
                            }
                            : null
                        )
                        .filter(Boolean);

                      return (
                        <ul key={field} className="space-y-3">
                          <li className="border-b border-gray-200 pb-2">
                            <div className="font-medium text-gray-800">
                              {label}
                            </div>

                            {/* Subgears */}
                            {subgears.length > 0 && (
                              <ul className="mt-2 ml-4 space-y-2">
                                {subgears.map((sub, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-gray-700">
                                      {sub.name}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                      Qty: {sub.qty}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        </ul>
                      );
                    })}
                </div>

                {/* Inland Column */}
                <div>
                  <h4 className="text-lg font-semibold text-blue-700 border-b border-green-200 pb-1 mb-3">
                    Inland Gear Types
                  </h4>
                  {[
                    ["inland_hook_n_line", "Hook & Line"],
                    ["inland_set_longline", "Set Longline"],
                    ["inland_traps_n_pots", "Traps & Pots"],
                    ["inland_falling_gears", "Falling Gears"],
                    ["inland_scoop_net", "Scoop Net"],
                    ["inland_gill_net", "Gill Net"],
                    ["inland_miscellaneous_gear", "Miscellaneous Gear"],
                  ]
                    .filter(([field]) => formData[field])
                    .map(([field, label]) => {

                      const subgears = Object.keys(formData)
                        .filter(
                          (key) =>
                            key.startsWith(field + "_") &&
                            !key.endsWith("_no") &&
                            formData[key]
                        )
                        .map((specKey) =>
                          formData[specKey + "_no"] && formData[specKey]
                            ? {
                              name: specKey
                                .replace(field + "_", "")
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c) => c.toUpperCase()),
                              qty: formData[specKey + "_no"],
                            }
                            : null
                        )
                        .filter(Boolean);

                      return (
                        <ul key={field} className="space-y-3">
                          <li className="border-b border-gray-200 pb-2">
                            <div className="font-medium text-gray-800">
                              {label}
                            </div>

                            {/* Subgears */}
                            {subgears.length > 0 && (
                              <ul className="mt-2 ml-4 space-y-2">
                                {subgears.map((sub, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-gray-700">
                                      {sub.name}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                                      Type Quantity: {sub.qty}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        </ul>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Certification Section */}
            <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
              Certification
            </h2>
            <p className="text-gray-700 mb-4 italic">
              "I hereby certify that all information contained herein is true and correct."
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="block text-sm text-gray-600 mb-1">Name of Applicant</span>
                <p className="text-base font-semibold text-gray-900">
                  {formData.owner_name || 'Not specified'}
                </p>
              </div>
              <div>
                <span className="block text-sm text-gray-600 mb-1">Date of Application</span>
                <p className="text-base font-semibold text-gray-900">
                  {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>


            {/* Signatories Section */}
            <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
              <h4 className="text-xl font-semibold text-green-900 mb-4">Signatories</h4>
              {loadingSignatories ? (
                <div className="text-center py-4">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading signatories...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 place-items-center">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200 text-center flex flex-col items-center w-full">
                    <span className="block text-sm text-gray-600">Enumerator</span>
                    <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
                      {signatories.fisheryCoordinator
                        ? `${signatories.fisheryCoordinator.first_name} ${signatories.fisheryCoordinator.middle_name ? signatories.fisheryCoordinator.middle_name + ' ' : ''}${signatories.fisheryCoordinator.last_name}`
                        : 'Not assigned'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">Municipal Fishery Coordinator</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200 text-center flex flex-col items-center w-full">
                    <span className="block text-sm text-gray-600">Noted by</span>
                    <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
                      {signatories.notedBy
                        ? `${signatories.notedBy.first_name} ${signatories.notedBy.middle_name ? signatories.notedBy.middle_name + ' ' : ''}${signatories.notedBy.last_name}`
                        : 'Not assigned'}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{signatories.notedBy?.position === 'Provincial Agriculturist' ? 'Provincial Agriculturist' : 'Municipal Agriculturist'}</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      );
    }

    return null;
  };

  // Helper to catch render-time errors and show a friendly message + console log
  const SafeRenderStep = () => {
    try {
      return renderStep();
    } catch (err) {
      console.error("BoatRegistrationForm render error:", err);
      return (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          <strong>Render error:</strong> {err?.message || String(err)}
          <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap">{err?.stack}</pre>
        </div>
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {loading && (
        <div className="fixed inset-0 backdrop-blur-xs flex items-center justify-center z-50">
          <Loader />
        </div>
      )}
      {renderStep()}
      {/* Register another modal not used here; page handles prompts */}
      <div className="flex justify-between mt-8">
        {currentStep > 0 && (
          <button
            type="button"
            onClick={() => setCurrentStep(currentStep - 1)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
        )}
        <div className="flex justify-end space-x-3">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 ml-auto"
          >
            {currentStep === 0 ? "Next" : currentStep === 1 ? "Next" : "Submit"}
          </button>
        </div>
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: "", message: "" })}
        title={alertModal.title}
        message={alertModal.message}
        variant="warning"
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setCurrentStep(2);
        }}
        onConfirm={handleConfirmSubmit}
        title="Confirm Boat Registration"
        message="Are you sure you want to register this boat?"
        variant="primary"
      />

      {/* Error Modal */}
      <AlertModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: "" })}
        title="Selection Required"
        message={errorModal.message}
        variant="danger"
      />
    </form>
  );
};

BoatRegistrationForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  anotherAction: PropTypes.shape({ id: PropTypes.number.isRequired, reuse: PropTypes.bool.isRequired }),
};
export default BoatRegistrationForm;