import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon } from "@heroicons/react/24/solid";
import Button from "../Button";
import AlertModal from "../AlertModal";
import ConfirmModal from "../ConfirmModal";
import { checkRegistrationNumber } from "../../services/fisherfolkService";
import useMunicipalities from "../../hooks/useMunicipalities";
import { getBarangays } from "../../services/municipalityService";
import { getBarangayVerifiers } from "../../services/barangayVerifierService";
import { getSignatories } from "../../services/signatoriesService";
import {
  barangayOptions,
  organizationOptions,
} from "../../components/FisherfolkManagement/fisherfolkOptions";

const Field = ({ label, value }) => (
  <div>
    <span className="block text-sm text-gray-500">{label}</span>
    <p className="mt-1 text-base font-medium text-gray-900">{value || "N/A"}</p>
  </div>
);

const positions = [
  "Barangay Captain",
  "Barangay Secretary",
  "Fishing Coordinator",
];
const today = new Date().toISOString().split("T")[0];

const AddFisherfolkForm = forwardRef(({
  onSubmit,
  error,
  loading,
  initialData,
  setFormTitle,
  setFormSubtitle,
  setCurrentStep: setParentCurrentStep,
}, ref) => {
  const { user } = useAuth();
  const { municipalities, municipalityPrefixes, loading: municipalitiesLoading, refetch } = useMunicipalities();
  const [availableBarangays, setAvailableBarangays] = useState([]);
  const [contactBarangays, setContactBarangays] = useState([]);
  const [formData, setFormData] = useState(() => {
    // Try to load from localStorage if no initialData
    if (!initialData) {
      const savedData = localStorage.getItem('addFisherfolkFormData');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          console.log('[DEBUG] Loaded form data from localStorage');
          return parsed;
        } catch (e) {
          console.error('Error parsing saved fisherfolk form data:', e);
        }
      }
    }
    
    const initialFormData = initialData || {
      registration_number: "",
      salutations: "",
      last_name: "",
      first_name: "",
      middle_name: "",
      appelation: "",
      birth_date: "",
      age: "",
      birth_place: "",
      civil_status: "",
      sex: "Male",
      contact_number: "",
      nationality: "Filipino",
      fisherfolk_status: "part time",
      mothers_maidenname: "",
      fishing_ground: "",
      fma_number: "FMA-6",
      religion: "",
      other_religion: "",
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
      other_source_livelihood: [],
      other_source_livelihood_other: "",
      fisherfolk_img: null,
      is_active: true,
      street: "",
      barangay: "",
      municipality: "",
      province: "La Union",
      region: "Region 1",
      residency_years: "",
      barangay_verifier: "",
      position: "",
      verified_date: "",
      total_no_household_memb: 0,
      no_male: "",
      no_female: "",
      no_children: "",
      no_in_school: "",
      no_out_school: "",
      no_employed: "",
      no_unemployed: "",
      organizations: [{ org_name: "", member_since: "", org_position: "" }],
      contact_fname: "",
      contact_mname: "",
      contact_lname: "",
      contact_relationship: "",
      contact_relationship_other: "",
      contact_contactno: "",
      contact_municipality: "",
      contact_barangay: "",
      contact_street: "",
      picturePreview: null,
      created_by: user?.id || null,
      // Certification fields
      applicant_name: "",
      application_date: "",
      // Signatories fields
      reviewed_by: "",
      certified_by: "",
      approved_by: "",
    };
    console.log('[DEBUG] Initial formData.municipality:', initialFormData.municipality);
    return initialFormData;
  });
  const [errors, setErrors] = useState({});
  const [contactError, setContactError] = useState("");
  const [contact_contactnoError, setContact_contactnoError] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' });
  const [regNumberError, setRegNumberError] = useState("");
  const [isCheckingRegNumber, setIsCheckingRegNumber] = useState(false);
  const regNumberTimeoutRef = useRef(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [barangayVerifier, setBarangayVerifier] = useState(null);
  const [verifiersByPosition, setVerifiersByPosition] = useState({});
  const [signatories, setSignatories] = useState({ municipal: null, mayor: null });

  // Save formData to localStorage whenever it changes
  useEffect(() => {
    // Don't save file objects to localStorage
    const dataToSave = { ...formData, fisherfolk_img: null };
    localStorage.setItem('addFisherfolkFormData', JSON.stringify(dataToSave));
  }, [formData]);

  // Clear localStorage after successful submission
  const clearFormData = () => {
    localStorage.removeItem('addFisherfolkFormData');
  };

  // Live duplicate detection between contact numbers (runs on any change)
  useEffect(() => {
    const norm = (s) => (s || '').replace(/\D/g, '').slice(0, 10);
    const a = norm(formData.contact_number);
    const b = norm(formData.contact_contactno);
    if (a && b && a === b) {
      setContactError('Must be different from Contact Person Number');
      setContact_contactnoError('Must be different from fisherfolk Contact Number');
    } else {
      if (contactError === 'Must be different from Contact Person Number') setContactError('');
      if (contact_contactnoError === 'Must be different from fisherfolk Contact Number') setContact_contactnoError('');
    }
  }, [formData.contact_number, formData.contact_contactno]);

  // Call handleConfirmSubmit directly (parent will clear on success)
  const handleConfirmSubmitWithClear = () => {
    handleConfirmSubmit();
  };

  // Expose handleBack and clearFormData functions to parent component via ref
  useImperativeHandle(ref, () => ({
    handleBack: () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentStep(1);
      if (setParentCurrentStep) setParentCurrentStep(1);
      setRegNumberError('');
      setIsCheckingRegNumber(false);
    },
    clearFormData: () => {
      clearFormData();
    }
  }));

  // Refetch municipalities on mount to ensure fresh data
  useEffect(() => {
    if (refetch) {
      refetch();
    }
  }, []);

  // Validate and reset municipality if it's no longer in the list
  useEffect(() => {
    if (!municipalitiesLoading && formData.municipality) {
      const muniExists = municipalities.some(m => m.name === formData.municipality);
      if (!muniExists) {
        console.log('[WARNING] Municipality not found in list, clearing:', formData.municipality);
        setFormData(prev => ({ ...prev, municipality: '', barangay: '', registration_number: '' }));
      }
    }
  }, [municipalities, municipalitiesLoading, formData.municipality]);

  // Auto-populate municipality for Municipal Agriculturist users
  useEffect(() => {
    if (user?.user_role === 'municipal_agriculturist' && user?.municipality && !initialData && !municipalitiesLoading) {
      // Check if the user's municipality exists in the list
      const muniExists = municipalities.some(m => m.name === user.municipality);
      if (muniExists) {
        console.log('[AUTO-POPULATE] Setting municipality to:', user.municipality);
        setFormData((prev) => ({
          ...prev,
          municipality: user.municipality,
        }));
      } else {
        console.warn('[AUTO-POPULATE] User municipality not found in list:', user.municipality);
        console.warn('[AUTO-POPULATE] Available municipalities:', municipalities.map(m => m.name));
        // Try to find a close match (case-insensitive partial match)
        const closeMatch = municipalities.find(m => 
          m.name.toLowerCase().includes(user.municipality.toLowerCase()) ||
          user.municipality.toLowerCase().includes(m.name.toLowerCase())
        );
        if (closeMatch) {
          console.log('[AUTO-POPULATE] Using close match:', closeMatch.name);
          setFormData((prev) => ({
            ...prev,
            municipality: closeMatch.name,
          }));
        }
      }
    }
  }, [user, initialData, municipalities, municipalitiesLoading]);

  useEffect(() => {
    console.log('[DEBUG] Municipality changed in useEffect:', formData.municipality);
    if (formData.municipality) {
      setFormData((prev) => ({
        ...prev,
        fishing_ground: formData.municipality, // automatically set fishing ground to match municipality
      }));
    }
  }, [formData.municipality]);

  // Debug effect to monitor any unexpected municipality changes
  useEffect(() => {
    console.log('[DEBUG] Current formData.municipality:', formData.municipality);
  }, [formData.municipality]);

  // Fetch barangays when municipality changes
  useEffect(() => {
    const fetchBarangays = async () => {
      if (!formData.municipality) {
        setAvailableBarangays([]);
        return;
      }

      try {
        // Find the selected municipality from the list
        const selectedMuni = municipalities.find(m => m.name === formData.municipality);
        if (selectedMuni) {
          const barangays = await getBarangays({ municipality_id: selectedMuni.municipality_id });
          setAvailableBarangays(barangays.map(b => b.name).sort());
        } else {
          // Fallback to hardcoded data if municipality not found in API
          setAvailableBarangays(barangayOptions[formData.municipality] || []);
        }
      } catch (error) {
        console.error('Error fetching barangays:', error);
        // Fallback to hardcoded data
        setAvailableBarangays(barangayOptions[formData.municipality] || []);
      }
    };

    fetchBarangays();
  }, [formData.municipality, municipalities]);

  // Fetch contact barangays when contact municipality changes
  useEffect(() => {
    const fetchContactBarangays = async () => {
      if (!formData.contact_municipality) {
        setContactBarangays([]);
        return;
      }

      try {
        // Find the selected municipality from the list
        const selectedMuni = municipalities.find(m => m.name === formData.contact_municipality);
        if (selectedMuni) {
          const barangays = await getBarangays({ municipality_id: selectedMuni.municipality_id });
          setContactBarangays(barangays.map(b => b.name).sort());
        } else {
          // Fallback to hardcoded data if municipality not found in API
          setContactBarangays(barangayOptions[formData.contact_municipality] || []);
        }
      } catch (error) {
        console.error('Error fetching contact barangays:', error);
        // Fallback to hardcoded data
        setContactBarangays(barangayOptions[formData.contact_municipality] || []);
      }
    };

    fetchContactBarangays();
  }, [formData.contact_municipality, municipalities]);

  // Fetch barangay verifiers and signatories; auto-fill verifier name by selected position
  useEffect(() => {
    const fetchVerifierAndSignatories = async () => {
      if (!formData.municipality || !formData.barangay) {
        setBarangayVerifier(null);
        setVerifiersByPosition({});
        setSignatories({ municipal: null, mayor: null });
        // clear name when no barangay
        setFormData(prev => ({ ...prev, barangay_verifier: '' }));
        return;
      }

      try {
        const selectedMuni = municipalities.find(m => m.name === formData.municipality);
        const selectedBarangay = availableBarangays.find(b => b === formData.barangay);
        
        if (selectedMuni && selectedBarangay) {
          // Fetch all barangays to get the barangay_id
          const barangays = await getBarangays({ municipality_id: selectedMuni.municipality_id });
          const barangay = barangays.find(b => b.name === selectedBarangay);
          
          if (barangay) {
            // Fetch barangay verifiers for this barangay
            const verifiers = await getBarangayVerifiers({
              municipality_id: selectedMuni.municipality_id,
              barangay_id: barangay.barangay_id,
              is_active: true
            });
            const map = {};
            verifiers.forEach(v => { map[v.position] = v; });
            setVerifiersByPosition(map);
            const captain = map['Barangay Captain'];
            setBarangayVerifier(captain || null);

            // Auto-fill Name of Verifier when position is selected
            if (formData.position) {
              const sel = map[formData.position];
              const full = sel ? `${sel.first_name} ${sel.middle_name ? sel.middle_name + ' ' : ''}${sel.last_name}` : '';
              setFormData(prev => ({ ...prev, barangay_verifier: full }));
            } else {
              setFormData(prev => ({ ...prev, barangay_verifier: '' }));
            }

            // Fetch signatories
            const allSignatories = await getSignatories({
              municipality_id: selectedMuni.municipality_id,
              is_active: true
            });
            
            const municipal = allSignatories.find(s => s.position === 'Municipal Agriculturist');
            const mayor = allSignatories.find(s => s.position === 'Mayor');
            
            setSignatories({ municipal, mayor });
          }
        }
      } catch (error) {
        console.error('Error fetching verifier and signatories:', error);
        setBarangayVerifier(null);
        setVerifiersByPosition({});
        setSignatories({ municipal: null, mayor: null });
        setFormData(prev => ({ ...prev, barangay_verifier: '' }));
      }
    };

    fetchVerifierAndSignatories();
  }, [formData.municipality, formData.barangay, formData.position, municipalities, availableBarangays]);

  // Real-time registration number validation
  useEffect(() => {
    // Clear previous timeout
    if (regNumberTimeoutRef.current) {
      clearTimeout(regNumberTimeoutRef.current);
    }

    // Prepare registration number (numeric part only)

    // Only validate if we're on step 1 and have a complete registration number
    if (currentStep === 1 && formData.municipality && formData.registration_number && formData.registration_number.length >= 15) {
      setIsCheckingRegNumber(true);
      
      // Debounce validation by 500ms
      regNumberTimeoutRef.current = setTimeout(async () => {
        try {
          const isAvailable = await checkRegistrationNumber(formData.registration_number);
          if (!isAvailable) {
            setRegNumberError('This registration number already exists');
          } else {
            setRegNumberError('');
          }
        } catch (err) {
          console.error('Registration number check failed:', err);
          setRegNumberError('');
        } finally {
          setIsCheckingRegNumber(false);
        }
      }, 500);
    } else {
      setRegNumberError('');
      setIsCheckingRegNumber(false);
    }

    // Cleanup on unmount
    return () => {
      if (regNumberTimeoutRef.current) {
        clearTimeout(regNumberTimeoutRef.current);
      }
    };
  }, [formData.registration_number, formData.municipality, currentStep]);

  // Update form title and subtitle based on current step
  useEffect(() => {
    if (currentStep === 1) {
      setFormTitle?.("Add New Fisherfolk");
      setFormSubtitle?.(
        "Please fill out the form and confirm details to register a new fisherfolk."
      );
    } else if (currentStep === 2) {
      setFormTitle?.("Confirm New Fisherfolk Details");
      setFormSubtitle?.("Review the information before submitting.");
    }
  }, [currentStep, setFormTitle, setFormSubtitle]);

  const InfoField = ({ label, value, className }) => (
    <div className={className}>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-base font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );

  const ErrorText = ({ name }) => (
    errors && errors[name] ? (
      <span className="mt-1 text-xs text-red-600 block">{errors[name]}</span>
    ) : null
  );

  const toTitleCase = (str) => {
    if (!str) return "";
    return str
      .toString()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === "checkbox" ? checked : value;

    // Title case for specific fields
    const titleCaseFields = [
      "first_name",
      "last_name",
      "middle_name",
      "mothers_maidenname",
      "birth_place",
      "barangay_verifier",
      "contact_fname",
      "contact_mname",
      "contact_lname",
    ];
    if (titleCaseFields.includes(name)) {
      newValue = toTitleCase(newValue);
    }

    // Integer-only numeric fields: strip non-digits and prevent negatives/decimals
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
    if (intFields.includes(name)) {
      let digits = (newValue || "").toString().replace(/[^0-9]/g, "");
      // Strip leading zeros but keep a single 0 if the value is all zeros
      if (digits.length > 1) {
        digits = digits.replace(/^0+/, "");
        if (digits === "") digits = "0";
      }
      newValue = digits;
    }

    // Start with current formData
    let updatedFormData = { ...formData, [name]: newValue };
    let updatedErrors = { ...errors };

    const toNum = (v, def = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    };

    // Residency years cannot exceed age
    if (name === "residency_years") {
      const age = parseInt(formData.age || 0);
      const residencyYears = parseInt(newValue || 0);
      if (residencyYears > age) {
        updatedFormData.residency_years = age;
        updatedErrors.residency_years = "Years of Residency cannot exceed Age.";
      } else {
        updatedErrors.residency_years = null;
      }
    }

    // Household children cannot exceed total household members
    if (name === "no_children") {
      const total = toNum(formData.total_no_household_memb, 0);
      const nv = toNum(newValue, 0);
      if (nv > total) {
        updatedErrors.no_children = "Number of children cannot exceed total household members.";
        updatedFormData[name] = total;
      } else {
        updatedErrors.no_children = null;
        updatedFormData[name] = nv;
      }
    }

    // Auto-calculate total household members and downstream splits
    if (name === "no_male" || name === "no_female") {
      const male = name === "no_male" ? toNum(newValue, 0) : toNum(formData.no_male, 0);
      const female = name === "no_female" ? toNum(newValue, 0) : toNum(formData.no_female, 0);
      updatedFormData.no_male = male;
      updatedFormData.no_female = female;
      // total = male + female
      const total = Math.max(0, male + female);
      updatedFormData.total_no_household_memb = total;

      // children = in_school + out_school, must be < total (if total > 0)
      let inSch = toNum(updatedFormData.no_in_school, 0);
      let outSch = toNum(updatedFormData.no_out_school, 0);
      const maxChildren = total > 0 ? Math.max(total - 1, 0) : 0; // strictly less than total
      if (inSch + outSch > maxChildren) {
        // clamp out-of-school to fit
        outSch = Math.max(0, Math.min(outSch, Math.max(maxChildren - inSch, 0)));
        updatedErrors.school_split = null;
      }
      updatedFormData.no_in_school = inSch;
      updatedFormData.no_out_school = outSch;
      updatedFormData.no_children = inSch + outSch;

      // employment must equal total - children
      const adults = Math.max(total - (inSch + outSch), 0);
      let employed = Math.min(toNum(updatedFormData.no_employed, 0), adults);
      updatedFormData.no_employed = employed;
      updatedFormData.no_unemployed = adults - employed;
      updatedErrors.no_children = null;
      updatedErrors.employment_split = null;
    }

    // When in-school or out-of-school changes:
    // children = in_school + out_of_school, must be < total; employed + unemployed = total - children
    if (name === "no_in_school" || name === "no_out_school") {
      const total = toNum(updatedFormData.total_no_household_memb, 0);
      let inSch = name === "no_in_school" ? toNum(newValue, 0) : toNum(updatedFormData.no_in_school, 0);
      let outSch = name === "no_out_school" ? toNum(newValue, 0) : toNum(updatedFormData.no_out_school, 0);
      const maxChildren = total > 0 ? Math.max(total - 1, 0) : 0; // strictly less than total
      // Clamp to ensure inSch + outSch <= maxChildren
      if (inSch + outSch > maxChildren) {
        if (name === "no_in_school") {
          inSch = Math.min(inSch, maxChildren);
          outSch = Math.max(0, Math.min(outSch, maxChildren - inSch));
        } else {
          outSch = Math.min(outSch, maxChildren);
          inSch = Math.max(0, Math.min(inSch, maxChildren - outSch));
        }
        updatedErrors.school_split = null;
      }
      updatedFormData.no_in_school = inSch;
      updatedFormData.no_out_school = outSch;
      updatedFormData.no_children = inSch + outSch;

      // Employment must sum to adults = total - children
      const adults = Math.max(total - (inSch + outSch), 0);
      let employed = Math.min(toNum(updatedFormData.no_employed, 0), adults);
      updatedFormData.no_employed = employed;
      updatedFormData.no_unemployed = adults - employed;

      updatedErrors.employment_split = null;
    }

    // When employment fields change, enforce employed + unemployed = out_of_school
    if (name === "no_employed" || name === "no_unemployed") {
      const total = toNum(updatedFormData.total_no_household_memb, 0);
      const children = toNum(updatedFormData.no_children, 0);
      const adults = Math.max(total - children, 0);
      if (name === "no_employed") {
        let employed = Math.max(0, Math.min(adults, toNum(newValue, 0)));
        updatedFormData.no_employed = employed;
        updatedFormData.no_unemployed = adults - employed;
      } else {
        let unemployed = Math.max(0, Math.min(adults, toNum(newValue, 0)));
        updatedFormData.no_unemployed = unemployed;
        updatedFormData.no_employed = adults - unemployed;
      }
      updatedErrors.employment_split = null;
    }

    // Calculate age from birth_date
    if (name === "birth_date" && newValue) {
      const today = new Date();
      const birthDate = new Date(newValue);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      updatedFormData.age = age >= 0 ? age : "";
    }

    // Contact number validation (Profile) — enforce digits and difference from contact person
    if (name === "contact_number") {
      const norm = (s) => (s || '').replace(/\D/g, '').slice(0, 10);
      const a = norm(newValue);
      const b = norm(updatedFormData.contact_contactno);
      if (!a) {
        setContactError("Contact number is required.");
      } else if (a.length !== 10 || !/^9[0-9]{9}$/.test(a)) {
        setContactError("Contact number must start with 9 and be 10 digits long.");
      } else if (b && a === b) {
        // Show error on both sides for immediate feedback
        setContactError("Must be different from Contact Person Number");
        setContact_contactnoError("Must be different from fisherfolk Contact Number");
        updatedErrors.contact_contactno = "Must be different from fisherfolk Contact Number";
      } else {
        setContactError("");
        if (contact_contactnoError === "Must be different from fisherfolk Contact Number") {
          setContact_contactnoError("");
        }
        if (updatedErrors.contact_contactno === "Must be different from fisherfolk Contact Number") {
          delete updatedErrors.contact_contactno;
        }
      }
    }

    // Contact person number validation — enforce digits and difference from profile number
    if (name === "contact_contactno") {
      const norm = (s) => (s || '').replace(/\D/g, '').slice(0, 10);
      const a = norm(newValue);
      const b = norm(updatedFormData.contact_number);
      if (!a) {
        setContact_contactnoError("Contact number is required.");
      } else if (a.length !== 10 || !/^9[0-9]{9}$/.test(a)) {
        setContact_contactnoError("Contact number must start with 9 and be 10 digits long.");
      } else if (b && a === b) {
        setContact_contactnoError("Must be different from fisherfolk Contact Number");
        updatedErrors.contact_contactno = "Must be different from fisherfolk Contact Number";
      } else {
        setContact_contactnoError("");
        if (contactError === "Must be different from Contact Person Number") {
          setContactError("");
        }
        if (updatedErrors.contact_contactno === "Must be different from fisherfolk Contact Number") {
          delete updatedErrors.contact_contactno;
        }
      }
    }

    // Verified date validation
    if (name === "verified_date") {
      if (!newValue) {
        updatedErrors.verified_date = "Verified Date is required.";
      } else if (newValue > today) {
        updatedErrors.verified_date = "Verified Date cannot be in the future.";
      } else {
        delete updatedErrors.verified_date;
      }
    }

    // Final state updates
    setFormData(updatedFormData);
    setErrors(updatedErrors);
    // Live-validate the field that changed
    try {
      validateField(name, updatedFormData[name]);
    } catch (err) {
      // validation helper may reference state; swallow errors to avoid breaking typing
      console.error('validateField error', err);
    }
  };

  // Validate a single field dynamically as user types or selects
  const validateField = (name, value) => {
    const newErrors = { ...(errors || {}) };
    const toNum = (v, def = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    };

    switch (name) {
      case 'birth_date': {
        if (value) {
          const today = new Date();
          const birth = new Date(value);
          let age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
          if (age < 18) {
            newErrors.birth_date = 'Fisherfolk must be at least 18 years old.';
          } else {
            delete newErrors.birth_date;
          }
          // keep age in sync
          setFormData((prev) => ({ ...prev, age: age >= 0 ? age : '' }));
        } else {
          newErrors.birth_date = 'Birth Date is required.';
        }
        break;
      }
      case 'contact_number': {
        if (!value) {
          newErrors.contact_number = 'Contact number is required.';
          setContactError('Contact number is required.');
        } else if (!/^9[0-9]{9}$/.test(value)) {
          newErrors.contact_number = 'Contact number must start with 9 and be 10 digits long.';
          setContactError('Contact number must start with 9 and be 10 digits long.');
        } else {
          delete newErrors.contact_number;
          setContactError('');
        }
        break;
      }
      case 'contact_contactno': {
        if (!value) {
          newErrors.contact_contactno = 'Contact person number is required.';
          setContact_contactnoError('Contact number is required.');
        } else if (!/^9[0-9]{9}$/.test(value)) {
          newErrors.contact_contactno = 'Contact person number must start with 9 and be 10 digits long.';
          setContact_contactnoError('Contact number must start with 9 and be 10 digits long.');
        } else {
          delete newErrors.contact_contactno;
          setContact_contactnoError('');
        }
        break;
      }
      case 'residency_years': {
        const age = toNum(formData.age, 0);
        const years = toNum(value, 0);
        if (years > age) {
          newErrors.residency_years = 'Years of Residency cannot exceed Age.';
        } else {
          delete newErrors.residency_years;
        }
        break;
      }
      case 'registration_number': {
        // minimal format hint (digits and dashes), more thorough check is async elsewhere
        if (value && !/^[0-9\-]+$/.test(value)) {
          newErrors.registration_number = 'Registration number may contain only digits and dashes.';
        } else {
          delete newErrors.registration_number;
        }
        break;
      }
      default: {
        // For required select/text fields provide quick feedback
        const requiredQuick = [
          'municipality','salutations','first_name','last_name','birth_place','civil_status','barangay','position','verified_date','educational_background','contact_fname','contact_lname','contact_relationship','contact_municipality','contact_barangay','main_source_livelihood','religion'
        ];
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


  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setAlertModal({
          isOpen: true,
          title: 'Invalid File Type',
          message: 'Please upload an image file.'
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          fisherfolk_img: file,
          picturePreview: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Restore preview after step navigation if file exists
  useEffect(() => {
    if (formData.fisherfolk_img instanceof File && !formData.picturePreview) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, picturePreview: reader.result }));
      };
      reader.readAsDataURL(formData.fisherfolk_img);
    }
  }, [currentStep, formData.fisherfolk_img, formData.picturePreview]);

  const handleNext = (e) => {
    e.preventDefault();

    // Validate all required fields
    const requiredFields = [
      { field: 'municipality', message: 'Municipality is required' },
      { field: 'registration_number', message: 'Registration Number is required' },
      { field: 'salutations', message: 'Salutations is required' },
      { field: 'first_name', message: 'First Name is required' },
      { field: 'last_name', message: 'Last Name is required' },
      { field: 'birth_date', message: 'Birth Date is required' },
      { field: 'birth_place', message: 'Birth Place is required' },
      { field: 'civil_status', message: 'Civil Status is required' },
      { field: 'contact_number', message: 'Contact Number is required' },
      { field: 'barangay', message: 'Barangay is required' },
      { field: 'residency_years', message: 'Years of Residency is required' },
      { field: 'barangay_verifier', message: 'Barangay Verifier is required' },
      { field: 'position', message: 'Position is required' },
      { field: 'verified_date', message: 'Verified Date is required' },
      { field: 'no_male', message: 'Number of Male is required' },
      { field: 'no_female', message: 'Number of Female is required' },
      { field: 'no_children', message: 'Number of Children is required' },
      { field: 'educational_background', message: 'Educational Background is required' },
      { field: 'contact_fname', message: 'Contact Person First Name is required' },
      // { field: 'contact_mname', message: 'Contact Person Middle Name is required' }, // NOT REQUIRED
      { field: 'contact_lname', message: 'Contact Person Last Name is required' },
      { field: 'contact_relationship', message: 'Contact Relationship is required' },
      { field: 'contact_contactno', message: 'Contact Person Contact Number is required' },
      { field: 'contact_municipality', message: 'Contact Municipality is required' },
      { field: 'contact_barangay', message: 'Contact Barangay is required' },
      // contact_street NOT REQUIRED
      { field: 'main_source_livelihood', message: 'Main Source of Livelihood is required' },
      { field: 'religion', message: 'Religion is required' },
      { field: 'fisherfolk_img', message: 'Photo is required' }
      // NOTE: no_in_school, no_out_school, no_employed, no_unemployed are NOT REQUIRED
    ];

    // Numeric fields that can be 0 or "0"
    const numericFields = ['no_male', 'no_female', 'no_children', 'residency_years'];
    
    const validationErrors = [];
    requiredFields.forEach(({ field, message }) => {
      const value = formData[field];
      
      // For numeric fields, check if value is null/undefined/empty string, but allow 0 or "0"
      if (numericFields.includes(field)) {
        if (value === null || value === undefined || value === '') {
          validationErrors.push(message);
        }
        // If value is a string, check if it's a valid number (including "0")
        else if (typeof value === 'string' && value.trim() !== '' && isNaN(value.trim())) {
          validationErrors.push(message);
        }
      } else {
        // For other fields, check if empty/null/undefined
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          validationErrors.push(message);
        }
      }
    });

    // Additional custom validations
    if (formData.age < 18) {
      validationErrors.push('Fisherfolk must be at least 18 years old');
    }

    if (formData.contact_number && formData.contact_number.length !== 10) {
      validationErrors.push('Contact number must be 10 digits');
    }

    if (formData.contact_contactno && formData.contact_contactno.length !== 10) {
      validationErrors.push('Contact person contact number must be 10 digits');
    }

    // Contact numbers must be different
    if (
      (formData.contact_number || '').trim() !== '' &&
      (formData.contact_contactno || '').trim() !== '' &&
      formData.contact_number === formData.contact_contactno
    ) {
      validationErrors.push('Fisherfolk Contact Number and Contact Person Number must be different');
    }

    // Household invariants (frontend pre-checks)
    {
      const totalHH = Number(formData.total_no_household_memb || 0);
      const inSchool = Number(formData.no_in_school || 0);
      const outSchool = Number(formData.no_out_school || 0);
      const children = inSchool + outSchool;
      const employed = Number(formData.no_employed || 0);
      const unemployed = Number(formData.no_unemployed || 0);
      if (totalHH > 0 && children >= totalHH) {
        validationErrors.push('In-school + Out-of-school must be less than Total household members');
      }
      if (employed + unemployed !== Math.max(totalHH - children, 0)) {
        validationErrors.push('Employed + Unemployed must equal Total - Children');
      }
    }

    if (formData.educational_background === 'Others' && !formData.other_educational_background) {
      validationErrors.push('Please specify other educational background');
    }

    if (formData.main_source_livelihood === 'Others' && !formData.other_main_source_livelihood) {
      validationErrors.push('Please specify other main source of livelihood');
    }

    if (formData.farming_income && !formData.farming_income_salary) {
      validationErrors.push('Farming income amount is required');
    }

    if (formData.fisheries_income && !formData.fisheries_income_salary) {
      validationErrors.push('Fisheries income amount is required');
    }

    if (formData.with_voterID && !formData.voterID_number) {
      validationErrors.push('Voter ID Number is required');
    }

    // validate organizations only on this page
    const ok = validateOrganizationsPage();
    if (!ok) {
      validationErrors.push('Please fill in all organization fields');
    }

    // Check if registration number is being validated or has error
    if (isCheckingRegNumber) {
      validationErrors.push('Please wait while we validate the registration number');
    }
    if (regNumberError) {
      validationErrors.push(regNumberError);
    }

    if (validationErrors.length > 0) {
      setAlertModal({
        isOpen: true,
        title: `Please fill in all required fields (${validationErrors.length})`,
        message: validationErrors.map((error, index) => `${index + 1}. ${error}`).join('\n')
      });
      return;
    }

    // Scroll to top when navigating to confirmation page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // proceed to next step
    setCurrentStep(2);
    if (setParentCurrentStep) setParentCurrentStep(2);
  };

  const handleBack = () => {
    // Scroll to top when going back to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentStep(1);
    if (setParentCurrentStep) setParentCurrentStep(1);
    // Clear registration number error when going back to edit
    setRegNumberError('');
    setIsCheckingRegNumber(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (currentStep === 1) {
      handleNext(e);
    } else {
      // Show confirmation modal instead of directly submitting
      setShowConfirmModal(true);
    }
  };

  const handleConfirmSubmit = () => {
    let hasError = false;
    // Enforce different contact numbers
    if (
      (formData.contact_number || '').trim() !== '' &&
      (formData.contact_contactno || '').trim() !== '' &&
      formData.contact_number === formData.contact_contactno
    ) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Fisherfolk Contact Number and Contact Person Number must be different.'
      });
      return;
    }
    // Contact number validation
    if (
      !formData.contact_number ||
      formData.contact_number.length !== 10 ||
      !/^9[0-9]{9}$/.test(formData.contact_number)
    ) {
      setContactError(
        "Contact number must start with 9 and be 10 digits long."
      );
      hasError = true;
    }
    if (formData.age < 18) {
      setAlertModal({
        isOpen: true,
        title: 'Validation Error',
        message: 'Fisherfolk must be at least 18 years old.'
      });
      hasError = true;
    }
    if (formData.farming_income_salary) {
      formData.farming_income_salary = formData.farming_income_salary
        .toString()
        .replace(/,/g, "");
    }
    if (formData.fisheries_income_salary) {
      formData.fisheries_income_salary = formData.fisheries_income_salary
        .toString()
        .replace(/,/g, "");
    }
    if (
      !formData.other_source_livelihood ||
      formData.other_source_livelihood === 0
    ) {
      formData.other_source_livelihood = [];
    }
    if (hasError) return;
    
    // Convert empty strings to null for optional number fields
    const optionalNumberFields = ['no_in_school', 'no_out_school', 'no_employed', 'no_unemployed'];
    const cleanedData = { ...formData };
    optionalNumberFields.forEach(field => {
      if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
        cleanedData[field] = 0;
      }
    });

    // Enforce backend household invariants before submit
    {
      // total must equal male + female
      const male = Number(cleanedData.no_male || 0);
      const female = Number(cleanedData.no_female || 0);
      const total = Math.max(0, male + female);
      cleanedData.total_no_household_memb = total;

      // children = in_school + out_school, must be < total
      let inSchool = Number(cleanedData.no_in_school || 0);
      let outSchool = Number(cleanedData.no_out_school || 0);
      const maxChildren = total > 0 ? Math.max(total - 1, 0) : 0;
      if (inSchool + outSchool > maxChildren) {
        // clamp out-of-school to fit first
        outSchool = Math.max(0, Math.min(outSchool, Math.max(maxChildren - inSchool, 0)));
      }
      cleanedData.no_in_school = inSchool;
      cleanedData.no_out_school = outSchool;
      const children = inSchool + outSchool;

      // employed + unemployed = total - children
      const adults = Math.max(total - children, 0);
      let employed = Number(cleanedData.no_employed || 0);
      if (employed > adults) employed = adults;
      cleanedData.no_employed = employed;
      cleanedData.no_unemployed = adults - employed;
    }
    
    console.log(cleanedData);
    console.log("user", user);
    // Build organizations payload array from the organizations array in the form state.
    // Map any org entry with org_name === 'Others' to use its custom_org_name value.
    const organizations = Array.isArray(cleanedData.organizations)
      ? cleanedData.organizations
          .map((org) => {
            if (!org) return null;
            const name = (org.org_name || "").toString().trim();
            const positionRaw = (org.org_position || "").toString().trim();
            const customPosition = (org.custom_org_position || "").toString().trim();
            return {
              org_name:
                name.toLowerCase() === "others"
                  ? (org.custom_org_name || "").toString().trim()
                  : name,
              member_since: org.member_since || "",
              org_position:
                positionRaw.toLowerCase() === "others"
                  ? customPosition
                  : positionRaw,
            };
          })
          .filter((o) => o && (o.org_name || o.member_since || o.org_position))
      : [];

    // Map 'Others' free-text for other_source_livelihood to backend field
    const osl = Array.isArray(cleanedData.other_source_livelihood)
      ? cleanedData.other_source_livelihood
      : [];
    const otherText = (cleanedData.other_source_livelihood_other ?? "").toString().trim();
    cleanedData.other_source_income = osl.includes("Others") && otherText ? otherText : "";

    onSubmit({
      ...cleanedData,
      organizations,
      created_by: user?.id,
      // Keep main_source_livelihood as the selected enum; backend choices include 'Others'
      main_source_livelihood: cleanedData.main_source_livelihood,
    });
  };

  const setFieldError = (key, msg) =>
    setErrors((prev) => ({ ...(prev || {}), [key]: msg }));

  const clearFieldError = (key) =>
    setErrors((prev) => {
      if (!prev) return {};
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

  const validateOrganizationsPage = () => {
    const newErrors = {};
    (formData.organizations || []).forEach((org, i) => {
      const name = ((org?.org_name) || "").toString().trim();
      const custom = ((org?.custom_org_name) || "").toString().trim();
      const hasName = (name && name.toLowerCase() !== "others") || (name.toLowerCase() === "others" && !!custom);

      // If 'Others' is selected, custom name is required
      if (name.toLowerCase() === "others" && !custom) {
        newErrors[`org_${i}_name`] = "Please enter the organization name.";
      }

      // Conditional requirements: when org name provided
      if (hasName) {
        const yearStr = ((org?.member_since) || "").toString().trim();
        const posStr = ((org?.org_position) || "").toString().trim();
        const y = parseInt(yearStr, 10);
        // Compute earliest logical membership year: birth year + 18 (if birth_date is available)
        let minYearForMembership = 1900;
        if (formData.birth_date) {
          const birth = new Date(formData.birth_date);
          if (!isNaN(birth.getTime())) {
            minYearForMembership = birth.getFullYear() + 18;
          }
        }
        if (!yearStr || isNaN(y) || y < 1900 || y > new Date().getFullYear()) {
          newErrors[`org_${i}_member_since`] = !yearStr
            ? "Please enter a valid year."
            : (y > new Date().getFullYear())
              ? "Member since cannot be in the future."
              : "Please enter a valid year.";
        } else if (y < minYearForMembership) {
          newErrors[`org_${i}_member_since`] = "Member since year is not consistent with fisherfolk age (must be at least 18 years old).";
        }
        if (!posStr) {
          newErrors[`org_${i}_position`] = "Please enter position.";
        }
      }
    });
    setErrors(newErrors);
    console.log("validateOrganizationsPage -> newErrors:", newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const renderStep1 = () => (
    <div
      className="space-y-6 relative font-montserrat"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        {/* Registration Number Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
          Registration Number
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1st row */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Municipality <span className="text-red-500">*</span>
            </label>
            {/* Read-only for Municipal Agriculturist, editable for Admin */}
            {user?.user_role === 'municipal_agriculturist' ? (
              <div className="relative mt-1">
                <input
                  type="text"
                  value={formData.municipality}
                  readOnly
                  className="relative w-full cursor-not-allowed rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 text-gray-900"
                  required
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  🔒
                </span>
              </div>
            ) : (
              <Listbox
                value={formData.municipality || ""}
                onChange={(val) => {
                  console.log('[DEBUG] Municipality changed from:', formData.municipality, 'to:', val);
                  setFormData((prev) => {
                    // Keep registration_number as digits-with-dashes only (no prefix)
                    const cleanRegNumber = (prev.registration_number || '').replace(/^[A-Z]{3}-/, '');
                    return {
                      ...prev,
                      municipality: val || "",
                      barangay: "",
                      registration_number: cleanRegNumber,
                    };
                  });
                }}
              >
                <div className="relative mt-1">
                  <Listbox.Button
                    required
                    className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                    <Listbox.Option
                      key="empty"
                      value=""
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? "bg-blue-100 text-blue-900" : "text-gray-500"}`
                      }
                    >
                      Select municipality
                    </Listbox.Option>
                    {municipalities.map((mun) => (
                      <Listbox.Option
                        key={mun.municipality_id}
                        value={mun.name}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? "bg-blue-100 text-blue-900" : "text-gray-900"}`
                        }
                      >
                        {mun.name}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Registration Number <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <div className="flex items-center">
                <span className="px-3 py-2 bg-blue-600 border border-gray-300 rounded-l-lg text-white font-mono">
                  {(() => {
                    const prefix = municipalityPrefixes[formData.municipality];
                    console.log('Selected Municipality:', formData.municipality, 'Prefix:', prefix);
                    return prefix ? prefix + "-" : "XXX-";
                  })()}
                </span>
                <input
                  type="text"
                  name="registration_number"
                  value={formData.registration_number}
                  onChange={(e) => {
                    // Only allow numbers, auto-insert dashes at correct positions for 0000-000000000-00000
                    let val = e.target.value.replace(/[^\d]/g, "");
                    if (val.length > 4)
                      val = val.slice(0, 4) + "-" + val.slice(4);
                    if (val.length > 14)
                      val = val.slice(0, 14) + "-" + val.slice(14);
                    val = val.slice(0, 20); // 4+1+9+1+5 = 20, but dashes are inserted, so 18 digits + 2 dashes = 20
                    setFormData((prev) => ({
                      ...prev,
                      registration_number: val,
                    }));
                  }}
                  placeholder={
                    formData.municipality
                      ? "0000-000000000-00000"
                      : "Select Municipality first"
                  }
                  className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                  disabled={!formData.municipality}
                  inputMode="numeric"
                  pattern="\d{4}-\d{9}-\d{5}"
                  maxLength={21}
                />
              </div>
              {isCheckingRegNumber && (
                <p className="mt-1 text-xs text-blue-600">Checking registration number...</p>
              )}
              {regNumberError && (
                <p className="mt-1 text-xs text-red-600">{regNumberError}</p>
              )}
              {/* Inline field-level error (sync validator) */}
              <ErrorText name="registration_number" />
            </div>
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
            <div className="relative mt-1">
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
              <ErrorText name="salutations" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              First Name <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
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
            <ErrorText name="first_name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Middle Name
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="middle_name"
                value={formData.middle_name}
                onChange={handleInputChange}
                placeholder="Middle Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Last Name <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                placeholder="Last Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
            <ErrorText name="last_name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Appelation
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="appelation"
                value={formData.appelation}
                onChange={handleInputChange}
                placeholder="Appelation"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Birth Date <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
                max={
                  new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0]
                }
              />
            </div>
            <ErrorText name="birth_date" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Age <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="age"
                value={formData.age}
                readOnly
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Age"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Birth Place <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
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
            <ErrorText name="birth_place" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Civil Status <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <select
                name="civil_status"
                value={formData.civil_status}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              >
                <option
                  hidden
                  selected
                  className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  value=""
                >
                  Select Civil Status
                </option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
              </select>
              <ErrorText name="civil_status" />
            </div>
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
                  className="mr-2"
                />
                Female
              </label>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Contact Number <span className="text-red-500">*</span>
              </label>
            </div>
            <div className="relative mt-1">
              <div className="flex rounded-lg shadow-sm">
                {/* Prefix */}
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-700 text-sm">
                  +63
                </span>

                {/* Input */}
                <input
                  type="text"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={(e) => {
                    // Only allow digits, limit to 10 characters, and must start with 9
                    let value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    if (value && value[0] !== "9") {
                      value = "";
                    }
                    handleInputChange({
                      target: { name: "contact_number", value },
                    });
                  }}
                  className="flex-1 block w-full rounded-r-lg border border-gray-300 bg-white py-3 pl-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                  pattern="9[0-9]{9}"
                  title="Phone number must start with 9 and be 10 digits long"
                  placeholder="9XXXXXXXXX"
                />
              </div>

              {/* Error message */}
              {contactError && (
                <span className="mt-1 text-xs text-red-600">
                  {contactError}
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nationality <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="nationality"
                value={formData.nationality}
                readOnly
                placeholder="Nationality"
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
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
                  value="part time"
                  checked={formData.fisherfolk_status === "part time"}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                Part time
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="fisherfolk_status"
                  value="full time"
                  checked={formData.fisherfolk_status === "full time"}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                Full time
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mother's Maiden Name
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="mothers_maidenname"
                value={formData.mothers_maidenname}
                onChange={handleInputChange}
                placeholder="Mother's Maiden Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                onChange={handleInputChange}
                placeholder="Select Municipality first"
                readOnly
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900"
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
                readOnly
                placeholder="FMA Number"
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Religion <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <select
                name="religion"
                value={formData.religion}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              >
                <option value="" selected hidden>
                  Select Religion
                </option>
                <option value="Roman Catholic">Roman Catholic</option>
                <option value="Protestant Christian">
                  Protestant Christian
                </option>
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
              {formData.religion === "Others" && (
                <div className="mt-2 ml-6 border-l-2 border-blue-300 pl-4">
                  <input
                    type="text"
                    name="other_religion"
                    value={formData.other_religion || ""}
                    onChange={handleInputChange}
                    placeholder="Please specify religion"
                    className="w-full px-4 py-2 border border-blue-300 rounded-lg mt-1"
                    required
                  />
                </div>
              )}
            </div>
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
            <div className="relative mt-1">
              <input
                type="text"
                name="region"
                value={formData.region}
                readOnly
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Province <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="province"
                value={formData.province}
                readOnly
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              City/Municipality <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="municipality"
                value={formData.municipality}
                placeholder="Select Municipality first"
                readOnly
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Barangay <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <Listbox
                value={formData.barangay}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, barangay: val }))
                }
                disabled={!formData.municipality}
              >
                <Listbox.Button
                  className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  disabled={!formData.municipality}
                  required
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
                  {availableBarangays.map(
                    (brgy) => (
                      <Listbox.Option
                        key={brgy}
                        value={brgy}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? "bg-blue-100 text-blue-900" : "text-gray-900"}`
                        }
                      >
                        {brgy}
                      </Listbox.Option>
                    )
                  )}
                </Listbox.Options>
              </Listbox>
              <ErrorText name="barangay" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Street
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleInputChange}
                placeholder="Street"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Years of Residency <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="residency_years"
                value={formData.residency_years}
                onChange={handleInputChange}
                placeholder="Year of Residency"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
                min={0}
                step={1}
              />
              {errors.residency_years && (
                <span className="mt-1 text-xs text-red-600">
                  {errors.residency_years}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Barangay Verifier Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Barangay Verifier
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name of Verifier <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="barangay_verifier"
                value={formData.barangay_verifier}
                placeholder="Name of Verifier"
                readOnly
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900"
                required
              />
            </div>
            <ErrorText name="barangay_verifier" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Position <span className="text-red-500">*</span>
            </label>
            <Listbox
              value={formData.position || ""}
              onChange={(value) =>
                setFormData({ ...formData, position: value })
              }
            >
              <div className="relative mt-1">
                {/* Button */}
                <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900">
                  <span className="block truncate">
                    {formData.position || "Select a position"}
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>

                {/* Options */}
                <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {positions.map((pos, idx) => (
                    <Listbox.Option
                      key={idx}
                      value={pos}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                        }`
                      }
                    >
                      {pos}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
            <ErrorText name="position" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Verified Date <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="date"
                name="verified_date"
                value={formData.verified_date}
                onChange={handleInputChange}
                max={today}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
            </div>
            <ErrorText name="verified_date" />
          </div>
        </div>
        {/* Number of Household Members Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Number of Household Members
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Total Number <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="total_no_household_memb"
                value={formData.total_no_household_memb}
                readOnly
                placeholder="Total Number"
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
                min={0}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Derived: Male + Female</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              No. of Male <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="no_male"
                value={formData.no_male}
                onChange={handleInputChange}
                placeholder="No. of Male"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
                min={0}
                step={1}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              No. of Female <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="no_female"
                value={formData.no_female}
                onChange={handleInputChange}
                placeholder="No. of Female"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
                min={0}
                step={1}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              No. of Children <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="no_children"
                value={formData.no_children}
                readOnly
                placeholder="Auto-calculated"
                className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
                min={0}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Derived: In-school + Out-of-school</p>
            <ErrorText name="no_children" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              No. of in School
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="no_in_school"
                value={formData.no_in_school}
                onChange={handleInputChange}
                placeholder="No. in School"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                min={0}
                step={1}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              No. out of School
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="no_out_school"
                value={formData.no_out_school}
                onChange={handleInputChange}
                placeholder="No. out of School"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                min={0}
                step={1}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              No. of Employed
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="no_employed"
                value={formData.no_employed}
                onChange={handleInputChange}
                placeholder="No. Employed"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                min={0}
                step={1}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Total - Children = Employed + Unemployed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              No. of Unemployed
            </label>
            <div className="relative mt-1">
              <input
                type="number"
                name="no_unemployed"
                value={formData.no_unemployed}
                onChange={handleInputChange}
                placeholder="No. Unemployed"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                min={0}
                step={1}
              />
            </div>
          </div>
        </div>
        {/* Education Background Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Education Background
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Education Background <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <select
                name="educational_background"
                value={formData.educational_background}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              >
                <option value="" selected hidden>
                  Select Educational Background
                </option>
                <option value="Elementary">Elementary</option>
                <option value="High School">High School</option>
                <option value="Vocational">Vocational</option>
                <option value="College">College</option>
                <option value="Post Graduate">Post Graduate</option>
                <option value="Others">Others</option>
              </select>
            </div>
            {formData.educational_background === "Others" && (
              <div className="row-start-2 row-end-3 mt-2 ml-6 border-l-2 border-blue-300 pl-4">
                <input
                  type="text"
                  name="other_educational_background"
                  value={formData.other_educational_background}
                  onChange={handleInputChange}
                  placeholder="Specify Other Educational Background"
                  className="w-full px-4 py-2 border border-blue-300 rounded-lg mt-1"
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* House Monthly Income Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          House Monthly Income
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <option value="" selected hidden>
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

        {/* Contact Person Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Contact Person
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              First Name <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="contact_fname"
                value={formData.contact_fname}
                onChange={handleInputChange}
                placeholder="First Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                required
              />
            </div>
            <ErrorText name="contact_fname" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Middle Name
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="contact_mname"
                value={formData.contact_mname}
                onChange={handleInputChange}
                placeholder="Middle Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Last Name <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="contact_lname"
                value={formData.contact_lname}
                onChange={handleInputChange}
                placeholder="Last Name"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                required
              />
            </div>
            <ErrorText name="contact_lname" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Relationship <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1 space-y-2">
              <select
                name="contact_relationship"
                value={formData.contact_relationship}
                onChange={handleInputChange}
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                required
              >
                <option value="" hidden>
                  Select Relationship
                </option>
                <option value="Wife">Wife</option>
                <option value="Husband">Husband</option>
                <option value="Sister">Sister</option>
                <option value="Brother">Brother</option>
                <option value="Mother">Mother</option>
                <option value="Others">Others</option>
              </select>
              {formData.contact_relationship === "Others" && (
                <div className="mt-1 ml-6 border-l-2 border-blue-300 pl-4">
                  <input
                    type="text"
                    name="contact_relationship_other"
                    value={formData.contact_relationship_other}
                    onChange={handleInputChange}
                    placeholder="Specify relationship"
                    className="w-full px-4 py-2 border border-blue-300 rounded-lg mt-1"
                    required
                  />
                </div>
              )}
            </div>
            <ErrorText name="contact_relationship" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Contact Number <span className="text-red-500">*</span>
              </label>
            </div>
            <div className="relative mt-1">
              <div className="flex rounded-md shadow-sm">
                {/* Prefix */}
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  +63
                </span>

                {/* Input */}
                <input
                  type="text"
                  name="contact_contactno"
                  value={formData.contact_contactno}
                  onChange={(e) => {
                    // Only allow digits, limit to 10 characters, and must start with 9
                    let value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    if (value && value[0] !== "9") {
                      value = "";
                    }
                    handleInputChange({
                      target: { name: "contact_contactno", value },
                    });
                  }}
                  className={`relative w-full rounded-r-md border bg-white py-3 pl-3 pr-10 text-left text-gray-900 focus:outline-none focus:ring-2 ${
                    contact_contactnoError
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                  }`}
                  required
                  pattern="9[0-9]{9}"
                  title="Phone number must start with 9 and be 10 digits long"
                  placeholder="9XXXXXXXXX"
                />
              </div>

              {/* Error message */}
              {contact_contactnoError && (
                <span className="mt-1 text-xs text-red-600">
                  {contact_contactnoError}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              City/Municipality <span className="text-red-500">*</span>
            </label>
            <Listbox
              value={formData.contact_municipality || ""}
              onChange={(val) =>
                setFormData((prev) => ({
                  ...prev,
                  contact_municipality: val,
                  contact_barangay: "",
                }))
              }
            >
              <div className="relative mt-1">
                <Listbox.Button
                  required
                  className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                >
                  <span className="block truncate">
                    {formData.contact_municipality || "Select municipality"}
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {municipalities.map((mun) => (
                    <Listbox.Option
                      key={mun.municipality_id}
                      value={mun.name}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? "bg-blue-100 text-blue-900" : "text-gray-900"}`
                      }
                    >
                      {mun.name}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
              <ErrorText name="contact_municipality" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Barangay <span className="text-red-500">*</span>
            </label>
            <Listbox
              value={formData.contact_barangay || ""}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, contact_barangay: val }))
              }
              disabled={!formData.contact_municipality}
            >
              <div className="relative mt-1">
                <Listbox.Button
                  required
                  className={`relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500 ${!formData.contact_municipality ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}`}
                  disabled={!formData.contact_municipality}
                >
                  <span className="block truncate">
                    {formData.contact_barangay ||
                      (!formData.contact_municipality
                        ? "Select Municipality First"
                        : "Select Barangay")}
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronUpDownIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {contactBarangays.map(
                    (brgy) => (
                      <Listbox.Option
                        key={brgy}
                        value={brgy}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? "bg-blue-100 text-blue-900" : "text-gray-900"}`
                        }
                      >
                        {brgy}
                      </Listbox.Option>
                    )
                  )}
                </Listbox.Options>
              </div>
            </Listbox>
              <ErrorText name="contact_barangay" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Street
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                name="contact_street"
                value={formData.contact_street}
                onChange={handleInputChange}
                placeholder="Street"
                className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
              />
            </div>
          </div>
        </div>
        {/* Demographic and Eligibility Details Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Demographic and Eligibility Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="with_voterID"
                checked={formData.with_voterID}
                onChange={handleInputChange}
                className="mr-2"
              />
              <label className="block text-sm font-medium text-gray-700">
                With Voter ID
              </label>
            </div>
            {formData.with_voterID && (
              <div className="mt-2 ml-6 border-l-2 border-blue-300 pl-4">
                <label className="block text-sm font-medium text-blue-700">
                  Voter's ID Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="voterID_number"
                  value={formData.voterID_number}
                  onChange={handleInputChange}
                  placeholder="Enter Voter's ID Number"
                  className="w-full px-4 py-2 border border-blue-300 rounded-lg mt-1"
                  required
                />
              </div>
            )}
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_CCT_4ps"
              checked={formData.is_CCT_4ps}
              onChange={handleInputChange}
              className="mr-2"
            />
            <label className="block text-sm font-medium text-gray-700">
              CCT/4Ps Beneficiary
            </label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_ICC"
              checked={formData.is_ICC}
              onChange={handleInputChange}
              className="mr-2"
            />
            <label className="block text-sm font-medium text-gray-700">
              ICC Member
            </label>
          </div>
        </div>
        {/* Livelihood Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Livelihood
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Main Source of Livelihood{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <select
                  name="main_source_livelihood"
                  value={formData.main_source_livelihood}
                  onChange={handleInputChange}
                  className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
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
              </div>
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
                        value={formData.other_source_livelihood_other || null}
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

        {/* Organization Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Organization
        </h2>

        {(formData.organizations || []).map((org, index) => {
          const nameError = errors?.[`org_${index}_name`];
          const hasOrgName = !!(org.org_name && org.org_name.toString().trim());

          return (
            <div key={index} className="mb-6">
              {/* Inputs row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Organization Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Organization Name
                  </label>

                  <Listbox
                    value={org.org_name || ""}
                    onChange={(val) => {
                      const picked = (val ?? "").toString().trim();
                      const updated = [...(formData.organizations || [])];
                      updated[index] = {
                        ...(updated[index] || {}),
                        org_name: picked,
                      };

                      if (picked && picked.toLowerCase() !== "others") {
                        updated[index].custom_org_name = "";
                      }

                      setFormData((prev) => ({
                        ...prev,
                        organizations: updated,
                      }));

                      if (picked && picked.toLowerCase() !== "others") {
                        clearFieldError(`org_${index}_name`);
                        // if name chosen (not Others), ensure conditional requireds are re-validated
                        const hasName = true;
                        const year = (updated[index].member_since || "").toString().trim();
                        const pos = (updated[index].org_position || "").toString().trim();
                        if (hasName) {
                          const y = parseInt(year, 10);
                          if (!year || isNaN(y) || y < 1900 || y > new Date().getFullYear()) {
                            setFieldError(`org_${index}_member_since`, "Please enter a valid year.");
                          } else {
                            clearFieldError(`org_${index}_member_since`);
                          }
                          if (!pos) {
                            setFieldError(`org_${index}_position`, "Please enter position.");
                          } else {
                            clearFieldError(`org_${index}_position`);
                          }
                        }
                      } else if (picked.toLowerCase() === "others") {
                        const customVal = (
                          updated[index].custom_org_name || ""
                        ).trim();
                        if (!customVal) {
                          setFieldError(
                            `org_${index}_name`,
                            "Please enter organization name."
                          );
                        } else {
                          clearFieldError(`org_${index}_name`);
                        }
                        // when selecting Others, also validate conditional requireds
                        const year = (updated[index].member_since || "").toString().trim();
                        const pos = (updated[index].org_position || "").toString().trim();
                        const y = parseInt(year, 10);
                        if (!year || isNaN(y) || y < 1900 || y > new Date().getFullYear()) {
                          setFieldError(`org_${index}_member_since`, "Please enter a valid year.");
                        } else {
                          clearFieldError(`org_${index}_member_since`);
                        }
                        if (!pos) {
                          setFieldError(`org_${index}_position`, "Please enter position.");
                        } else {
                          clearFieldError(`org_${index}_position`);
                        }
                      } else {
                        // cleared selection => all org fields are optional; clear related errors
                        clearFieldError(`org_${index}_name`);
                        clearFieldError(`org_${index}_member_since`);
                        clearFieldError(`org_${index}_position`);
                      }
                    }}
                  >
                    <div className="relative mt-1">
                      <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500">
                        {org.org_name || "Select Organization"}
                      </Listbox.Button>

                      <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {(
                          organizationOptions[formData.municipality]?.[
                            formData.barangay
                          ] || []
                        )
                          .filter((opt) => (opt ?? "").toString().trim() !== "")
                          .map((option, idx) => (
                            <Listbox.Option
                              key={idx}
                              value={option}
                              className="cursor-default select-none py-2 pl-3 pr-4 text-gray-900 hover:bg-blue-100"
                            >
                              {option}
                            </Listbox.Option>
                          ))}
                        {!(
                          organizationOptions[formData.municipality]?.[
                            formData.barangay
                          ] || []
                        ).some(
                          (o) =>
                            (o ?? "").toString().trim().toLowerCase() ===
                            "others"
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
                    <>
                      <input
                        type="text"
                        placeholder="Enter organization name"
                        value={org.custom_org_name || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          const updated = [...(formData.organizations || [])];
                          updated[index] = {
                            ...(updated[index] || {}),
                            // Keep org_name as "Others"; store typed name separately
                            org_name: "Others",
                            custom_org_name: value,
                          };
                          setFormData((prev) => ({
                            ...prev,
                            organizations: updated,
                          }));

                          if (value.trim()) {
                            clearFieldError(`org_${index}_name`);
                          } else {
                            setFieldError(
                              `org_${index}_name`,
                              "Please enter organization name."
                            );
                          }
                        }}
                        aria-invalid={!!nameError}
                        aria-describedby={
                          nameError ? `org_${index}_name_error` : undefined
                        }
                        className={`relative w-full mt-2 rounded-lg bg-white py-3 pl-3 pr-10 text-left border ${
                          nameError
                            ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                            : "border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        } text-gray-900`}
                      />
                      {nameError && (
                        <p
                          id={`org_${index}_name_error`}
                          className="mt-1 text-sm text-red-600"
                        >
                          {nameError}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Member Since */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Member Since
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={org.member_since || ""}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="YYYY"
                      disabled={!hasOrgName}
                      onChange={(e) => {
                        const raw = e.target.value || "";
                        // allow only digits and cap at 4 characters
                        const year = raw.replace(/[^0-9]/g, "").slice(0, 4);

                        const updated = [...(formData.organizations || [])];
                        updated[index] = {
                          ...(updated[index] || {}),
                          member_since: year,
                        };
                        setFormData((prev) => ({
                          ...prev,
                          organizations: updated,
                        }));

                        const y = parseInt(year, 10);
                        const currentYear = new Date().getFullYear();
                        const minYearForMembership = currentYear - 18; // must be at least 18 years old

                        setErrors((prev) => {
                          const copy = { ...(prev || {}) };
                          if (!year || isNaN(y) || y < 1900 || y > currentYear) {
                            copy[`org_${index}_member_since`] = !year
                              ? "Please enter a valid year."
                              : y > currentYear
                                ? "Member since cannot be in the future."
                                : "Please enter a valid year.";
                          } else if (y < minYearForMembership) {
                            copy[`org_${index}_member_since`] = "Member since year is not consistent with fisherfolk age (must be at least 18 years old).";
                          } else {
                            delete copy[`org_${index}_member_since`];
                          }
                          return copy;
                        });
                      }}
                      className="w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                    />
                    {errors[`org_${index}_member_since`] && (
                      <p
                        id={`org_${index}_member_since_error`}
                        className="mt-1 text-sm text-red-600"
                      >
                        {errors[`org_${index}_member_since`]}
                      </p>
                    )}
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Position
                  </label>
                  <div className="relative mt-1">
                    <select
                      value={org.org_position || ""}
                      disabled={!hasOrgName}
                      onChange={(e) => {
                        const value = e.target.value;
                        const updated = [...(formData.organizations || [])];
                        updated[index] = {
                          ...(updated[index] || {}),
                          org_position: value,
                        };
                        setFormData((prev) => ({
                          ...prev,
                          organizations: updated,
                        }));

                        // Conditional validation: only when org name is provided (including Others with custom name)
                        const name = (updated[index].org_name || "").toString().trim();
                        const custom = (updated[index].custom_org_name || "").toString().trim();
                        const hasName = (name && name.toLowerCase() !== "others") || (name.toLowerCase() === "others" && !!custom);
                        if (!hasName) {
                          clearFieldError(`org_${index}_position`);
                        } else if (value && value !== "Others") {
                          clearFieldError(`org_${index}_position`);
                        } else {
                          setFieldError(`org_${index}_position`, "Please enter position.");
                        }
                      }}
                      className="w-full cursor-default rounded-lg bg-white py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-500"
                    >
                      <option value="" hidden>
                        Select Position
                      </option>
                      <option value="President">President</option>
                      <option value="Secretary">Secretary</option>
                      <option value="Member">Member</option>
                      <option value="Others">Others</option>
                    </select>
                    {/* Custom position input when 'Others' is selected */}
                    {org.org_position === "Others" && (
                      <div className="mt-2 ml-2 border-l-2 border-blue-300 pl-4">
                        <input
                          type="text"
                          placeholder="Specify position"
                          value={org.custom_org_position || ""}
                          disabled={!hasOrgName}
                          onChange={(e) => {
                            const value = e.target.value;
                            const updated = [...(formData.organizations || [])];
                            updated[index] = {
                              ...(updated[index] || {}),
                              org_position: "Others",
                              custom_org_position: value,
                            };
                            setFormData((prev) => ({
                              ...prev,
                              organizations: updated,
                            }));

                            const name = (updated[index].org_name || "").toString().trim();
                            const customName = (updated[index].custom_org_name || "").toString().trim();
                            const hasName = (name && name.toLowerCase() !== "others") || (name.toLowerCase() === "others" && !!customName);

                            if (!hasName) {
                              clearFieldError(`org_${index}_position`);
                            } else if (value.trim()) {
                              clearFieldError(`org_${index}_position`);
                            } else {
                              setFieldError(`org_${index}_position`, "Please enter position.");
                            }
                          }}
                          className="w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                          required
                        />
                      </div>
                    )}
                    {errors?.[`org_${index}_position`] && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors[`org_${index}_position`]}
                      </p>
                    )}
                  </div>
                </div>

              </div>

              {/* Buttons row (below inputs) */}
              <div className="flex gap-2 mt-3">
                {/* Remove button, only show if more than one row */}
                {formData.organizations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = formData.organizations.filter((_, i) => i !== index);
                      setFormData((prev) => ({
                        ...prev,
                        organizations: updated,
                      }));
                    }}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Remove
                  </button>
                )}

                {/* Add button only on last row */}
                {index === formData.organizations.length - 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        organizations: [
                          ...prev.organizations,
                          { org_name: "", member_since: "", org_position: "" },
                        ],
                      }))
                    }
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Add Organization
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Attachments Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Attachments
        </h2>

        <div className="space-y-3">
          {formData.picturePreview ? (
            // Show preview and change button when image is uploaded
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Picture <span className="text-green-600">✓</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">Photo preview (jpeg, png only)</p>
              <img
                src={formData.picturePreview}
                alt="Profile Preview"
                className="w-40 h-40 object-cover rounded-xl border border-gray-300 shadow-md mb-3"
              />
              <label className="inline-block cursor-pointer px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium">
                Change Photo
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handlePictureChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            // Show file input when no image
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Upload Profile Picture <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 mb-2">Photo preview (jpeg, png only)</p>
              <div className="relative mt-1">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handlePictureChange}
                  className="block w-full max-w-xs text-sm text-gray-600 
                   file:mr-4 file:py-2 file:px-4
                   file:rounded-lg file:border-0
                   file:text-sm file:font-medium
                   file:bg-blue-50 file:text-blue-700
                   hover:file:bg-blue-100 cursor-pointer"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Certification Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Certification
        </h2>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-700 mb-4">
            I have personally reviewed the information on this application and I certify under penalty of perjury that to the best of my knowledge
            and belief the information on this application is true and correct, and that I understand this information is subject to public.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name of Applicant
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={`${formData.first_name} ${formData.middle_name ? formData.middle_name + ' ' : ''}${formData.last_name}`.trim() || 'Automatic from fisherfolk name'}
                  readOnly
                  className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900 italic"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Automatic name from fisherfolk data</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date of Application
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  readOnly
                  className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900 italic"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Automatic date</p>
            </div>
          </div>
        </div>

        {/* Signatories Section */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Signatories
        </h2>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 place-items-center">
            <div className="text-center flex flex-col items-center">
              <p className="text-sm font-semibold text-gray-900 uppercase underline">
                {barangayVerifier 
                  ? `${barangayVerifier.first_name} ${barangayVerifier.middle_name ? barangayVerifier.middle_name + ' ' : ''}${barangayVerifier.last_name}`
                  : 'Not assigned'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Barangay Captain</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <p className="text-sm font-semibold text-gray-900 uppercase underline">
                {signatories.municipal 
                  ? `${signatories.municipal.first_name} ${signatories.municipal.middle_name ? signatories.municipal.middle_name + ' ' : ''}${signatories.municipal.last_name}`
                  : 'Not assigned'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Municipal Agriculturist</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <p className="text-sm font-semibold text-gray-900 uppercase underline">
                {signatories.mayor 
                  ? `${signatories.mayor.first_name} ${signatories.mayor.middle_name ? signatories.mayor.middle_name + ' ' : ''}${signatories.mayor.last_name}`
                  : 'Not assigned'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Mayor</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div
      className="space-y-6 relative font-montserrat"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        {/* Registration */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
          Registration Account
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField
            label="Registration Number"
            value={formData.registration_number}
          />
          <InfoField
            label="Status"
            value={formData.is_active ? "Active" : "Inactive"}
          />
        </div>

        {/* Personal Information */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Personal Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField label="Salutations" value={formData.salutations} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField label="First Name" value={formData.first_name} />
          <InfoField label="Middle Name" value={formData.middle_name || "—"} />
          <InfoField label="Last Name" value={formData.last_name} />
          <InfoField label="Appelation" value={formData.apelation || "N/A"} />
          <InfoField label="Birth Date" value={formData.birth_date} />
          <InfoField label="Age" value={formData.age} />
          <InfoField label="Birth Place" value={formData.birth_place} />
          <InfoField label="Civil Status" value={formData.civil_status} />
          <InfoField label="Sex" value={formData.sex} />
          <InfoField
            label="Contact Number"
            value={`+63${formData.contact_number}`}
          />
          <InfoField label="Nationality" value={formData.nationality} />
          <InfoField label="Fisherfolk Status" value={formData.fisherfolk_status === "full time" ? "Full Time" : "Part Time"} />
          <InfoField label="Mothers Maiden Name" value={formData.mothers_maidenname} />
          <InfoField label="Fishing Ground" value={formData.fishing_ground} />
          <InfoField label="FMA Number" value={formData.fma_number} />
          <InfoField label="Religion" value={formData.religion} />
        </div>

        {/* Address Information */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Address Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField label="Street" value={formData.street} />
          <InfoField label="Barangay" value={formData.barangay} />
          <InfoField label="City/Municipality" value={formData.municipality} />
          <InfoField label="Province" value={formData.province} />
          <InfoField label="Region" value={formData.region} />
          <InfoField
            label="Years of Residency"
            value={formData.residency_years}
          />
        </div>

        {/* Barangay Verifier Information */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Barangay Verifier Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField label="verifier Name" value={formData.barangay_verifier} />
          <InfoField label="Position" value={formData.position} />
          <InfoField label="Verified Date" value={formData.verified_date} />
        </div>

        {/* Household Information */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Household Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField label="Total" value={formData.total_no_household_memb} />
          <InfoField label="Male" value={formData.no_male} />
          <InfoField label="Female" value={formData.no_female} />
          <InfoField label="Children" value={formData.no_children} />
          <InfoField label="In School" value={formData.no_in_school} />
          <InfoField label="Out of School" value={formData.no_out_school} />
          <InfoField
            label="Employed"
            className="col-start-2"
            value={formData.no_employed}
          />
          <InfoField
            label="Unemployed"
            className="col-start-3"
            value={formData.no_unemployed}
          />
        </div>

        {/* Education Information */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Educational Background
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField
            label="Educational Background"
            value={formData.educational_background}
          />
        </div>

        {/* Monthly Income */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Monthly Income Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoField
            label="Household Income"
            value={formData.household_month_income}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField
              label="Farming Income"
              value={
                formData.farming_income_salary
                  ? formData.farming_income_salary
                  : "None"
              }
            />
            <InfoField
              label="Fishing Income"
              value={
                formData.fisheries_income_salary
                  ? formData.fisheries_income_salary
                  : "None"
              }
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Contact Person Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField
            label="Full Name"
            value={`${formData.contact_fname} ${formData.contact_mname || ""} ${formData.contact_lname}`}
          />
          <InfoField
            label="Relationship"
            value={formData.contact_relationship}
          />
          <InfoField
            label="Contact Number"
            value={formData.contact_contactno}
          />
          <InfoField
            label="Address"
            value={`${formData.contact_barangay}, ${formData.contact_municipality}, La Union`}
          />
        </div>

        {/* Demographics & Eligibility */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Demographics and Eligibility
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoField
            label="With Voter ID?"
            value={formData.with_voterID ? "Yes" : "No"}
          />
          {formData.with_voterID && (
            <InfoField
              label="Voter ID Number"
              value={formData.voterID_number}
            />
          )}
          <InfoField
            label="With CCT/4Ps?"
            value={formData.is_CCT_4ps ? "Yes" : "No"}
          />
          <InfoField
            label="ICC Member?"
            value={formData.is_ICC ? "Yes" : "No"}
          />
        </div>

        {/* Livelihood Information */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Livelihood Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoField
            label="Main Source of Income"
            value={formData.main_source_livelihood}
          />
          <InfoField
            label="Other Source of Livelihood"
            value={
              Array.isArray(formData.other_source_livelihood) &&
              formData.other_source_livelihood.length > 0
                ? formData.other_source_livelihood
                    .map((v) =>
                      v === "Others" && (formData.other_source_livelihood_other || "").trim()
                        ? `Others (${formData.other_source_livelihood_other.trim()})`
                        : v
                    )
                    .join(", ")
                : "None"
            }
          />
        </div>

        {/* Organization Information */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Organization Information
        </h2>
        {(formData.organizations || []).map((org, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 border-b border-gray-200 pb-2"
          >
            <InfoField
              label="Name"
              value={
                org.org_name === "Others" ? org.custom_org_name : org.org_name
              }
            />
            <InfoField label="Member Since" value={org.member_since} />
            <InfoField label="Position" value={org.org_position} />
          </div>
        ))}

        {/* Attachments */}
<h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
  Image
</h2>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <InfoField
    label="Profile"
    value={
      formData.picturePreview ? (
        <img src={formData.picturePreview} className="w-40 h-40 object-cover rounded-lg" />
      ) : (
        "None"
      )
    }
  />
</div>

{/* Certification */}
<h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
  Certification
</h2>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <InfoField
    label="Name of Applicant"
    value={`${formData.salutations ? formData.salutations + ' ' : ''}${formData.first_name} ${formData.middle_name ? formData.middle_name + ' ' : ''}${formData.last_name}`.trim()}
  />
  <InfoField
    label="Date of Application"
    value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  />
</div>
<h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
  Signatories
</h2>
<div className="bg-blue-50 p-4 rounded-lg">
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 place-items-center">
    <div className="text-center flex flex-col items-center">
      <span className="block text-sm text-gray-500">Reviewed by</span>
      <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
        {barangayVerifier 
          ? `${barangayVerifier.first_name} ${barangayVerifier.middle_name ? barangayVerifier.middle_name + ' ' : ''}${barangayVerifier.last_name}`
          : 'Not assigned'}
      </p>
      <p className="text-xs text-gray-600 mt-1">Barangay Captain</p>
    </div>
    <div className="text-center flex flex-col items-center">
      <span className="block text-sm text-gray-500">Certified correct by</span>
      <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
        {signatories.municipal 
          ? `${signatories.municipal.first_name} ${signatories.municipal.middle_name ? signatories.municipal.middle_name + ' ' : ''}${signatories.municipal.last_name}`
          : 'Not assigned'}
      </p>
      <p className="text-xs text-gray-600 mt-1">Municipal Agriculturist</p>
    </div>
    <div className="text-center flex flex-col items-center">
      <span className="block text-sm text-gray-500">Approved by</span>
              <p className="mt-1 text-base font-semibold text-gray-900 uppercase underline">
                {signatories.mayor 
                  ? `${signatories.mayor.first_name} ${signatories.mayor.middle_name ? signatories.mayor.middle_name + ' ' : ''}${signatories.mayor.last_name}`
                  : 'Not assigned'}
              </p>
              <p className="text-xs text-gray-600 mt-1">Mayor</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end">
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "Creating..." : "Create Fisherfolk"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 relative">
        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
      </form>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '' })}
        title={alertModal.title}
        message={alertModal.message}
      />

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmitWithClear}
        title="Confirm Fisherfolk Creation"
        message="Are you sure you want to create this fisherfolk?"
      />
    </>
  );
});

AddFisherfolkForm.displayName = 'AddFisherfolkForm';

export default AddFisherfolkForm;
