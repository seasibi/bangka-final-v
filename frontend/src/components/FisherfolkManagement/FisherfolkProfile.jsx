// src/pages/admin/FisherfolkProfile.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "../../services/api_urls";
import { AnimatePresence } from "framer-motion";
import { logActivity } from '../../utils/activityLog';
import Modal from "../../components/Modal";
import SuccessModal from "../../components/SuccessModal";
import Loader from "../../components/Loader";
import Button from "../Button";
import { getBarangayVerifiers } from "../../services/barangayVerifierService";
import { getSignatories } from "../../services/signatoriesService";
import { getBarangays } from "../../services/municipalityService";
import useMunicipalities from "../../hooks/useMunicipalities";
import jsPDF from "jspdf";
import logo from '../../assets/logo.png';

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

// --- Helpers ---
const Section = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2">
      {title}
    </h3>
    {children}
  </div>
);

const displayValue = (val) => {
  if (val === null || val === undefined || val === "") return "Not provided";
  return val;
};

const Info = ({ label, value }) => (
  <div>
    <p className="text-sm font-medium text-blue-800">{label}</p>
    <p className="text-sm font-semibold text-gray-900 mt-1">
      {displayValue(value)}
    </p>
  </div>
);

const FisherfolkProfile = ({ editPathBuilder }) => {
  const { id } = useParams();
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [fisherfolk, setFisherfolk] = useState(null);
  const [address, setAddress] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [contact, setContact] = useState(null);
  const [household, setHousehold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [barangayVerifier, setBarangayVerifier] = useState(null);
  const [signatories, setSignatories] = useState({ municipal: null, mayor: null });
  const { municipalities } = useMunicipalities();

  // Normalize municipality names to avoid case/spacing mismatches (e.g., "City Of" vs "City of")
  const normalizeMunicipality = (s = '') => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

  useEffect(() => {
    const fetchFisherfolk = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await apiClient.get(`/fisherfolk/${id}/`);
        const data = resp.data;

        setFisherfolk(data || null);

        // attempt to read nested related objects in a tolerant way:
        // support shapes like: data.address (object) OR data.addresses (array) OR data.address (null)
        const addr =
          data?.address ||
          (Array.isArray(data?.addresses) ? data.addresses[0] : null) ||
          null;
        setAddress(addr);

        const hh =
          data?.household ||
          (Array.isArray(data?.households) ? data.households[0] : null) ||
          null;
        setHousehold(hh);

        // organizations might be an array or single object
        let org = null;
        if (Array.isArray(data?.organizations) && data.organizations.length > 0) {
          org = data.organizations[0];
        } else if (data?.organization) {
          org = data.organization;
        } else if (Array.isArray(data?.organization) && data.organization.length > 0) {
          org = data.organization[0];
        } else if (data?.org_name || data?.member_since || data?.org_position) {
          // Fallback for older payloads with flat org fields
          org = {
            org_name: data.org_name || "",
            member_since: data.member_since || "",
            org_position: data.org_position || "",
          };
        }
        
        // Debug: Log organization data
        console.log("[FisherfolkProfile] Organization data:", {
          org_name: org?.org_name,
          custom_org_name: org?.custom_org_name,
          full_org: org
        });
        
        setOrganization(org);

        // contacts: some endpoints return an object under `contacts` or `contact`
        const cont =
          data?.contacts ||
          data?.contact ||
          (Array.isArray(data?.contacts) ? data.contacts[0] : null) ||
          null;
        setContact(cont);

      } catch (err) {
        console.error("Error fetching fisherfolk:", err);
        setError("Failed to load fisherfolk data.");
      } finally {
        setLoading(false);
      }
    };

    fetchFisherfolk();
  }, [id]);

  // Fetch barangay verifier and signatories when fisherfolk and address data are loaded
  useEffect(() => {
    const fetchVerifierAndSignatories = async () => {
      if (!address || !municipalities || municipalities.length === 0) {
        return;
      }

      try {
        // Find municipality and barangay IDs with normalized comparison
        const selectedMuni = municipalities.find(
          m => normalizeMunicipality(m.name) === normalizeMunicipality(address.municipality)
        );
        
        if (selectedMuni) {
          // Fetch all barangays to get the barangay_id (skip silently if forbidden)
          let barangay = null;
          try {
            const barangays = await getBarangays({ municipality_id: selectedMuni.municipality_id });
            barangay = barangays.find(b => b.name === address.barangay) || null;
          } catch (e) {
            if (e?.response?.status !== 403) throw e;
          }

          // Try to fetch barangay verifier only if we have access and an id
          if (barangay) {
            try {
              const verifiers = await getBarangayVerifiers({
                municipality_id: selectedMuni.municipality_id,
                barangay_id: barangay.barangay_id,
                is_active: true
              });
              const captain = verifiers.find(v => v.position === 'Barangay Captain');
              setBarangayVerifier(captain || null);
            } catch (e) {
              if (e?.response?.status !== 403) throw e; // ignore 403; leave verifier null
            }
          } else {
            setBarangayVerifier(null);
          }

          // Fetch signatories with municipal scope; on 403 fall back to province-wide
          let allSignatories = [];
          try {
            allSignatories = await getSignatories({
              municipality_id: selectedMuni.municipality_id,
              is_active: true
            });
          } catch (e) {
            if (e?.response?.status === 403) {
              allSignatories = await getSignatories({ is_active: true });
            } else {
              throw e;
            }
          }

          // Prefer Municipal Agriculturist; else Provincial Agriculturist from whichever list we have
          let municipal = (allSignatories || []).find(s => s.position === 'Municipal Agriculturist') || null;
          if (!municipal) {
            municipal = (allSignatories || []).find(s => s.position === 'Provincial Agriculturist') || null;
          }
          const mayor = (allSignatories || []).find(s => s.position === 'Mayor') || null;

          setSignatories({ municipal, mayor });
        }
      } catch (error) {
        console.error('Error fetching verifier and signatories:', error);
        setBarangayVerifier(null);
        setSignatories({ municipal: null, mayor: null });
      }
    };

    fetchVerifierAndSignatories();
  }, [address, municipalities]);

  const handlePrintReport = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const margin = 40;
    const headerHeight = 120;
    const logoWidth = 80;
    const logoHeight = 80;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const primary = [37, 99, 235]; // blue-600
    const lightBg = [241, 245, 249]; // slate-100

    const drawHeader = () => {
      try {
        doc.addImage(logo, 'PNG', margin, 20, logoWidth, logoHeight);
      } catch {}
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(
        'Office of the Provincial Agriculturist - Fisheries Section',
        margin + logoWidth + 20,
        40,
        { maxWidth: pageWidth - margin - logoWidth - 20 }
      );
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const contactText =
        'Provincial Agriculturist Office, Aguila Road, Brgy. II\n' +
        'City of San Fernando, La Union 2500\n' +
        'Phone: (072) 888-3184 / 607-4492 / 607-4488\n' +
        'Email: opaglaunion@yahoo.com';
      doc.text(contactText, margin + logoWidth + 20, 60, { maxWidth: 400 });
      doc.setLineWidth(1);
      doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
    };

    const drawFooter = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const footerY = pageHeight - 24;
      const dateLine = `Date generated: ${new Date().toLocaleDateString()}`;
      const copyLine = `  ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.`;
      doc.text(dateLine, pageWidth / 2, footerY - 12, { align: 'center' });
      doc.text(copyLine, pageWidth / 2, footerY, { align: 'center' });
    };

    const safe = (v) => (v === null || v === undefined || v === '' ? 'N/A' : String(v));
    const ensureSpace = (needed = 40) => {
      if (y + needed > pageHeight - 50) {
        drawFooter();
        doc.addPage();
        drawHeader();
        y = headerHeight + 30;
      }
    };
    const addSectionHeader = (title) => {
      ensureSpace(40);
      doc.setFillColor(...lightBg);
      doc.rect(margin, y - 4, pageWidth - margin * 2, 26, 'F');
      doc.setTextColor(...primary);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, margin + 8, y + 14);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      y += 36;
    };
    const addDivider = () => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;
    };
    const addKVGrid = (items, cols = 2, stacked = false) => {
      const colWidth = (pageWidth - margin * 2) / cols;
      let col = 0;
      let rowMaxHeight = 0;
      items.forEach(([label, value], idx) => {
        ensureSpace(30);
        const x = margin + col * colWidth;
        if (stacked) {
          const maxTextWidth = colWidth - 10;
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}:`, x, y);
          doc.setFont('helvetica', 'normal');
          const v = safe(value);
          const wrapped = doc.splitTextToSize(v, Math.max(60, maxTextWidth));
          doc.text(wrapped, x, y + 14);
          const height = 14 + 14 * Math.max(1, wrapped.length) + 2;
          rowMaxHeight = Math.max(rowMaxHeight, height);
        } else {
          const labelX = x;
          const valueX = x + 140;
          const maxTextWidth = x + colWidth - valueX - 4;
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}:`, labelX, y);
          doc.setFont('helvetica', 'normal');
          const v = safe(value);
          const wrapped = doc.splitTextToSize(v, Math.max(60, maxTextWidth));
          doc.text(wrapped, valueX, y);
          const height = 14 * Math.max(1, wrapped.length);
          rowMaxHeight = Math.max(rowMaxHeight, height);
        }
        col += 1;
        if (col >= cols || idx === items.length - 1) {
          y += rowMaxHeight + 10;
          rowMaxHeight = 0;
          col = 0;
        }
      });
    };
    const addCenteredTitle = (text, size = 18) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      doc.setTextColor(17, 24, 39);
      doc.text(text, pageWidth / 2, y, { align: 'center' });
      y += 24;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    };
    const addSignatoriesGrid = (list) => {
      // list: [{name, position}]
      const cols = Math.min(3, list.length || 3);
      const colWidth = (pageWidth - margin * 2) / cols;
      let col = 0;
      list.forEach((s, i) => {
        ensureSpace(60);
        const xCenter = margin + col * colWidth + colWidth / 2;
        // draw underline first (fixed width for consistency)
        const lineWidth = 140;
        doc.setDrawColor(0, 0, 0);
        doc.line(xCenter - lineWidth / 2, y, xCenter + lineWidth / 2, y);
        // name below the line
        const name = (s.name || 'Not assigned').toUpperCase();
        doc.setFont('helvetica', 'bold');
        doc.text(name, xCenter, y + 14, { align: 'center' });
        // position below the name
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(s.position || '', xCenter, y + 28, { align: 'center' });
        doc.setFontSize(11);
        col += 1;
        if (col >= cols || i === list.length - 1) {
          y += 48;
          col = 0;
        }
      });
    };

    drawHeader();
    let y = headerHeight + 30;

    // Title
    addCenteredTitle('Fisherfolk Profile', 18);
    addDivider();

    // Account Information
    addSectionHeader('Account Information');
    addKVGrid([
      ['Registration Number', fisherfolk?.registration_number],
      ['Status', fisherfolk?.is_active ? 'Active' : 'Inactive'],
    ], 3, true);
    addDivider();

    // Profile Information
    addSectionHeader('Profile Information');
    addKVGrid([
      ['Salutations', fisherfolk?.salutations],
      ['First Name', fisherfolk?.first_name],
      ['Middle Name', fisherfolk?.middle_name],
      ['Last Name', fisherfolk?.last_name],
      ['Appellation', fisherfolk?.apelation],
      ['Birth Date', fisherfolk?.birth_date],
      ['Age', fisherfolk?.age],
      ['Birth Place', fisherfolk?.birth_place],
      ['Civil Status', fisherfolk?.civil_status],
      ['Sex', fisherfolk?.sex],
      ['Contact Number', fisherfolk?.contact_number],
      ['Nationality', fisherfolk?.nationality],
      ['Fisherfolk Status', fisherfolk?.fisherfolk_status],
      ["Mother's Maiden Name", fisherfolk?.mothers_maidenname],
      ['Fishing Ground', fisherfolk?.fishing_ground],
      ['FMA Number', fisherfolk?.fma_number],
      ['Religion', fisherfolk?.religion],
    ], 3, true);
    addDivider();

    // Address
    if (address) {
      addSectionHeader('Address');
      addKVGrid([
        ['Street', address.street],
        ['Barangay', address.barangay],
        ['City/Municipality', address.municipality],
        ['Province', address.province],
        ['Region', address.region],
        ['Years of Residency', address.residency_years],
      ], 3, true);
      addDivider();
      addSectionHeader('Barangay Verifier');
      addKVGrid([
        ['Verifier', address.barangay_verifier],
        ['Position', address.position],
        ['Verified Date', address.verified_date],
      ], 3, true);
      addDivider();
    }

    // Household
    if (household) {
      addSectionHeader('Number of Household Members');
      addKVGrid([
        ['Total', household.total_no_household_memb],
        ['Male', household.no_male],
        ['Female', household.no_female],
        ['Children', household.no_children],
        ['In School', household.no_in_school],
        ['Out of School', household.no_out_school],
        ['Employed', household.no_employed],
        ['Unemployed', household.no_unemployed],
      ], 3, true);
      addDivider();
    }

    // Educational Background
    addSectionHeader('Educational Background');
    addKVGrid([
      ['Educational Background', fisherfolk?.educational_background],
    ], 3, true);
    addDivider();

    // Monthly Income
    addSectionHeader('Monthly Income Information');
    addKVGrid([
      ['Monthly Income', fisherfolk?.household_month_income],
    ], 3, true);
    addDivider();

    // Contact
    const ec = contact || fisherfolk?.contacts || {};
    addSectionHeader('Contact Information');
    const contactRows = [
      ['Full Name', `${safe(ec.contact_fname || '')} ${safe(ec.contact_mname || '')} ${safe(ec.contact_lname || '')}`.trim()],
      ['Relationship', ec.contact_relationship],
      ['Contact Number', ec.contact_contactno],
    ];
    if (ec.contact_barangay || ec.contact_municipality) {
      contactRows.push(['Address', `${safe(ec.contact_barangay || '')}, ${safe(ec.contact_municipality || '')}, La Union`]);
    }
    addKVGrid(contactRows, 3, true);
    addDivider();

    // Demographics & Eligibility
    addSectionHeader('Demographics & Eligibility');
    const demoRows = [
      ['With Voter ID?', fisherfolk?.with_voterID ? 'Yes' : 'No'],
      ['With CCT/4Ps?', fisherfolk?.is_CCT_4ps ? 'Yes' : 'No'],
      ['ICC Member?', fisherfolk?.is_ICC ? 'Yes' : 'No'],
    ];
    if (fisherfolk?.with_voterID) demoRows.push(['Voter ID Number', fisherfolk?.voterID_number]);
    addKVGrid(demoRows, 3, true);
    addDivider();

    // Livelihood
    const oslList = Array.isArray(fisherfolk?.other_source_livelihood) ? fisherfolk.other_source_livelihood : [];
    const oslText = oslList.length > 0
      ? oslList.map(v => (v === 'Others' && (fisherfolk?.other_source_income || '').trim()
          ? `Others (${fisherfolk.other_source_income.trim()})`
          : v)).join(', ')
      : 'None';
    addSectionHeader('Livelihood');
    addKVGrid([
      ['Main Source of Livelihood', fisherfolk?.other_main_source_livelihood || fisherfolk?.main_source_livelihood],
      ['Other Source of Livelihood', oslText],
    ], 3, true);
    addDivider();

    // Organization (first entry if present)
    let org = null;
    if (Array.isArray(fisherfolk?.organizations) && fisherfolk.organizations.length > 0) org = fisherfolk.organizations[0];
    if (!org && fisherfolk?.organization) org = fisherfolk.organization;
    if (org && (org.org_name || org.member_since || org.org_position)) {
      addSectionHeader('Organization Information');
      addKVGrid([
        ['Name', org.org_name],
        ['Member Since', org.member_since],
        ['Position', org.org_position],
      ], 3, true);
      addDivider();
    }

    // Certification
    const fullName = `${safe(fisherfolk?.salutations ? fisherfolk.salutations + ' ' : '')}${safe(fisherfolk?.first_name)} ${safe(fisherfolk?.middle_name || '')} ${safe(fisherfolk?.last_name)}`.trim();
    addSectionHeader('Certification');
    addKVGrid([
      ['Name of Applicant', fullName],
      ['Date of Registration', fisherfolk?.date_added ? new Date(fisherfolk.date_added).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString()],
    ], 2);
    addDivider();

    // Signatories
    addSectionHeader('Signatories');
    const verifierName = barangayVerifier ? `${barangayVerifier.first_name} ${barangayVerifier.middle_name ? barangayVerifier.middle_name + ' ' : ''}${barangayVerifier.last_name}` : 'Not assigned';
    const muniAgri = signatories.municipal ? `${signatories.municipal.first_name} ${signatories.municipal.middle_name ? signatories.municipal.middle_name + ' ' : ''}${signatories.municipal.last_name}` : 'Not assigned';
    const mayor = signatories.mayor ? `${signatories.mayor.first_name} ${signatories.mayor.middle_name ? signatories.mayor.middle_name + ' ' : ''}${signatories.mayor.last_name}` : 'Not assigned';
    addSignatoriesGrid([
      { name: verifierName, position: 'Barangay Captain' },
      { name: muniAgri, position: 'Municipal Agriculturist' },
      { name: mayor, position: 'Mayor' },
    ]);

    // Footer on last page
    drawFooter();

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      w.onload = () => {
        w.focus();
        w.print();
      };
    }
  };

  const handleUpdateStatus = async () => {
    try {
      // use registration_number if that's what your API expects for lookup
      await apiClient.patch(`/fisherfolk/${fisherfolk.registration_number}/`, {
        is_active: !fisherfolk.is_active,
      });
      const wasActive = fisherfolk.is_active;

      // Track last deactivation locally for sorting purposes
      try {
        const key = fisherfolk.registration_number || fisherfolk.id;
        const storeKey = 'ff_last_deactivated';
        const map = JSON.parse(localStorage.getItem(storeKey) || '{}');
        if (wasActive) {
          map[key] = Date.now();
        } else {
          delete map[key];
        }
        localStorage.setItem(storeKey, JSON.stringify(map));
      } catch {}

      setFisherfolk({ ...fisherfolk, is_active: !fisherfolk.is_active });
      setIsStatusModalOpen(false);
      setSuccessMsg(`${wasActive ? "Fisherfolk deactivated" : "Fisherfolk activated"} successfully.`);
      setSuccessOpen(true);

    } catch (error) {
      console.error("Error updating status:", error);
      setError("Failed to update status.");
    }
  };

  const handleEditConfirm = () => {
    const buildEditPath =
      typeof editPathBuilder === "function"
        ? editPathBuilder
        : (reg) => `/admin/fisherfolk/edit/${reg}`;
    navigate(buildEditPath(fisherfolk.registration_number));
  };

  if (loading) return <Loader />;

  return (
    <div
      className="container mx-auto px-4 py-8 font-montserrat"
      style={{ fontFamily: "Montserrat, sans-serif" }}
    >
      {/* form title */}
      <div className="flex items-center mb-3 mt-2">
        {/* back button */}
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

        {/* title */}
        <div className="grid grid-cols-1 grid-rows-2 ml-4">
          <h1 className="text-3xl font-bold text-gray-900">
            View Fisherfolk Profile
          </h1>
          <p className="text-base text-gray-700">
            View and manage fisherfolk profile details.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}

      {!fisherfolk ? (
        <div className="p-6 bg-white rounded shadow">No fisherfolk found.</div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-6">
              <img
                src={
                  fisherfolk.fisherfolk_img
                    ? fisherfolk.fisherfolk_img.startsWith("http")
                      ? fisherfolk.fisherfolk_img
                      : `${API_BASE}${fisherfolk.fisherfolk_img}`
                    : "/placeholder-avatar.png"
                }
                alt="Fisherfolk"
                className="w-32 h-32 rounded-full object-cover shadow-md"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder-avatar.png";
                }}
              />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {fisherfolk.first_name} {fisherfolk.middle_name} {fisherfolk.last_name}
                </h2>
                <p className="text-sm text-gray-500">
                  Reg. No: {fisherfolk.registration_number}
                </p>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded-full ${
                    fisherfolk.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {fisherfolk.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handlePrintReport} className="bg-purple-600 hover:bg-purple-700 text-white">Print Report</Button>
              <Button onClick={() => setIsEditModalOpen(true)}>Edit</Button>
              <Button
                onClick={() => setIsStatusModalOpen(true)}
                className={`px-4 py-2 rounded text-white ${fisherfolk.is_active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
                variant={fisherfolk.is_active ? "destructive" : "success"}
              >
                {fisherfolk.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>

          {/* Account Information */}
          <Section title="Account Information">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Info label="Registration Number" value={fisherfolk.registration_number} />
              <Info label="Status" value={fisherfolk.is_active ? "Active" : "Inactive"} />
            </div>
          </Section>

          {/* Profile Information */}
          <Section title="Profile Information">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Info label="Salutations" value={fisherfolk.salutations} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Info label="First Name" value={fisherfolk.first_name} />
              <Info label="Middle Name" value={fisherfolk.middle_name} />
              <Info label="Last Name" value={fisherfolk.last_name} />
              <Info label="Appelation" value={fisherfolk.apelation} />
              <Info label="Birth Date" value={fisherfolk.birth_date} />
              <Info label="Age" value={fisherfolk.age} />
              <Info label="Birth Place" value={fisherfolk.birth_place} />
              <Info label="Civil Status" value={fisherfolk.civil_status} />
              <Info label="Sex" value={fisherfolk.sex} />
              <Info label="Contact Number" value={fisherfolk.contact_number} />
              <Info label="Nationality" value={fisherfolk.nationality} />
              <Info label="Fisherfolk Status" value={fisherfolk.fisherfolk_status} />
              <Info label="Mothers Maiden Name" value={fisherfolk.mothers_maidenname} />
              <Info label="Fishing Ground" value={fisherfolk.fishing_ground} />
              <Info label="FMA Number" value={fisherfolk.fma_number} />
              <Info label="Religion" value={fisherfolk.religion} />
            </div>
          </Section>

          {/* Address */}
          {address && (
            <>
              <Section title="Address">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Info label="Street" value={address.street} />
                  <Info label="Barangay" value={address.barangay} />
                  <Info label="City/Municipality" value={address.municipality} />
                  <Info label="Province" value={address.province} />
                  <Info label="Region" value={address.region} />
                  <Info label="Years of Residency" value={address.residency_years} />
                </div>
              </Section>
              <Section title="Barangay Verifier">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Info label="Verifier" value={address.barangay_verifier} />
                  <Info label="Position" value={address.position} />
                  <Info label="Verified Date" value={address.verified_date} />
                </div>
              </Section>
            </>
          )}

          {/* Household */}
          {household && (
            <Section title="Number of Household Members">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Info label="Total" value={household.total_no_household_memb} />
                <Info label="Male" value={household.no_male} />
                <Info label="Female" value={household.no_female} />
                <Info label="Children" value={household.no_children} />
                <Info label="In School" value={household.no_in_school} />
                <Info label="Out of School" value={household.no_out_school} />
                <Info label="Employed" value={household.no_employed} />
                <Info label="Unemployed" value={household.no_unemployed} />
              </div>
            </Section>
          )}

          {/* Education */}
          <Section title="Educational Background">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Info label="Educational Background" value={fisherfolk.educational_background} />
            </div>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income */}
            <Section title="Monthly Income Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Info label="Monthly Income" value={fisherfolk.household_month_income} />
              </div>
            </Section>

            {/* Income */}
            <Section title="Other Monthly Income Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Info label="Farming Income" value={fisherfolk.farming_income_salary ?? "None"} />
                <Info label="Fisheries Income" value={fisherfolk.fisheries_income_salary ?? "None"} />
              </div>
            </Section>
          </div>

          {/* Contact */}
          <Section title="Contact Information">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Info
                label="Full Name"
                value={`${(contact?.contact_fname || fisherfolk.contacts?.contact_fname || "")} ${(contact?.contact_mname || fisherfolk.contacts?.contact_mname || "")} ${(contact?.contact_lname || fisherfolk.contacts?.contact_lname || "")}`.trim()}
              />
              <Info label="Relationship" value={contact?.contact_relationship || fisherfolk.contacts?.contact_relationship || ""} />
              <Info label="Contact Number" value={contact?.contact_contactno || fisherfolk.contacts?.contact_contactno || ""} />
              <Info
                label="Address"
                value={
                  contact || fisherfolk.contacts
                    ? `${(contact?.contact_barangay || fisherfolk.contacts?.contact_barangay || "")}, ${(contact?.contact_municipality || fisherfolk.contacts?.contact_municipality || "")}, La Union`
                    : ""
                }
              />
            </div>
          </Section>

          {/* Demographics & Eligibility */}
          <Section title="Demographics & Eligibility">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-1">
                <Info label="With Voter ID?" value={fisherfolk.with_voterID ? "Yes" : "No"} />
                {fisherfolk.with_voterID && (
                  <div className="mt-2 ml-6 border-l-2 border-blue-900 pl-4">
                    <p className="text-sm text-blue-800 font-medium">Voter ID Number</p>
                    <p className="text-black">{fisherfolk.voterID_number}</p>
                  </div>
                )}
              </div>
              <Info label="With CCT/4Ps?" value={fisherfolk.is_CCT_4ps ? "Yes" : "No"} />
              <Info label="ICC Member?" value={fisherfolk.is_ICC ? "Yes" : "No"} />
            </div>
          </Section>

          {/* Livelihood */}
          <Section title="Livelihood">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Info 
                label="Main Source of Livelihood" 
                value={
                  fisherfolk.other_main_source_livelihood
                    ? fisherfolk.other_main_source_livelihood
                    : fisherfolk.main_source_livelihood
                } 
              />
              <Info
                label="Other Source of Livelihood"
                value={
                  Array.isArray(fisherfolk.other_source_livelihood) && fisherfolk.other_source_livelihood.length > 0
                    ? fisherfolk.other_source_livelihood
                        .map((v) =>
                          v === "Others" && (fisherfolk.other_source_income || "").trim()
                            ? `Others (${fisherfolk.other_source_income.trim()})`
                            : v
                        )
                        .join(", ")
                    : "None"
                }
              />
            </div>
          </Section>

          {/* Organization */}
          {Array.isArray(fisherfolk?.organizations) && fisherfolk.organizations.length > 0 ? (
            <Section title="Organization">
              {fisherfolk.organizations.map((org, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-3 border-b border-gray-200 pb-2">
                  <Info 
                    label="Organization Name" 
                    value={
                      org?.org_name === "Others" && org?.custom_org_name
                        ? org.custom_org_name
                        : org?.org_name || "Not provided"
                    } 
                  />
                  <Info label="Member Since" value={org?.member_since} />
                  <Info label="Position" value={org?.org_position} />
                </div>
              ))}
            </Section>
          ) : (
            organization && (
              <Section title="Organization">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Info 
                    label="Organization Name" 
                    value={
                      organization.org_name === "Others" && organization.custom_org_name
                        ? organization.custom_org_name
                        : organization.org_name || "Not provided"
                    } 
                  />
                  <Info label="Member Since" value={organization.member_since} />
                  <Info label="Position" value={organization.org_position} />
                </div>
              </Section>
            )
          )}

          {/* Certification */}
          <Section title="Certification">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Info
                label="Name of Applicant"
                value={`${fisherfolk.salutations ? fisherfolk.salutations + ' ' : ''}${fisherfolk.first_name} ${fisherfolk.middle_name ? fisherfolk.middle_name + ' ' : ''}${fisherfolk.last_name}`.trim()}
              />
              <Info
                label="Date of Registration"
                value={fisherfolk.date_added ? new Date(fisherfolk.date_added).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not provided'}
              />
            </div>
          </Section>

          {/* Signatories */}
          <Section title="Signatories">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="mt-12 border-t border-gray-900 pt-2 font-semibold">
                    {barangayVerifier 
                      ? `${barangayVerifier.first_name} ${barangayVerifier.middle_name ? barangayVerifier.middle_name + ' ' : ''}${barangayVerifier.last_name}`.toUpperCase()
                      : 'NOT ASSIGNED'}
                  </div>
                  <div className="text-xs text-gray-600">Barangay Captain</div>
                </div>
                <div className="text-center">
                  <div className="mt-12 border-t border-gray-900 pt-2 font-semibold">
                    {signatories.municipal 
                      ? `${signatories.municipal.first_name} ${signatories.municipal.middle_name ? signatories.municipal.middle_name + ' ' : ''}${signatories.municipal.last_name}`.toUpperCase()
                      : 'NOT ASSIGNED'}
                  </div>
                  <div className="text-xs text-gray-600">Municipal Agriculturist</div>
                </div>
                <div className="text-center">
                  <div className="mt-12 border-t border-gray-900 pt-2 font-semibold">
                    {signatories.mayor 
                      ? `${signatories.mayor.first_name} ${signatories.mayor.middle_name ? signatories.mayor.middle_name + ' ' : ''}${signatories.mayor.last_name}`.toUpperCase()
                      : 'NOT ASSIGNED'}
                  </div>
                  <div className="text-xs text-gray-600">Mayor</div>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {isStatusModalOpen && (
          <>
            <div className="fixed inset-0 z-40 top-20 bottom-12 left-79 bg-white/30 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full pointer-events-auto">
                <h2 className="text-lg font-semibold mb-2">
                  {fisherfolk?.is_active ? "Deactivate Fisherfolk" : "Activate Fisherfolk"}
                </h2>
                <p className="mb-4">
                  {`Are you sure you want to ${
                    fisherfolk?.is_active ? "deactivate" : "activate"
                  } ${fisherfolk?.first_name} ${fisherfolk?.last_name}?`}
                </p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setIsStatusModalOpen(false)} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                  <button onClick={handleUpdateStatus} className={`px-4 py-2 rounded text-white ${fisherfolk?.is_active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}>
                    {fisherfolk?.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      <SuccessModal
        isOpen={successOpen}
        title="Success"
        message={successMsg}
        onClose={() => {
          setSuccessOpen(false);
          navigate("/admin/fisherfolk");
        }}
      />

      <AnimatePresence>
        {isEditModalOpen && (
          <>
            <div className="fixed inset-0 z-40 top-20 bottom-12 left-79 bg-white/30 backdrop-blur-sm" />
            <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full pointer-events-auto">
                <h2 className="text-lg font-semibold mb-2">Edit Fisherfolk</h2>
                <p className="mb-4">
                  {`Edit ${fisherfolk?.first_name} ${fisherfolk?.last_name}'s info?`}
                </p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                  <button onClick={handleEditConfirm} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Continue</button>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FisherfolkProfile;
