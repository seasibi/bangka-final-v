import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import SuccessModal from "../../components/SuccessModal";
import BoatOptionModal from "../../components/BoatOptionModal";
import AlertModal from "../../components/AlertModal";
import { createFisherfolk } from "../../services/fisherfolkService";
import { useAuth } from "../../contexts/AuthContext";
import AddFisherfolkForm from "../../components/FisherfolkManagement/AddFisherfolkForm";
import axios from "axios";

const AddFisherfolk = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showBoatOptionModal, setShowBoatOptionModal] = useState(false);
  const [createdFisherfolk, setCreatedFisherfolk] = useState(null);
  const [createdFisherfolkMunicipality, setCreatedFisherfolkMunicipality] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' });
  const [currentStep, setCurrentStep] = useState(1);
  const [formTitle, setFormTitle] = useState("Add New Fisherfolk");
  const [formSubtitle, setFormSubtitle] = useState("Please fill out the form and confirm details to register a new fisherfolk.");
  const formRef = useRef(null);
  const [coastalMunicipalities, setCoastalMunicipalities] = useState([]);

  const handleBackClick = () => {
    if (currentStep === 2 && formRef.current?.handleBack) {
      // If on confirmation page, go back to edit form
      formRef.current.handleBack();
    } else {
      // Otherwise, navigate back to fisherfolk management
      navigate(-1);
    }
  };

  // Fetch municipalities with coastal status from API
  useEffect(() => {
    const fetchMunicipalities = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
        const response = await axios.get(`${apiUrl}/municipalities/`);
        // Extract only coastal municipality names
        const coastal = response.data
          .filter(muni => muni.is_coastal)
          .map(muni => muni.name);
        setCoastalMunicipalities(coastal);
        console.log('[COASTAL] Loaded coastal municipalities:', coastal);
      } catch (error) {
        console.error('[COASTAL] Failed to fetch municipalities:', error);
        // Fallback to hardcoded list if API fails
        setCoastalMunicipalities([
          "Agoo", "Aringay", "Bacnotan", "Balaoan", "Bangar", 
          "Bauang", "Caba", "Luna", "Rosario", "City of San Fernando", 
          "San Juan", "Santo Tomas", "Sudipen"
        ]);
      }
    };
    fetchMunicipalities();
  }, []);

  const handleSubmit = async (formData) => {
    setLoading(true);
    
    // Proceed directly with submission
    await proceedWithSubmission(formData);
  };

  const proceedWithSubmission = async (formData) => {
    setLoading(true);
    // Ensure all address fields are always sent
    const addressFields = [
      "street", "barangay", "municipality", "province", "region",
      "residency_years", "barangay_verifier", "position", "verified_date"
    ];
    const addressData = {};
    addressFields.forEach(field => {
      addressData[field] = formData[field] !== undefined ? formData[field] : "";
    });

    const submitData = {
      ...formData,
      ...addressData, // always include address fields
      created_by: user?.id,
      appelation:
        formData.appelation && formData.appelation.trim() !== ""
          ? formData.appelation
          : "N/A",
    };
    const processedFormData = { ...submitData, created_by: user?.id };
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
    try {
      // 1. Create fisherfolk (main record)
      const fisherfolk = await createFisherfolk(processedFormData);
      // 2. Ensure address is created (if not handled by backend)
      // 3. Ensure contacts, organization, households are created (if needed)
      // (Assume backend creates address if address fields are present, but for contacts/org/households, add API calls if needed)

      // Example: If you have API endpoints for contacts, organization, households, call them here
      // await createContact({ ... });
      // await createOrganization({ ... });
      // await createHousehold({ ... });

      // Wait for all related data to be created before proceeding
      setCreatedFisherfolk(fisherfolk);
      setCreatedFisherfolkMunicipality(formData.municipality); // Store municipality from form data
      // Save address data to sessionStorage for fallback if needed
      const addressFields = [
        "street", "barangay", "municipality", "province", "region",
        "residency_years", "barangay_verifier", "position", "verified_date"
      ];
      const addressData = {};
      addressFields.forEach(field => {
        addressData[field] = formData[field] !== undefined ? formData[field] : "";
      });
      addressData.fisherfolk = fisherfolk.registration_number;
      sessionStorage.setItem('lastFisherfolkAddress', JSON.stringify(addressData));


      // Ensure all data is in DB before showing modal
      // Optionally, you can add a small delay or poll for address/related data if backend is slow
      
      // Clear form data only on successful submission
      if (formRef.current?.clearFormData) {
        formRef.current.clearFormData();
      }
      
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Error creating fisherfolk:', err);
      
      // Extract detailed error message
      let errorMessage = 'Failed to add fisherfolk. Please try again.';
      
      if (err.response) {
        // Server responded with error
        if (err.response.data) {
          if (typeof err.response.data === 'string') {
            errorMessage = err.response.data;
          } else if (err.response.data.message) {
            errorMessage = err.response.data.message;
          } else if (err.response.data.error) {
            errorMessage = err.response.data.error;
          } else {
            // Format field-specific errors
            const errors = [];
            Object.keys(err.response.data).forEach(key => {
              const value = err.response.data[key];
              if (Array.isArray(value)) {
                errors.push(`${key}: ${value.join(', ')}`);
              } else {
                errors.push(`${key}: ${value}`);
              }
            });
            if (errors.length > 0) {
              errorMessage = errors.join('\n');
            }
          }
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setAlertModal({
        isOpen: true,
        title: 'Error Adding Fisherfolk',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="h-full bg-gray-50 px-4 py-6 pb-16">

        {/* form title */}
        <div className="flex items-center mb-3 mt-2">

          {/* back button */}
          <button type="button" onClick={handleBackClick} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          {/* title */}
          <div className="grid grid-cols-1 grid-rows-2 ml-4">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>{formTitle}</h1>
            <p className="text-base text-gray-700" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              {formSubtitle}
            </p>
          </div>
          
        </div>

        <AddFisherfolkForm 
          ref={formRef}
          onSubmit={handleSubmit} 
          loading={loading}
          setCurrentStep={setCurrentStep}
          setFormTitle={setFormTitle}
          setFormSubtitle={setFormSubtitle}
        />
      </div>
      <SuccessModal
        isOpen={showSuccessModal}
        title="Successfully Added"
        message={
          <span>
            <span className="font-bold">
              {createdFisherfolk?.first_name} {createdFisherfolk?.last_name}
            </span>{" "}
            has been successfully added!
          </span>
        }
        onClose={() => {
          setShowSuccessModal(false);
          // Debug: Check municipality
          console.log('[DEBUG] Fisherfolk municipality from form:', createdFisherfolkMunicipality);
          console.log('[DEBUG] Coastal municipalities list:', coastalMunicipalities);
          console.log('[DEBUG] Is coastal?', coastalMunicipalities.includes(createdFisherfolkMunicipality));
          
          // Only show boat option modal if fisherfolk is from a coastal municipality
          if (createdFisherfolk && coastalMunicipalities.includes(createdFisherfolkMunicipality)) {
            setShowBoatOptionModal(true);
          } else {
            // If not coastal, just navigate back
            navigate(-1);
          }
        }}
      />
      
    <BoatOptionModal
        isOpen={showBoatOptionModal}
        fisherfolkName={`${createdFisherfolk?.first_name || ""} ${createdFisherfolk?.last_name || ""}`}
        onClose={() => {
          setShowBoatOptionModal(false);
          navigate(-1); // go back if No
        }}
        onYes={async () => {
          setShowBoatOptionModal(false);
          // Fetch address for created fisherfolk before navigating
          let address = null;
          try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
            const res = await axios.get(`${apiUrl}addresses/?fisherfolk=${createdFisherfolk?.registration_number}`);
            address = Array.isArray(res.data) ? res.data[0] : res.data;
          } catch (err) {
            console.error('[DEBUG] Failed to fetch address for boat registry:', err);
            // Fallback: use address from sessionStorage if available
            const stored = sessionStorage.getItem('lastFisherfolkAddress');
            if (stored) {
              const parsed = JSON.parse(stored);
              // Only use if matches this fisherfolk
              if (parsed.fisherfolk === createdFisherfolk?.registration_number) {
                address = parsed;
              }
            }
          }
          navigate("/admin/boat-registry/add", {
            state: {
              fisherfolk: {
                ...createdFisherfolk,
                address: address || {},
              }
            },
          });
        }}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '' })}
        title={alertModal.title}
        message={alertModal.message}
        variant="danger"
      />
    </div>
  );
};

export default AddFisherfolk;
