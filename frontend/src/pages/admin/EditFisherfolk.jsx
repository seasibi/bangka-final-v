import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import SuccessModal from "../../components/SuccessModal";
import axios from "axios";
import { logActivity } from "../../utils/activityLog";
import PageTitle from "../../components/PageTitle";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/solid";
import {
  municipalityPrefixes,
  barangayOptions,
  organizationOptions,
} from "../../components/FisherfolkManagement/fisherfolkOptions";
import Loader from "../../components/Loader";
import { getBarangayVerifiers } from "../../services/barangayVerifierService";
import { getSignatories } from "../../services/signatoriesService";

const EditFisherfolk = ({ backPath = "/admin/fisherfolk" }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    registration_number: "",
    salutations: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    appelation: "",
    birth_date: "",
    age: "",
    birth_place: "",
    sex: "",
    nationality: "",
    civil_status: "",
    is_active: "",
    contact_number: "",
    fisherfolk_status: "",
    mothers_maidenname: "",
    fishing_ground: "",
    fma_number: "",
    religion: "",
    educational_background: "",
    household_month_income: "",
    other_source_income: false,
    farming_income: false,
    farming_income_salary: "",
    fisheries_income: false,
    fisheries_income_salary: "",
    with_voterID: false,
    voterID_number: "",
    is_CCT_4ps: false,
    is_ICC: false,
    main_source_livelihood: "",
    other_main_source_livelihood: "",
    other_source_livelihood: [],
    other_source_livelihood_other: "",
    fisherfolk_img: null,


    // Address fields
    street: "",
    barangay: "",
    municipality: "",
    province: "",
    region: "",
    residency_years: "",
    barangay_verifier: "",
    position: "",
    verified_date: "",

    // Household fields
    total_no_household_memb: "",
    no_male: "",
    no_female: "",
    no_children: "",
    no_in_school: "",
    no_out_school: "",
    no_employed: "",
    no_unemployed: "",

    // Organization fields
    organizations: [{ org_name: "", member_since: "", org_position: "" }],
    org_name: "",
    custom_org_name: "",
    member_since: "",
    org_position: "",

    // Contacts fields
    contact_fname: "",
    contact_lname: "",
    contact_mname: "",
    contact_relationship: "",
    contact_contactno: "",
    contact_municipality: "",
    contact_barangay: "",
    contact_street: "",
  });

  const [municipalities, setMunicipalities] = useState([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [barangaysAddress, setBarangaysAddress] = useState([]);
  const [barangaysContact, setBarangaysContact] = useState([]);
  const [barangayVerifier, setBarangayVerifier] = useState(null);
  const [verifiersByPosition, setVerifiersByPosition] = useState({});
  const [signatories, setSignatories] = useState({ municipal: null, mayor: null });

  const InfoField = ({ label, value }) => (
    <div>
      <p className="text-gray-600 text-sm">{label}</p>
      <p className="text-gray-800 font-medium">{value || "-"}</p>
    </div>
  );

  // Removed local getCookie, using shared utility instead

  useEffect(() => {
    fetchFisherfolkData();
  }, [id]);

  useEffect(() => {
    fetchMunicipalities();
  }, []);

  // Keep selectedMunicipality in sync with formData.municipality and fetched list
  useEffect(() => {
    if (!formData?.municipality || !municipalities?.length) {
      setSelectedMunicipality(null);
      return;
    }
    const target = String(formData.municipality).trim().toLowerCase();
    // Try direct match (case-insensitive)
    let match = municipalities.find(
      (m) => String(m.name).trim().toLowerCase() === target
    );
    // Handle common aliases
    if (!match) {
      const variants = [];
      if (target.includes("sto.")) variants.push(target.replace("sto.", "santo"));
      if (target.includes("santo")) variants.push(target.replace("santo", "sto."));
      if (target.includes("city of san fernando")) variants.push("san fernando");
      if (target === "san fernando") variants.push("city of san fernando");
      for (const v of variants) {
        match = municipalities.find(
          (m) => String(m.name).trim().toLowerCase() === v
        );
        if (match) break;
      }
    }
    setSelectedMunicipality(match || null);
  }, [formData.municipality, municipalities]);

  // Helper to find municipality object by name (case-insensitive with aliases)
  const findMunicipalityByName = (name) => {
    if (!name || !municipalities.length) return null;
    const target = String(name).trim().toLowerCase();
    let m = municipalities.find((x) => String(x.name).trim().toLowerCase() === target);
    if (!m) {
      const variants = [];
      if (target.includes("sto.")) variants.push(target.replace("sto.", "santo"));
      if (target.includes("santo")) variants.push(target.replace("santo", "sto."));
      if (target.includes("city of san fernando")) variants.push("san fernando");
      if (target === "san fernando") variants.push("city of san fernando");
      for (const v of variants) {
        m = municipalities.find((x) => String(x.name).trim().toLowerCase() === v);
        if (m) break;
      }
    }
    return m || null;
  };

  // Fetch barangays for current selectedMunicipality (address section)
  useEffect(() => {
    const load = async () => {
      if (!selectedMunicipality?.municipality_id) {
        setBarangaysAddress([]);
        return;
      }
      try {
        const token = getAccessToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(
          `http://localhost:8000/api/barangays/?municipality_id=${selectedMunicipality.municipality_id}`,
          { withCredentials: true, headers }
        );
        const list = Array.isArray(res.data) ? res.data : [];
        // Expect each item to have name
        setBarangaysAddress(list.map((b) => b.name));
      } catch (e) {
        console.error("Failed to fetch barangays (address)", e);
        setBarangaysAddress([]);
      }
    };
    load();
  }, [selectedMunicipality]);

  // Fetch barangays for contact municipality
  useEffect(() => {
    const load = async () => {
      const m = findMunicipalityByName(formData.contact_municipality);
      if (!m?.municipality_id) {
        setBarangaysContact([]);
        return;
      }
      try {
        const token = getAccessToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(
          `http://localhost:8000/api/barangays/?municipality_id=${m.municipality_id}`,
          { withCredentials: true, headers }
        );
        const list = Array.isArray(res.data) ? res.data : [];
        setBarangaysContact(list.map((b) => b.name));
      } catch (e) {
        console.error("Failed to fetch barangays (contact)", e);
        setBarangaysContact([]);
      }
    };
    load();
  }, [formData.contact_municipality, municipalities]);

  // Auto-default region/province if empty
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      region: prev.region || "Region 1",
      province: prev.province || "La Union",
      fishing_ground: prev.municipality || prev.fishing_ground,
      fma_number: prev.fma_number || "FMA-6",
    }));
  }, []);

  // Keep derived fields in sync when municipality or barangay/position changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      fishing_ground: prev.municipality,
    }));
  }, [formData.municipality, municipalities]);

  // Fetch barangay verifiers based on municipality & barangay
  useEffect(() => {
    const fetchVerifiers = async () => {
      try {
        if (!formData.municipality || !formData.barangay) {
          setBarangayVerifier(null);
          setVerifiersByPosition({});
          setFormData((prev) => ({ ...prev, barangay_verifier: "" }));
          return;
        }

        const muni = findMunicipalityByName(formData.municipality);
        if (!muni?.municipality_id) {
          setBarangayVerifier(null);
          setVerifiersByPosition({});
          setFormData((prev) => ({ ...prev, barangay_verifier: "" }));
          return;
        }

        const token = getAccessToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Find barangay object by name via barangaysAddress we loaded already; fallback to service
        let verifiers = await getBarangayVerifiers({
          municipality_id: muni.municipality_id,
          barangay_name: formData.barangay,
          is_active: true,
          headers,
        });
        verifiers = Array.isArray(verifiers) ? verifiers : [];
        const map = {};
        verifiers.forEach((v) => {
          map[v.position] = v;
        });
        setVerifiersByPosition(map);
        const captain = map["Barangay Captain"];
        setBarangayVerifier(captain || null);

        // If a position is selected, auto-fill the verifier name
        if (formData.position && map[formData.position]) {
          const p = map[formData.position];
          const full = `${p.first_name} ${p.middle_name ? p.middle_name + " " : ""}${p.last_name}`.trim();
          setFormData((prev) => ({ ...prev, barangay_verifier: full }));
        } else if (!formData.position && captain) {
          const full = `${captain.first_name} ${captain.middle_name ? captain.middle_name + " " : ""}${captain.last_name}`.trim();
          setFormData((prev) => ({ ...prev, barangay_verifier: full, position: "Barangay Captain" }));
        }
      } catch (error) {
        console.error("Error fetching verifier and signatories:", error);
        setBarangayVerifier(null);
        setVerifiersByPosition({});
        setFormData((prev) => ({ ...prev, barangay_verifier: "" }));
      }
    };
    fetchVerifiers();
  }, [formData.municipality, formData.barangay, municipalities]);

  // Fetch signatories (Municipal Agriculturist and Mayor) based on municipality only
  useEffect(() => {
    const fetchMunicipalSignatories = async () => {
      try {
        if (!formData.municipality) {
          setSignatories({ municipal: null, mayor: null });
          return;
        }
        const muni = findMunicipalityByName(formData.municipality);
        if (!muni?.municipality_id) {
          setSignatories({ municipal: null, mayor: null });
          return;
        }
        const token = getAccessToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const data = await getSignatories({ municipality_id: muni.municipality_id, is_active: true });
        const list = Array.isArray(data) ? data : (data?.results || []);
        const municipal = list.find((s) => s.position === 'Municipal Agriculturist') || null;
        const mayor = list.find((s) => s.position === 'Mayor') || null;
        setSignatories({ municipal, mayor });
      } catch (err) {
        console.error('Failed to fetch municipal signatories', err);
        setSignatories({ municipal: null, mayor: null });
      }
    };
    fetchMunicipalSignatories();
  }, [formData.municipality]);

  // Helper to get access token from cookie or localStorage
  // Removed getAccessToken. Authentication will use cookies only.
  // Helper to get access token from localStorage (if available)
  const getAccessToken = () => {
    const token = localStorage.getItem("access_token");
    console.log("[Token Check] LocalStorage access_token:", token);
    return token;
  };

  // Fetch municipalities from backend for dynamic options
  const fetchMunicipalities = async () => {
    try {
      const token = getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get("http://localhost:8000/api/municipalities/", {
        withCredentials: true,
        headers,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      // Prefer active municipalities first (keep all for edit compatibility)
      const sorted = list.slice().sort((a, b) => a.name.localeCompare(b.name));
      setMunicipalities(sorted);
    } catch (e) {
      console.error("Failed to fetch municipalities", e);
      setMunicipalities([]);
    }
  };

  const [contact_contactnoError, setContact_contactnoError] = useState("");
  const positions = [
    "Barangay Councilor",
    "Barangay Captain",
    "Fishery Coordinator",
    "Municipal Agriculturist",
  ];

  const fetchFisherfolkData = async () => {
    try {
      const token = getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.get(
        `http://localhost:8000/api/fisherfolk/${id}/`,
        { withCredentials: true, headers }
      );

      const data = response.data;

      // Extract organization (if nested)
      const org =
        data.organizations && data.organizations.length > 0
          ? data.organizations[0]
          : { org_name: "", member_since: "", org_position: "" };

      // Extract address (nested)
      const address = data.address || {};

      // Extract contacts (nested)
      const contacts = data.contacts || {};

      // Extract household (nested)
      const household = data.household || {};

      // Prepare organizations array
      let organizationsArray = [{ org_name: "", member_since: "", org_position: "" }];
      if (data.organizations && data.organizations.length > 0) {
        // Check if org_name is in predefined list
        const orgOptions = organizationOptions[address.municipality]?.[address.barangay] || [];
        
        organizationsArray = data.organizations.map(org => {
          // Check if this org_name exists in the predefined list (case-insensitive)
          const isInList = orgOptions.some(opt => 
            opt && org.org_name && opt.toLowerCase() === org.org_name.toLowerCase()
          );
          
          // If NOT in list and org_name exists and is not already "Others"
          if (!isInList && org.org_name && org.org_name.toLowerCase() !== "others") {
            // This is a custom organization - set dropdown to "Others" and save name in custom_org_name
            return {
              ...org,
              org_name: "Others",
              custom_org_name: org.org_name
            };
          }
          return org;
        });
      }

      // Get the first organization (fallback to any flat fields if present)
      let firstOrg = organizationsArray[0] || { org_name: "", member_since: "", org_position: "" };
      if ((!firstOrg.org_name && (data.org_name || data.member_since || data.org_position))) {
        firstOrg = {
          org_name: data.org_name || "",
          member_since: data.member_since || "",
          org_position: data.org_position || "",
        };
      }

      // Prepare fetched data
      let fetched = {
        ...formData,
        ...data,
        ...address,
        ...contacts,
        ...household,
        organizations: organizationsArray,
        org_name: firstOrg.org_name || "",
        custom_org_name: firstOrg.custom_org_name || "",
        member_since: firstOrg.member_since || "",
        org_position: firstOrg.org_position || "",
      };
      
      // Debug: Log organization data
      console.log("[EditFisherfolk] Organization data:", firstOrg);

      // Handle main_source_livelihood - if it's a custom value not in the predefined list, set it to "Others"
      const predefinedLivelihoods = ["Capture Fishing", "Aquaculture", "Fish Vending", "Gleaning", "Fish Processing"];
      let mainSourceLivelihood = data.main_source_livelihood || "";
      let otherMainSourceLivelihood = data.other_main_source_livelihood || "";
      
      if (mainSourceLivelihood && !predefinedLivelihoods.includes(mainSourceLivelihood) && mainSourceLivelihood.toLowerCase() !== "others") {
        // If the value is not in predefined list and not "Others", it's a custom value
        otherMainSourceLivelihood = mainSourceLivelihood;
        mainSourceLivelihood = "Others";
      }

      fetched = {
        ...fetched,
        fisherfolk_img: data.fisherfolk_img || null,
        main_source_livelihood: mainSourceLivelihood,
        other_main_source_livelihood: otherMainSourceLivelihood,
        other_source_livelihood: Array.isArray(data.other_source_livelihood) 
          ? data.other_source_livelihood 
          : [],
        // Map backend free-text detail to UI field
        other_source_livelihood_other: data.other_source_income || "",
        // Ensure boolean fields are properly set
        farming_income: Boolean(data.farming_income),
        fisheries_income: Boolean(data.fisheries_income),
        // Local UI aggregate flag (do not bind to backend free-text field)
        other_source_income: Boolean(data.farming_income || data.fisheries_income),
      };

      // Clean contact_number for input field
      if (fetched.contact_number) {
        if (fetched.contact_number.startsWith("+63")) {
          fetched.contact_number = fetched.contact_number.slice(3);
        } else if (fetched.contact_number.startsWith("09")) {
          fetched.contact_number = fetched.contact_number.slice(1);
        }
      }

      setFormData(fetched);
      console.log("Fetched Fisherfolk Data:", fetched);
    } catch (error) {
      console.error("Error fetching fisherfolk:", error);
      if (error.response?.status === 404) {
        setError("Fisherfolk not found.");
      } else {
        setError("Failed to fetch fisherfolk data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        // Store the file for submission
        fisherfolk_img: file,
        // Keep a separate preview for UI
        picturePreview: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e) => {
    const { name, value, type, files } = e.target;

    if (name === "contact_contactno") {
      if (!value) {
        setContact_contactnoError("Contact number is required.");
      } else if (value.length !== 10 || !/^9[0-9]{9}$/.test(value)) {
        setContact_contactnoError(
          "Contact number must start with 9 and be 10 digits long."
        );
      } else {
        // Additional rule: must differ from fisherfolk contact number
        if (value === (formData.contact_number || "")) {
          setContact_contactnoError("Contact person's number must be different from fisherfolk contact number.");
        } else {
          setContact_contactnoError("");
        }
      }
    }

    if (type === "file") {
      const file = files[0];
      if (file) {
        // Create an image object to check dimensions
        const img = new Image();
        img.onload = function () {
          const width = this.width;
          const height = this.height;

          // Check if dimensions match 2x2 inches (600x600 pixels at 300 DPI)
          if (width !== 600 || height !== 600) {
            alert(
              "Profile picture must be exactly 2x2 inches (600x600 pixels at 300 DPI)"
            );
            e.target.value = ""; // Clear the file input
            return;
          }

          setFormData((prevState) => ({
            ...prevState,
            [name]: file,
          }));
        };
        img.src = URL.createObjectURL(file);
      }
      return;
    }

    if (name === "birth_date") {
      const selectedDate = new Date(value);
      const today = new Date();

      // Calculate minimum birth date (18 years ago)
      const minDate = new Date();
      minDate.setFullYear(today.getFullYear() - 18);

      // Check if selected date makes the person at least 18 years old
      if (selectedDate > minDate) {
        alert("Fisherfolk must be at least 18 years old");
        return;
      }
    }

    // Normalize integer-only fields (strip non-digits and leading zeros)
    const intFields = [
      "residency_years",
      "no_male",
      "no_female",
      "no_children",
      "no_in_school",
      "no_out_school",
      "no_employed",
      "no_unemployed",
    ];
    let nextValue = value;
    if (intFields.includes(name)) {
      let digits = (nextValue || "").toString().replace(/[^0-9]/g, "");
      if (digits.length > 1) {
        digits = digits.replace(/^0+/, "");
        if (digits === "") digits = "0";
      }
      nextValue = digits;
    }

    // Auto-calculate total household members when male or female changes
    if (name === "no_male" || name === "no_female") {
      const male = name === "no_male" ? Number(nextValue || 0) : Number(formData.no_male || 0);
      const female = name === "no_female" ? Number(nextValue || 0) : Number(formData.no_female || 0);
      const total = male + female;
      
      setFormData((prevState) => ({
        ...prevState,
        [name]: nextValue,
        total_no_household_memb: total,
      }));
      return;
    }

    // Auto-calculate number of children when in/out school changes
    if (name === "no_in_school" || name === "no_out_school") {
      const inSchool = name === "no_in_school" ? Number(nextValue || 0) : Number(formData.no_in_school || 0);
      const outSchool = name === "no_out_school" ? Number(nextValue || 0) : Number(formData.no_out_school || 0);
      const children = inSchool + outSchool;
      setFormData((prev) => ({
        ...prev,
        [name]: nextValue,
        no_children: children,
      }));
      return;
    }

    // Residency years should not exceed age
    if (name === "residency_years") {
      const yrs = Number(nextValue || 0);
      const age = Number(formData.age || 0);
      const capped = Math.max(0, Math.min(yrs, age || yrs));
      setFormData((prev) => ({ ...prev, residency_years: capped }));
      return;
    }

    setFormData((prevState) => ({
      ...prevState,
      [name]: intFields.includes(name) ? nextValue : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Block if contact person's number equals fisherfolk's number
    if ((formData.contact_contactno || "") === (formData.contact_number || "")) {
      setContact_contactnoError("Contact person's number must be different from fisherfolk contact number.");
      return;
    }
    setIsSubmitModalOpen(true);
  };

  const handleCancelClick = () => {
    navigate(backPath);
  };

  const handleConfirmSubmit = async () => {
    try {
      const token = getAccessToken();
      const formDataToSend = new FormData();

    // Ensure contact_number includes correct prefix
    const processedFormData = { ...formData };
    if (processedFormData.contact_number) {
      let num = processedFormData.contact_number.trim();
      if (!/^\+639\d{9}$/.test(num) && !/^09\d{9}$/.test(num)) {
        if (/^9\d{9}$/.test(num)) {
          num = `+639${num.slice(1)}`;
        } else {
          num = `+63${num}`;
        }
      }
      processedFormData.contact_number = num;
    }

    // Strip commas from income fields before sending
    if (processedFormData.farming_income_salary) {
      processedFormData.farming_income_salary = processedFormData.farming_income_salary.toString().replace(/,/g, "");
    }
    if (processedFormData.fisheries_income_salary) {
      processedFormData.fisheries_income_salary = processedFormData.fisheries_income_salary.toString().replace(/,/g, "");
    }

    // Handle main source of livelihood - if "Others" is selected, ensure other_main_source_livelihood is set
    if (processedFormData.main_source_livelihood === "Others" && processedFormData.other_main_source_livelihood) {
      // Keep main_source_livelihood as "Others" and send custom value in other_main_source_livelihood
      // This will be handled by the Object.keys loop below
    } else if (processedFormData.main_source_livelihood !== "Others") {
      // If not "Others", clear the other_main_source_livelihood field
      processedFormData.other_main_source_livelihood = "";
    }

    // Handle organization name - if "Others" + custom name, save the custom name as org_name
    if (processedFormData.org_name === "Others" && processedFormData.custom_org_name) {
      processedFormData.org_name = processedFormData.custom_org_name;
    }

    // Append normal fields
    Object.keys(processedFormData).forEach((key) => {
      if (
        key !== "fisherfolk_img" &&
        key !== "other_source_livelihood" &&
        key !== "other_source_livelihood_other" &&
        key !== "other_source_income" && // Will be derived from OSL 'Others' text only
        key !== "custom_org_name" && // Don't send this separately
        key !== "organizations" && // We'll send as flattened keys below
        key !== "picturePreview" && // Don't send preview
        processedFormData[key] !== null &&
        processedFormData[key] !== undefined
      ) {
        formDataToSend.append(key, processedFormData[key]);
      }
    });

    // If 'Others' is selected, map free-text to backend field
    const osl = Array.isArray(processedFormData.other_source_livelihood)
      ? processedFormData.other_source_livelihood
      : [];
    const otherText = (processedFormData.other_source_livelihood_other ?? "").toString().trim();
    if (osl.includes("Others") && otherText) {
      formDataToSend.append("other_source_income", otherText);
    } else {
      // Ensure backend clears free-text when "Others" is not selected
      formDataToSend.append("other_source_income", "");
    }

    // Send all organizations
    const orgsToSend = Array.isArray(processedFormData.organizations) 
      ? processedFormData.organizations 
      : [];
    orgsToSend.forEach((org, idx) => {
      const orgNameToSend = org.org_name === "Others" && org.custom_org_name
        ? org.custom_org_name
        : org.org_name;
      if (orgNameToSend) formDataToSend.append(`organizations[${idx}][org_name]`, orgNameToSend);
      if (org.member_since) formDataToSend.append(`organizations[${idx}][member_since]`, org.member_since);
      const positionToSend = org.org_position === "Others" && org.custom_position
        ? org.custom_position
        : org.org_position;
      if (positionToSend) formDataToSend.append(`organizations[${idx}][org_position]`, positionToSend);
    });

    // Append array fields (like other_source_livelihood)
    // Send both JSON and repeated fields for compatibility
    const oslArr = Array.isArray(processedFormData.other_source_livelihood)
      ? processedFormData.other_source_livelihood
      : [];
    // Always send JSON string and repeated fields so backend definitely receives an explicit value
    if (typeof formDataToSend.set === "function") {
      formDataToSend.set("other_source_livelihood", JSON.stringify(oslArr));
    } else {
      formDataToSend.append("other_source_livelihood", JSON.stringify(oslArr));
    }
    // Clear any previously appended repeated keys then append current values
    oslArr.forEach((v) => formDataToSend.append("other_source_livelihood[]", v));

    // Append image only if it's a File (not a URL string)
    if (processedFormData.fisherfolk_img instanceof File) {
      formDataToSend.append("fisherfolk_img", processedFormData.fisherfolk_img);
    }

    // Debug: Log what's being sent
    console.log("[EditFisherfolk] Submitting data:");
    for (let [key, value] of formDataToSend.entries()) {
      console.log(`  ${key}:`, value);
    }

    const headers = {
      "Content-Type": "multipart/form-data",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await axios.put(
      `http://localhost:8000/api/fisherfolk/${id}/`,
      formDataToSend,
      { withCredentials: true, headers }
    );

      if (response.status === 200) {
      setIsSubmitModalOpen(false);
      setShowSuccessModal(true);
    }
  } catch (error) {
    setIsSubmitModalOpen(false);
    console.error("Error updating fisherfolk:", error);
    if (error.response) {
      console.error("Error response data:", error.response.data);
      const errorMessages = [];
      for (const [field, fieldErrors] of Object.entries(error.response.data)) {
        // Handle both array and string error formats
        const errorText = Array.isArray(fieldErrors) 
          ? fieldErrors.join(", ") 
          : String(fieldErrors);
        errorMessages.push(`${field.replace(/_/g, " ")}: ${errorText}`);
      }
      setError(errorMessages.join("\n"));
    } else {
      setError("Failed to update fisherfolk. Please try again.");
    }
  }
};


  if (loading) {
    return (
      <div className="p-4">
        <Loader />
      </div>
    );
  }

  return (
    <div
      className="container mx-auto px-4 py-8 font-montserrat"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      {/* Title and Back Button */}
      <div className="flex items-center mb-3 mt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div className="grid grid-cols-1 grid-rows-2 ml-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {currentStep === 1 ? "Edit Fisherfolk Profile" : "Confirm Fisherfolk Details"}
          </h1>
          <p className="text-base text-gray-700">
            {currentStep === 1
              ? "Edit fisherfolk personal details."
              : "Review the details before updating this fisherfolk."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      {currentStep === 1 && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-lg shadow"
          style={{ fontFamily: "Montserrat, sans-serif" }}
        >
          {/* Registration Number Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
            Registration Number
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Municipality <span className="text-red-500">*</span>
              </label>
              <Listbox
                value={formData.municipality}
                onChange={(val) => {
                  setFormData((prev) => ({
                    ...prev,
                    municipality: val,
                    barangay: "",
                    fishing_ground: val,
                  }));
                }}
              >
                <div className="relative mt-1">
                  <Listbox.Button
                    required
                    className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                  >
                    <span className="block truncate">
                      {formData.municipality || "Select municipality"}
                    </span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <ChevronUpDownIcon
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </span>
                  </Listbox.Button>

                  <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {municipalities.map((m) => (
                      <Listbox.Option
                        key={m.municipality_id}
                        value={m.name}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                          }`
                        }
                      >
                        {m.name}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={`${(selectedMunicipality?.prefix) || (municipalityPrefixes[formData.municipality]) || "XXX"}-${formData.registration_number}`}
                readOnly
                className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500 font-mono"
              />
            </div>
          </div>

          {/* Profile Information Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Profile Information
          </h2>
          <div className="grid grid-cols-3 grid-rows-1 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Salutations <span className="text-red-500">*</span>
              </label>
              <select
                name="salutations"
                value={formData.salutations}
                onChange={handleInputChange}
                required
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="" hidden selected>
                  Select Salutations
                </option>
                <option value="Mr">Mr</option>
                <option value="Ms">Ms</option>
                <option value="Mrs">Mrs</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                placeholder="Enter First Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Middle Name 
              </label>
              <input
                type="text"
                name="middle_name"
                value={formData.middle_name}
                onChange={handleInputChange}
                placeholder="Middle Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Last Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Appelation
              </label>
              <input
                type="text"
                name="appelation"
                value={formData.appelation}
                onChange={handleInputChange}
                placeholder="Appelation"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Birth Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Age <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="age"
                value={formData.age}
                readOnly
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                placeholder="Age"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Birth Place <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="birth_place"
                value={formData.birth_place}
                onChange={handleInputChange}
                placeholder="Birth Place"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Civil Status <span className="text-red-500">*</span>
              </label>
              <select
                name="civil_status"
                value={formData.civil_status}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Sex <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4 mt-3 ml-7">
                <label className="flex items-center mr-15">
                  <input
                    type="radio"
                    name="sex"
                    value="Male"
                    checked={formData.sex === "Male"}
                    onChange={handleInputChange}
                    required
                    className="mr-2"
                  />
                  Male
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="sex"
                    value="Female"
                    checked={formData.sex === "Female"}
                    onChange={handleInputChange}
                    required
                    className="mr-2"
                  />
                  Female
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-900 text-sm">
                  +63
                </span>
                <input
                  type="text"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleInputChange}
                  className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="9XXXXXXXXX"
                  maxLength="10"
                  minLength="10"
                  pattern="9[0-9]{9}"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nationality <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nationality"
                value={formData.nationality}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fisherfolk Status <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4 mt-3 ml-7">
                <label className="flex items-center mr-6">
                  <input
                    type="radio"
                    name="fisherfolk_status"
                    value="Part Time"
                    checked={formData.fisherfolk_status === "Part Time"}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  Part Time
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="fisherfolk_status"
                    value="Full Time"
                    checked={formData.fisherfolk_status === "Full Time"}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  Full Time
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mother's Maiden Name 
              </label>
              <input
                type="text"
                name="mothers_maidenname"
                value={formData.mothers_maidenname}
                onChange={handleInputChange}
                placeholder="Mother's Maiden Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fishing Ground <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="fishing_ground"
                value={formData.municipality}
                readOnly
                placeholder="Fishing Ground"
                className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                FMA Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="fma_number"
                value={formData.fma_number || "FMA-6"}
                readOnly
                placeholder="FMA Number"
                className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Religion <span className="text-red-500">*</span>
              </label>
              <select
                name="religion"
                value={formData.religion}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="">Select Religion</option>
                <option value="Roman Catholic">Roman Catholic</option>
                <option value="Protestant Christian">Protestant Christian</option>
                <option value="Iglesia Ni Cristo">Iglesia Ni Cristo</option>
                <option value="Aglipayan">Aglipayan</option>
                <option value="Islam">Islam</option>
                <option value="Evangelical">Evangelical</option>
                <option value="Seventh-Day Adventist">Seventh-Day Adventist</option>
                <option value="Jehovah'S Witnesses">Jehovah's Witnesses</option>
                <option value="Buddhist">Buddhist</option>
                <option value="Hindu">Hindu</option>
                <option value="No Religion">No Religion</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          {/* Address Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Address
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Region <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="region"
                value={formData.region || "Region 1"}
                readOnly
                className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Province
              </label>
              <input
                type="text"
                name="province"
                value={formData.province || "La Union"}
                readOnly
                className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                City/Municipality
              </label>
              <input
                type="text"
                name="municipality"
                value={formData.municipality}
                placeholder="Select Municipality first"
                readOnly
                className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Barangay
              </label>
              <Listbox
                value={formData.barangay}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, barangay: val }))
                }
                disabled={!formData.municipality}
              >
                <div className="relative mt-1">
                  <Listbox.Button
                    className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    disabled={!formData.municipality}
                  >
                    <span className="block truncate">
                      {formData.barangay ||
                        (!formData.municipality
                          ? "Select municipality first"
                          : "Select barangay")}
                    </span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <ChevronUpDownIcon
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </span>
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {barangaysAddress.map((brgy) => (
                      <Listbox.Option
                        key={brgy}
                        value={brgy}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                          }`
                        }
                      >
                        {brgy}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
              <label className="block text-sm font-medium text-gray-700">
                Street <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  name="contact_street"
                  value={formData.contact_street}
                  onChange={handleInputChange}
                  placeholder="Street"
                  className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Years of Residency</label>
              <input
                type="number"
                name="residency_years"
                value={formData.residency_years}
                onChange={handleInputChange}
                min={0}
                max={Number(formData.age || 0)}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              {Number(formData.residency_years || 0) > Number(formData.age || 0) && (
                <p className="text-sm text-red-500 mt-1">Years of residency cannot exceed age.</p>
              )}
            </div>
          </div>

          {/* Barangay Verifier Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Barangay Verifier Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Position</label>
              <select
                name="position"
                value={formData.position}
                onChange={(e) => {
                  const pos = e.target.value;
                  const v = verifiersByPosition[pos];
                  const full = v
                    ? `${v.first_name} ${v.middle_name ? v.middle_name + " " : ""}${v.last_name}`.trim()
                    : "";
                  setFormData((prev) => ({ ...prev, position: pos, barangay_verifier: full }));
                }}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                disabled={!formData.barangay}
              >
                <option value="" hidden>
                  Select Position
                </option>
                {Object.keys(verifiersByPosition).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name of Verifier</label>
              <input
                type="text"
                name="barangay_verifier"
                value={formData.barangay_verifier}
                readOnly
                className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Verified Date</label>
              <input
                type="date"
                name="verified_date"
                value={formData.verified_date}
                onChange={(e) => {
                  const today = new Date();
                  const picked = new Date(e.target.value);
                  if (picked > today) return; // disallow future
                  handleInputChange(e);
                }}
                max={new Date().toISOString().split("T")[0]}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
          </div>

          {/* Income Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Income Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
            <label className="block text-sm font-medium text-gray-700">
              Income Range
            </label>
            <div className="relative mt-1">
              <select
                name="household_month_income"
                value={formData.household_month_income}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
              >
                <option value="" hidden>
                  Select Income Range
                </option>
                <option value="Less than Php 5,000.00">
                  Less than Php 5,000.00
                </option>
                <option value="Php 5,000.00 - Php 10,000.00">
                  Php 5,000.00 - Php 10,000.00
                </option>
                <option value="Php 10,000.00 - Php 20,000.00">
                  Php 10,000.00 - Php 20,000.00
                </option>
                <option value="Php 20,000.00 - Php 30,000.00">
                  Php 20,000.00 - Php 30,000.00
                </option>
                <option value="Php 30,000.00 - Php 40,000.00">
                  Php 30,000.00 - Php 40,000.00
                </option>
                <option value="More than Php 40,000.00">
                  More than Php 40,000.00
                </option>
              </select>
            </div>
          </div>
          </div>

          {/* Other Source of Income Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Other Source of Income
        </h2>
        <div className="grid grid-cols-2  md:grid-cols-2 gap-4">
          <div className="row-start-1 row-end-2 flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Farming Income
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                name="farming_income"
                checked={formData.farming_income}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    farming_income: e.target.checked,
                    farming_income_salary: e.target.checked ? prev.farming_income_salary : "",
                    other_source_income:
                      e.target.checked || prev.fisheries_income,
                  }));
                }}
              />
              <span>Has Farming Income</span>
            </div>
            {formData.farming_income && (
              <div className="mt-2 ml-6 border-l-2 border-blue-300 pl-4">
                <input
                  type="text"
                  name="farming_income_salary"
                  value={formData.farming_income_salary}
                  onChange={(e) => {
                    let rawValue = e.target.value.replace(/,/g, "");
                    if (rawValue === "" || isNaN(rawValue)) {
                      handleInputChange({
                        target: { name: e.target.name, value: "" },
                      });
                      return;
                    }

                    const [intPart, decimalPart] = rawValue.split(".");
                    let formatted = new Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 0,
                    }).format(intPart);

                    if (decimalPart !== undefined) {
                      formatted += "." + decimalPart;
                    }

                    handleInputChange({
                      target: { name: e.target.name, value: formatted },
                    });
                  }}
                  onBlur={(e) => {
                    const rawValue = e.target.value.replace(/,/g, "");
                    if (rawValue) {
                      const numberValue = parseFloat(rawValue);
                      const formatted = new Intl.NumberFormat("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(numberValue);

                      handleInputChange({
                        target: { name: e.target.name, value: formatted },
                      });
                    }
                  }}
                  placeholder="Farming Income Amount"
                  className={`relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border ${
                    !formData.farming_income_salary
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  } text-gray-500`}
                  required
                />

                {!formData.farming_income_salary && (
                  <p className="mt-1 text-sm text-red-500">
                    Farming income is required.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="row-start-1 col-start-2 row-end-3 flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fisheries Income
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                name="fisheries_income"
                checked={formData.fisheries_income}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    fisheries_income: e.target.checked,
                    fisheries_income_salary: e.target.checked ? prev.fisheries_income_salary : "",
                    other_source_income:
                      e.target.checked || prev.farming_income,
                  }));
                }}
              />
              <span>Has Fisheries Income</span>
            </div>
            {formData.fisheries_income && (
              <div className="mt-2 ml-6 border-l-2 border-blue-300 pl-4">
                <input
                  type="text"
                  name="fisheries_income_salary"
                  value={formData.fisheries_income_salary}
                  onChange={(e) => {
                    let rawValue = e.target.value.replace(/,/g, ""); // strip commas
                    if (rawValue === "" || isNaN(rawValue)) {
                      handleInputChange({
                        target: { name: e.target.name, value: "" },
                      });
                      return;
                    }

                    // Format only with commas while typing (no decimals forced yet)
                    const [intPart, decimalPart] = rawValue.split(".");
                    let formatted = new Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 0,
                    }).format(intPart);

                    if (decimalPart !== undefined) {
                      formatted += "." + decimalPart;
                    }

                    handleInputChange({
                      target: { name: e.target.name, value: formatted },
                    });
                  }}
                  onBlur={(e) => {
                    const rawValue = e.target.value.replace(/,/g, "");
                    if (rawValue) {
                      const numberValue = parseFloat(rawValue);
                      const formatted = new Intl.NumberFormat("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(numberValue);

                      handleInputChange({
                        target: { name: e.target.name, value: formatted },
                      });
                    }
                  }}
                  placeholder="Fisheries Income Amount"
                  className={`relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border ${
                    !formData.fisheries_income_salary
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  } text-gray-500`}
                  required
                />

                {!formData.fisheries_income_salary && (
                  <p className="mt-1 text-sm text-red-500">
                    Fisheries income is required.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

          {/* Voter ID, CCT/ICC Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Other Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                With Voter ID
              </label>
              <input
                type="checkbox"
                name="with_voterID"
                checked={formData.with_voterID}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    with_voterID: e.target.checked,
                  }))
                }
                className="mr-2"
              />
              {formData.with_voterID && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700">Voter ID Number</label>
                  <input
                    type="text"
                    name="voterID_number"
                    value={formData.voterID_number}
                    onChange={handleInputChange}
                    className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="Enter Voter's ID"
                    required
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                CCT/4Ps Beneficiary
              </label>
              <input
                type="checkbox"
                name="is_CCT_4ps"
                checked={formData.is_CCT_4ps}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_CCT_4ps: e.target.checked,
                  }))
                }
                className="mr-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                ICC Member
              </label>
              <input
                type="checkbox"
                name="is_ICC"
                checked={formData.is_ICC}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, is_ICC: e.target.checked }))
                }
                className="mr-2"
              />
            </div>
          </div>

          {/* Livelihood Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
            Livelihood
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Main Source of Livelihood <span className="text-red-500">*</span>
              </label>
              <select
                name="main_source_livelihood"
                value={formData.main_source_livelihood}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              >
                <option value="" disabled hidden>
                  Select main source of livelihood
                </option>
                <option value="Capture Fishing">Capture Fishing</option>
                <option value="Aquaculture">Aquaculture</option>
                <option value="Fish Vending">Fish Vending</option>
                <option value="Gleaning">Gleaning</option>
                <option value="Fish Processing">Fish Processing</option>
                <option value="Others">Others</option>
              </select>
              {formData.main_source_livelihood === "Others" && (
                <div className="mt-2 ml-6 border-l-2 border-blue-300 pl-4">
                  <input
                    type="text"
                    name="other_main_source_livelihood"
                    value={formData.other_main_source_livelihood || ""}
                    onChange={handleInputChange}
                    placeholder="Specify main source of livelihood"
                    className="w-full px-4 py-2 border border-blue-300 rounded-lg mt-1"
                    required
                  />
                </div>
              )}
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Other Source of Livelihood
            </label>
            <div className="relative mt-1">
              <div className="flex flex-col gap-2">
                {[
                  "Capture Fishing",
                  "Aquaculture",
                  "Fish Vending",
                  "Gleaning",
                  "Fish Processing",
                  "Others",
                ].map((option) => {
                  const isDisabled =
                    option !== "Others" &&
                    formData.main_source_livelihood === option; // ✅ exclude "Others"

                  return (
                    <label
                      key={option}
                      className={`inline-flex items-center ${
                        isDisabled ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="other_source_livelihood"
                        value={option}
                        checked={
                          Array.isArray(formData.other_source_livelihood) &&
                          formData.other_source_livelihood.includes(option)
                        }
                        disabled={isDisabled}
                        onChange={(e) => {
                          let updated = Array.isArray(
                            formData.other_source_livelihood
                          )
                            ? [...formData.other_source_livelihood]
                            : [];
                          if (e.target.checked) {
                            updated.push(option);
                          } else {
                            updated = updated.filter((val) => val !== option);
                            // Clear the "other" text field if "Others" is unchecked
                            if (option === "Others") {
                              setFormData((prev) => ({
                                ...prev,
                                other_source_livelihood: updated,
                                other_source_livelihood_other: "",
                              }));
                              return;
                            }
                          }
                          setFormData((prev) => ({
                            ...prev,
                            other_source_livelihood: updated,
                          }));
                        }}
                        className="mr-2"
                      />
                      {option}
                    </label>
                  );
                })}

                {Array.isArray(formData.other_source_livelihood) &&
                  formData.other_source_livelihood.includes("Others") && (
                    <div className="mt-2 ml-6 border-l-2 border-blue-300 pl-4">
                      <input
                        type="text"
                        name="other_source_livelihood_other"
                        value={formData.other_source_livelihood_other || ""}
                        onChange={handleInputChange}
                        placeholder="Please specify other source"
                        className="w-full px-4 py-2 border border-blue-300 rounded-lg mt-1"
                        required
                      />
                    </div>
                  )}
              </div>
            </div>
          </div>
          </div>

          {/* Household Members Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">Household Members</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">No. of Male</label>
              <input type="number" name="no_male" value={formData.no_male} onChange={handleInputChange} min={0} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. of Female</label>
              <input type="number" name="no_female" value={formData.no_female} onChange={handleInputChange} min={0} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total Household Members</label>
              <input type="number" name="total_no_household_memb" value={formData.total_no_household_memb || 0} readOnly className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. of In School</label>
              <input type="number" name="no_in_school" value={formData.no_in_school} onChange={handleInputChange} min={0} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. of Out of School</label>
              <input type="number" name="no_out_school" value={formData.no_out_school} onChange={handleInputChange} min={0} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. of Children</label>
              <input type="number" name="no_children" value={formData.no_children || 0} readOnly className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. Employed</label>
              <input type="number" name="no_employed" value={formData.no_employed} onChange={handleInputChange} min={0} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. Unemployed</label>
              <input type="number" name="no_unemployed" value={formData.no_unemployed} onChange={handleInputChange} min={0} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
          </div>
          {Number(formData.total_no_household_memb || 0) - Number(formData.no_children || 0) !== (Number(formData.no_employed || 0) + Number(formData.no_unemployed || 0)) && (
            <p className="text-sm text-red-500 mt-1">Total - Children must equal Employed + Unemployed.</p>
          )}

          {/* Contact Person Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">Contact Person</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input type="text" name="contact_fname" value={formData.contact_fname} onChange={(e)=> setFormData(prev=>({...prev, contact_fname: e.target.value.replace(/\b\w/g, c=>c.toUpperCase())}))} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Middle Name</label>
              <input type="text" name="contact_mname" value={formData.contact_mname} onChange={(e)=> setFormData(prev=>({...prev, contact_mname: e.target.value.replace(/\b\w/g, c=>c.toUpperCase())}))} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input type="text" name="contact_lname" value={formData.contact_lname} onChange={(e)=> setFormData(prev=>({...prev, contact_lname: e.target.value.replace(/\b\w/g, c=>c.toUpperCase())}))} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Relationship</label>
              <select name="contact_relationship" value={formData.contact_relationship} onChange={handleInputChange} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900">
                <option value="" hidden>Select Relationship</option>
                <option value="Wife">Wife</option>
                <option value="Husband">Husband</option>
                <option value="Sister">Sister</option>
                <option value="Brother">Brother</option>
                <option value="Mother">Mother</option>
                <option value="Others">Others</option>
              </select>
            </div>
            {formData.contact_relationship === "Others" && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Specify Relationship</label>
                <input type="text" name="contact_relationship_other" value={formData.contact_relationship_other || ""} onChange={handleInputChange} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Number <span className="text-red-500">*</span></label>
              <input type="text" name="contact_contactno" value={formData.contact_contactno} onChange={handleInputChange} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" placeholder="9XXXXXXXXX" maxLength="10" minLength="10" pattern="9[0-9]{9}" required />
              {contact_contactnoError && <p className="text-sm text-red-500 mt-1">{contact_contactnoError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">City/Municipality</label>
              <Listbox value={formData.contact_municipality} onChange={(val)=> setFormData(prev=>({...prev, contact_municipality: val, contact_barangay: ""}))}>
                <div className="relative mt-1">
                  <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700">
                    <span className="block truncate">{formData.contact_municipality || "Select municipality"}</span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </span>
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {municipalities.map((m)=> (
                      <Listbox.Option key={m.municipality_id} value={m.name} className={({active})=>`relative cursor-default select-none py-2 pl-10 pr-4 ${active?"bg-blue-100 text-blue-900":"text-gray-900"}`}>
                        {m.name}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Barangay</label>
              <Listbox value={formData.contact_barangay} onChange={(val)=> setFormData(prev=>({...prev, contact_barangay: val}))} disabled={!formData.contact_municipality}>
                <div className="relative mt-1">
                  <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" disabled={!formData.contact_municipality}>
                    <span className="block truncate">{formData.contact_barangay || (!formData.contact_municipality?"Select municipality first":"Select barangay")}</span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </span>
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    {barangaysContact.map((brgy)=> (
                      <Listbox.Option key={brgy} value={brgy} className={({active})=>`relative cursor-default select-none py-2 pl-10 pr-4 ${active?"bg-blue-100 text-blue-900":"text-gray-900"}`}>
                        {brgy}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Street (optional)</label>
              <input type="text" name="contact_street" value={formData.contact_street} onChange={handleInputChange} className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900" />
            </div>
          </div>

          {/* Organization Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">Organization Information</h2>
          {(formData.organizations || []).map((org, idx) => {
            const opts = (organizationOptions[formData.municipality]?.[formData.barangay]) || [];
            const hasOrgName = !!(org.org_name && org.org_name.toString().trim());
            return (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 border-b border-gray-200 pb-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Organization Name</label>

                  {/* Match AddFisherfolkForm Listbox UI */}
                  <Listbox
                    value={org.org_name || ""}
                    onChange={(val) => {
                      const picked = (val ?? "").toString().trim();
                      const arr = [...(formData.organizations || [])];
                      arr[idx] = {
                        ...(arr[idx] || {}),
                        org_name: picked,
                      };

                      if (picked && picked.toLowerCase() !== "others") {
                        arr[idx].custom_org_name = "";
                      }

                      setFormData((prev) => ({
                        ...prev,
                        organizations: arr,
                      }));
                    }}
                  >
                    <div className="relative mt-1">
                      <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500">
                        {org.org_name || "Select Organization"}
                      </Listbox.Button>

                      <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {opts
                          .filter((opt) => (opt ?? "").toString().trim() !== "")
                          .map((option) => (
                            <Listbox.Option
                              key={option}
                              value={option}
                              className="cursor-default select-none py-2 pl-3 pr-4 text-gray-900 hover:bg-blue-100"
                            >
                              {option}
                            </Listbox.Option>
                          ))}
                        {!opts.some(
                          (o) =>
                            (o ?? "")
                              .toString()
                              .trim()
                              .toLowerCase() === "others"
                        ) && (
                          <Listbox.Option
                            value="Others"
                            className="cursor-default select-none py-2 pl-3 pr-4 text-gray-900 hover:bg-blue-100"
                          >
                            Others
                          </Listbox.Option>
                        )}
                      </Listbox.Options>
                    </div>
                  </Listbox>

                  {/* "Others" input */}
                  {(org.org_name || "").toString().trim().toLowerCase() ===
                    "others" && (
                    <input
                      type="text"
                      placeholder="Enter organization name"
                      value={org.custom_org_name || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        const arr = [...(formData.organizations || [])];
                        arr[idx] = {
                          ...(arr[idx] || {}),
                          org_name: "Others",
                          custom_org_name: value,
                        };
                        setFormData((prev) => ({
                          ...prev,
                          organizations: arr,
                        }));
                      }}
                      className="relative w-full mt-2 rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Member Since (Year)</label>
                  <input
                    type="text"
                    value={org.member_since || ""}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="YYYY"
                    disabled={!hasOrgName}
                    onChange={(e)=>{
                      const raw = e.target.value || "";
                      const year = raw.replace(/[^0-9]/g, "").slice(0, 4);
                      const arr = [...(formData.organizations||[])];
                      arr[idx] = { ...arr[idx], member_since: year };
                      setFormData((prev)=> ({...prev, organizations: arr }));
                    }}
                    className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Position</label>
                  <select
                    value={org.org_position}
                    disabled={!hasOrgName}
                    onChange={(e)=>{
                      const val = e.target.value;
                      const arr = [...(formData.organizations||[])];
                      arr[idx] = { ...arr[idx], org_position: val };
                      setFormData((prev)=> ({...prev, organizations: arr }));
                    }}
                    className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="" hidden>Select Position</option>
                    <option value="President">President</option>
                    <option value="Secretary">Secretary</option>
                    <option value="Member">Member</option>
                    <option value="Others">Others</option>
                  </select>
                  {org.org_position === "Others" && (
                    <input
                      type="text"
                      value={org.custom_position||""}
                      disabled={!hasOrgName}
                      onChange={(e)=>{
                        const arr = [...(formData.organizations||[])];
                        arr[idx] = { ...arr[idx], custom_position: e.target.value };
                        setFormData((prev)=> ({...prev, organizations: arr }));
                      }}
                      placeholder="Specify position"
                      className="w-full px-4 py-2 border border-blue-300 rounded-lg mt-2"
                    />
                  )}
                </div>
              </div>
            );
          })}
          <div className="mt-2">
            <button type="button" onClick={()=> setFormData(prev=> ({...prev, organizations: [...(prev.organizations||[]), { org_name: "", member_since: "", org_position: "" }] }))} className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Add Organization</button>
          </div>

          {/* Image/Attachments Section (redesigned like Add form) */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">Attachments</h2>
          <div className="space-y-3">
            {formData.picturePreview || formData.fisherfolk_img ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture <span className="text-green-600">✓</span></label>
                <p className="text-xs text-gray-500 mb-2">Photo preview (jpeg, png only)</p>
                <img
                  src={formData.picturePreview || (typeof formData.fisherfolk_img === 'string' ? formData.fisherfolk_img : (formData.fisherfolk_img ? URL.createObjectURL(formData.fisherfolk_img) : ''))}
                  alt="Profile Preview"
                  className="w-40 h-40 object-cover rounded-xl border border-gray-300 shadow-md mb-3"
                />
                <label className="inline-block cursor-pointer px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium">
                  Change Photo
                  <input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handlePictureChange} className="hidden" />
                </label>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">Upload Profile Picture <span className="text-red-500">*</span></label>
                <p className="text-xs text-gray-500 mt-1 mb-2">Photo preview (jpeg, png only)</p>
                <div className="relative mt-1">
                  <input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handlePictureChange} className="block w-full max-w-xs text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" required />
                </div>
              </div>
            )}
          </div>

          {/* Certification Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">Certification</h2>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-700 mb-4">I have personally reviewed the information on this application and I certify under penalty of perjury that to the best of my knowledge and belief the information on this application is true and correct, and that I understand this information is subject to public.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name of Applicant</label>
                <div className="relative mt-1">
                  <input type="text" value={`${formData.first_name} ${formData.middle_name ? formData.middle_name + ' ' : ''}${formData.last_name}`.trim() || 'Automatic from fisherfolk name'} readOnly className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900 italic" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Automatic name from fisherfolk data</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Application</label>
                <div className="relative mt-1">
                  <input type="text" value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} readOnly className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900 italic" />
                </div>
                <p className="text-xs text-gray-500 mt-1">Automatic date</p>
              </div>
            </div>
          </div>

          {/* Signatories Section */}
          <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">Signatories</h2>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 place-items-center">
              <div className="text-center flex flex-col items-center">
                <span className="block text-sm text-gray-500">Reviewed by</span>
                <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
                  {barangayVerifier ? `${barangayVerifier.first_name} ${barangayVerifier.middle_name ? barangayVerifier.middle_name + ' ' : ''}${barangayVerifier.last_name}` : 'Not assigned'}
                </p>
                <p className="text-xs text-gray-600 mt-1">Barangay Captain</p>
              </div>
              <div className="text-center flex flex-col items-center">
                <span className="block text-sm text-gray-500">Certified correct by</span>
                <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
                  {signatories.municipal ? `${signatories.municipal.first_name} ${signatories.municipal.middle_name ? signatories.municipal.middle_name + ' ' : ''}${signatories.municipal.last_name}` : 'Not assigned'}
                </p>
                <p className="text-xs text-gray-600 mt-1">Municipal Agriculturist</p>
              </div>
              <div className="text-center flex flex-col items-center">
                <span className="block text-sm text-gray-500">Approved by</span>
                <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
                  {signatories.mayor ? `${signatories.mayor.first_name} ${signatories.mayor.middle_name ? signatories.mayor.middle_name + ' ' : ''}${signatories.mayor.last_name}` : 'Not assigned'}
                </p>
                <p className="text-xs text-gray-600 mt-1">Mayor</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 mt-6">
            <Button
              type="button"
              onClick={handleCancelClick}
              className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Update Fisherfolk
            </Button>
          </div>
        </form>
      )}
      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Review Fisherfolk Details</h2>

          {/* Profile Section */}
          <h3 className="font-semibold text-lg mt-4">Profile Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoField label="First Name" value={formData.first_name} />
            <InfoField label="Middle Name" value={formData.middle_name} />
            <InfoField label="Last Name" value={formData.last_name} />
            <InfoField label="Appelation" value={formData.appelation} />
            <InfoField label="Birth Date" value={formData.birth_date} />
            <InfoField label="Birth Place" value={formData.birth_place} />
            <InfoField label="Civil Status" value={formData.civil_status} />
            <InfoField label="Sex" value={formData.sex} />
            <InfoField label="Nationality" value={formData.nationality} />
            <InfoField
              label="Registration Number"
              value={formData.registration_number}
            />
          </div>

          {/* Address Section */}
          <h3 className="font-semibold text-lg mt-4">Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoField label="Region" value={formData.region} />
            <InfoField label="Province" value={formData.province} />
            <InfoField label="Street" value={formData.street} />
            <InfoField
              label="Barangay Verifier"
              value={formData.barangay_verifier}
            />
            <InfoField label="Position" value={formData.position} />
            <InfoField label="Verified Date" value={formData.verified_date} />
          </div>

          {/* Household Section */}
          <h3 className="font-semibold text-lg mt-4">Household</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <InfoField
              label="Total Members"
              value={formData.total_no_household_memb}
            />
            <InfoField label="Male" value={formData.no_male} />
            <InfoField label="Female" value={formData.no_female} />
            <InfoField label="Children" value={formData.no_children} />
            <InfoField label="In School" value={formData.no_in_school} />
            <InfoField label="Out of School" value={formData.no_out_school} />
            <InfoField label="Employed" value={formData.no_employed} />
            <InfoField label="Unemployed" value={formData.no_unemployed} />
          </div>

          {/* Organization Section */}
          <h3 className="font-semibold text-lg mt-4">Organization</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoField 
              label="Organization Name" 
              value={formData.org_name === "Others" && formData.custom_org_name 
                ? formData.custom_org_name 
                : formData.org_name} 
            />
            <InfoField label="Member Since" value={formData.member_since} />
            <InfoField label="Position" value={formData.org_position} />
          </div>

          {/* Contact Person Section */}
          <h3 className="font-semibold text-lg mt-4">Contact Person</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoField label="First Name" value={formData.contact_fname} />
            <InfoField label="Last Name" value={formData.contact_lname} />
            <InfoField
              label="Relationship"
              value={formData.contact_relationship}
            />
            <InfoField
              label="Contact Number"
              value={formData.contact_contactno}
            />
            <InfoField label="Address" value={formData.contact_address} />
          </div>

          {/* Income Section */}
          <h3 className="font-semibold text-lg mt-4">Income</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField
              label="Household Monthly Income"
              value={formData.household_month_income}
            />
            <InfoField
              label="Other Source of Income"
              value={formData.other_source_income}
            />
          </div>

          {/* Other Info Section */}
          <h3 className="font-semibold text-lg mt-4">Other Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoField
              label="With Voter ID"
              value={formData.with_voterID ? "Yes" : "No"}
            />
            <InfoField
              label="CCT/4Ps Beneficiary"
              value={formData.is_CCT_4ps ? "Yes" : "No"}
            />
            <InfoField
              label="ICC Member"
              value={formData.is_ICC ? "Yes" : "No"}
            />
          </div>

          {/* Livelihood Section */}
          <h3 className="font-semibold text-lg mt-4">Livelihood</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField
              label="Main Source of Livelihood"
              value={formData.main_source_livelihood}
            />
            <InfoField
              label="Other Source of Livelihood"
              value={Array.isArray(formData.other_source_livelihood) 
                ? formData.other_source_livelihood.join(", ") 
                : formData.other_source_livelihood}
            />
          </div>

          {/* Profile Image */}
          <h3 className="font-semibold text-lg mt-4">Profile Image</h3>
          {formData.fisherfolk_img && (
            <img
              src={
                typeof formData.fisherfolk_img === "string"
                  ? formData.fisherfolk_img
                  : URL.createObjectURL(formData.fisherfolk_img)
              }
              alt="Fisherfolk"
              className="w-32 h-32 object-cover rounded-lg"
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-6">
            <Button onClick={() => setCurrentStep(1)} variant="secondary">
              Back
            </Button>
            <Button onClick={() => setIsSubmitModalOpen(true)}>
              Confirm & Update
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm Update"
        message="Are you sure you want to update this fisherfolk?"
        confirmText="Update"
        cancelText="Cancel"
      />

      <SuccessModal
        isOpen={showSuccessModal}
        message={`Fisherfolk ${formData.first_name} ${formData.last_name} successfully updated.`}
        onClose={() => {
          setShowSuccessModal(false);
          navigate("/admin/fisherfolk");
        }}
      />
    </div>
  );
};

export default EditFisherfolk;