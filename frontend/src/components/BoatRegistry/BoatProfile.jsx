import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Modal from "../../components/Modal";
import Loader from "../../components/Loader";
import Button from "../Button";
import axios from "axios";
import SuccessModal from "../../components/SuccessModal";
import { useAuth } from "../../contexts/AuthContext";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  assignTrackerToBoat,
  unassignTrackerFromBoat,
} from "../../services/trackerService";
import { archiveBoat } from "../../services/boatService";
import { jsPDF } from "jspdf";
import { getMunicipalities } from "../../services/municipalityService";
import { getSignatories } from "../../services/signatoriesService";
import logo from '../../assets/logo.png';

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:8000";

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

const formatNameWithMiddleInitial = (first, middle, last) => {
  const f = (first || '').trim();
  const l = (last || '').trim();
  const m = (middle || '').trim();
  const middleInitial = m ? m.charAt(0).toUpperCase() + '.' : '';
  return [f, middleInitial, l].filter(Boolean).join(' ');
};

const BoatProfile = ({ editBasePath = '/admin' }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const isProvincial = user?.user_role === "provincial_agriculturist";
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [boat, setBoat] = useState(null);
  const [measurements, setMeasurements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [trackers, setTrackers] = useState([]);
  const [selectedTracker, setSelectedTracker] = useState(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successTitle, setSuccessTitle] = useState("Success");
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [municipalities, setMunicipalities] = useState([]);
  const [signatories, setSignatories] = useState({ fisheryCoordinator: null, notedBy: null });

  // Normalize municipality names (case-insensitive + aliases)
  const normalizeMunicipality = (name) => {
    const raw = (name || '').toString().trim();
    const s = raw.toLowerCase();
    if (!s) return raw;
    const map = new Map([
      ['san fernando', 'City of San Fernando'],
      ['city of san fernando', 'City of San Fernando'],
      ['sto. tomas', 'Santo Tomas'],
      ['santo tomas', 'Santo Tomas'],
    ]);
    return map.get(s) || raw;
  };
  const muniEq = (a, b) => normalizeMunicipality(a) === normalizeMunicipality(b);

  const fetchTrackers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/birukbilug/`);
      const mun = boat?.fisherfolk?.address?.municipality || boat?.fisherfolk?.municipality || '';
      const available = (Array.isArray(res.data) ? res.data : res.data?.results || [])
        .filter(t => t.status === 'available' && (!mun || muniEq(t.municipality, mun)))
        .sort((a, b) => {
          // Sort by BirukBilugID in descending order (CSF-0027, CSF-0026, etc.)
          const idA = a.BirukBilugID || '';
          const idB = b.BirukBilugID || '';
          return idB.localeCompare(idA);
        });
      setTrackers(available);
    } catch (error) {
      console.error("Error fetching trackers:", error);
    }
  };

  useEffect(() => {
    const fetchBoat = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/boats/${id}/`);
        setBoat(response.data);
      } catch (error) {
        console.error("Error fetching boat:", error);
        setError("Failed to load boat data.");
      }
    };

    const fetchMeasurements = async () => {
      try {
        const response = await axios.get(
          `${API_BASE}/api/boat-measurements/?boat=${id}`
        );
        if (response.data.length > 0) setMeasurements(response.data[0]);
      } catch (error) {
        console.error("Error fetching measurements:", error);
      }
    };


    fetchBoat();
    fetchMeasurements();
    // preload municipalities for signatories lookup
    (async () => {
      try {
        const list = await getMunicipalities();
        setMunicipalities(Array.isArray(list) ? list : list?.results || []);
      } catch (e) {
        console.error("Failed to load municipalities", e);
      }
    })();
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const loadSignatories = async () => {
      try {
        if (!boat) return;
        const munName = boat?.fisherfolk?.address?.municipality || boat?.fisherfolk?.municipality || "";
        if (!munName) return;
        const mun = (municipalities || []).find(m => (m?.name || "").toString().toLowerCase() === munName.toString().toLowerCase());
        const params = mun?.id ? { municipality_id: mun.id } : {};
        const list = await getSignatories(params);
        const arr = Array.isArray(list) ? list : list?.results || [];
        const fisheryCoordinator = arr.find(s => s.position === "Municipal Fishery Coordinator") || null;
        const municipalAgriculturist = arr.find(s => s.position === "Municipal Agriculturist") || null;
        const provincialAgriculturist = arr.find(s => s.position === "Provincial Agriculturist") || null;
        const notedBy = municipalAgriculturist || provincialAgriculturist || null;
        setSignatories({ fisheryCoordinator, notedBy });
      } catch (e) {
        console.error("Failed to load signatories", e);
      }
    };
    loadSignatories();
  }, [boat, municipalities]);

  const generatePDF = () => {
    try {
      // Match Fisherfolk report layout
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
        try { doc.addImage(logo, 'PNG', margin, 20, logoWidth, logoHeight); } catch { }
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
        const copyLine = `© ${new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.`;
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
            // Label on its own line
            doc.setFont('helvetica', 'bold');
            doc.text(`${label}:`, x, y);
            // Value below
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
            // Label and value in one line
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
        const cols = Math.min(2, list.length || 2);
        const colWidth = (pageWidth - margin * 2) / cols;
        let col = 0;
        list.forEach((s, i) => {
          ensureSpace(60);
          const xCenter = margin + col * colWidth + colWidth / 2;
          // draw underline first
          const lineWidth = 140; // fixed width for consistent signature line
          doc.setDrawColor(0, 0, 0);
          doc.line(xCenter - lineWidth / 2, y, xCenter + lineWidth / 2, y);
          // name below line
          const name = (s.name || 'Not assigned').toUpperCase();
          doc.setFont('helvetica', 'bold');
          doc.text(name, xCenter, y + 14, { align: 'center' });
          // position below name
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
      addCenteredTitle('Boat Profile', 18);
      addDivider();

      // Account Information
      addSectionHeader('Account Information');
      addKVGrid([
        ['MFBR Number', boat?.mfbr_number],
        ['Status', boat?.is_active ? 'Active' : 'Inactive'],
        ['Type of Registration', boat?.type_of_registration],
        ['Type of Ownership', boat?.type_of_ownership],
      ], 3, true);
      addDivider();

      // Boat Information
      addSectionHeader('Boat Information');
      addKVGrid([
        ['Boat Name', boat?.boat_name],
        ['Boat Type', boat?.boat_type],
        ['Material Used', boat?.material_used],
        ['Built Place', boat?.built_place],
        ['Built Year', boat?.built_year],
        ['Engine Make', boat?.engine_make],
        ['Serial Number', boat?.serial_number],
        ['Horsepower', boat?.horsepower],
        ['Homeport', boat?.homeport],
        ['Fishing Ground', boat?.fishing_ground],
        ['FMA Number', boat?.fma_number],
        ['No. of Fishers', boat?.no_fishers],
        ['Application Date', boat?.application_date],
      ], 3, true);
      addDivider();

      // Measurements
      if (measurements) {
        addSectionHeader('Boat Measurements');
        addKVGrid([
          ['Registered Length (m)', measurements.registered_length],
          ['Registered Breadth (m)', measurements.registered_breadth],
          ['Registered Depth (m)', measurements.registered_depth],
          ['Tonnage Length', measurements.tonnage_length],
          ['Tonnage Breadth', measurements.tonnage_breadth],
          ['Tonnage Depth', measurements.tonnage_depth],
          ['Gross Tonnage', measurements.gross_tonnage],
          ['Net Tonnage', measurements.net_tonnage],
        ], 3, true);
        addDivider();
      }

      // Gear Assignments (summary)
      if (Array.isArray(boat?.gear_assignments) && boat.gear_assignments.length > 0) {
        addSectionHeader('Gear Assignments');

        const buildGearLines = (types = []) => {
          const lines = [];
          types.forEach((t) => {
            const typeName = t?.gear_type?.name
              ? t.gear_type.name.split(' ').slice(1).join(' ')
              : 'Unknown Type';
            lines.push(`• ${typeName}`);

            const subs = Array.isArray(t?.subtypes_data) ? t.subtypes_data : [];
            subs.forEach((sub) => {
              const subName = sub?.gear_subtype?.name || 'Unknown Subtype';
              const qty = sub?.is_present ? (sub?.quantity ?? '—') : 'Absent';
              const subLine = `   - ${subName}  ${sub?.is_present ? `(Qty: ${qty})` : '(Absent)'}`;
              lines.push(subLine);
            });

            if (subs.length > 0) {
              lines.push(''); // small gap between gear types
            }
          });
          if (lines[lines.length - 1] === '') lines.pop();
          return lines;
        };

        const drawGearColumns = (marine = [], inland = []) => {
          // Estimate height needed so we don't split the columns across pages
          const estimateLines = (types = []) => {
            let count = 0;
            types.forEach((t) => {
              count += 1; // bullet line
              const subs = Array.isArray(t?.subtypes_data) ? t.subtypes_data : [];
              count += subs.length; // one line per subtype
            });
            return Math.max(1, count);
          };

          const marineLinesCount = estimateLines(marine);
          const inlandLinesCount = estimateLines(inland);
          const maxLines = Math.max(marineLinesCount, inlandLinesCount) + 2; // include titles
          const neededHeight = maxLines * 14 + 24;
          ensureSpace(neededHeight);

          const colWidth = (pageWidth - margin * 2) / 2;
          const xMarine = margin;
          const xInland = margin + colWidth;
          const startY = y;

          // Marine column
          doc.setFont('helvetica', 'bold');
          doc.text('Marine Gear Types', xMarine, startY);
          doc.setFont('helvetica', 'normal');
          const marineLines = buildGearLines(marine);
          let marineBottom = startY;
          if (marineLines.length > 0) {
            const wrappedMarine = doc.splitTextToSize(marineLines, colWidth - 12);
            doc.text(wrappedMarine, xMarine, startY + 16);
            marineBottom = startY + 16 + 14 * Math.max(1, wrappedMarine.length);
          } else {
            marineBottom = startY + 18;
          }

          // Inland column
          doc.setFont('helvetica', 'bold');
          doc.text('Inland Gear Types', xInland, startY);
          doc.setFont('helvetica', 'normal');
          const inlandLines = buildGearLines(inland);
          let inlandBottom = startY;
          if (inlandLines.length > 0) {
            const wrappedInland = doc.splitTextToSize(inlandLines, colWidth - 12);
            doc.text(wrappedInland, xInland, startY + 16);
            inlandBottom = startY + 16 + 14 * Math.max(1, wrappedInland.length);
          } else {
            inlandBottom = startY + 18;
          }

          y = Math.max(marineBottom, inlandBottom) + 10;
        };

        boat.gear_assignments.forEach((ga, idx) => {
          const marine = (ga.types_data || []).filter((t) => t?.gear_type?.classification === 1);
          const inland = (ga.types_data || []).filter((t) => t?.gear_type?.classification === 2);
          drawGearColumns(marine, inland);
          if (idx < boat.gear_assignments.length - 1) addDivider();
        });
        addDivider();
      }

      // Certification
      addSectionHeader('Certification');

      // Pre-text paragraph (Boat profile wording)
      const boatCertText =
        'I hereby certify that all information contained herein is true and correct.';
      ensureSpace(80);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const boatCertLines = doc.splitTextToSize(boatCertText, pageWidth - margin * 2);
      doc.text(boatCertLines, margin, y);
      const boatCertHeight = 14 * Math.max(1, boatCertLines.length);
      y += boatCertHeight + 10;

      const applicantName = boat?.fisherfolk
        ? `${boat.fisherfolk.salutations ? boat.fisherfolk.salutations + ' ' : ''}${boat.fisherfolk.first_name || ''} ${boat.fisherfolk.middle_name ? boat.fisherfolk.middle_name + ' ' : ''}${boat.fisherfolk.last_name || ''}`.trim()
        : (boat?.owner_name || '');
      addKVGrid([
        ['Name of Applicant', applicantName],
        ['Date of Application', boat?.application_date
          ? new Date(boat.application_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : new Date().toLocaleDateString(),
        ],
      ], 2, true);
      addDivider();

      // Signatories (Enumerator, Noted by)
      addSectionHeader('Signatories');
      const enumName = signatories.fisheryCoordinator
        ? formatNameWithMiddleInitial(
          signatories.fisheryCoordinator.first_name,
          signatories.fisheryCoordinator.middle_name,
          signatories.fisheryCoordinator.last_name
        )
        : 'Not assigned';
      const notedByName = signatories.notedBy
        ? formatNameWithMiddleInitial(
          signatories.notedBy.first_name,
          signatories.notedBy.middle_name,
          signatories.notedBy.last_name
        )
        : 'Not assigned';
      const notedPos = signatories.notedBy?.position === 'Provincial Agriculturist' ? 'Provincial Agriculturist' : 'Municipal Agriculturist';
      addSignatoriesGrid([
        { name: enumName, position: 'Municipal Fishery Coordinator' },
        { name: notedByName, position: notedPos },
      ]);

      // Footer on last page
      drawFooter();

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) {
        w.onload = () => { w.focus(); w.print(); };
      }
    } catch (e) {
      console.error('Failed to generate PDF', e);
    }
  };

  const handleEditConfirm = () => {
    navigate(`${editBasePath}/boat-registry/edit/${boat.mfbr_number}`);
  };

  if (loading || !boat) return <Loader />;

  const formatDate = (s) => {
    if (!s) return "Not provided";
    try {
      return new Date(s).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return s;
    }
  };


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
            View Boat Profile
          </h1>
          <p className="text-base text-gray-700">
            View and manage boat profile details.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-6">
            <img
              src={
                boat.boat_image
                  ? boat.boat_image.startsWith("http")
                    ? boat.boat_image
                    : `${API_BASE}${boat.boat_image}`
                  : "/placeholder-boat.png"
              }
              alt="Boat"
              className="w-32 h-32 rounded-full object-cover shadow-md"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-boat.png";
              }}
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {boat.boat_name}
              </h2>
              <p className="text-sm text-gray-500">
                MFBR No: {boat.mfbr_number}
              </p>
              <span
                className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded-full ${boat.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
              >
                {boat.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="flex space-x-2">
            {!isProvincial && (
              <Button onClick={() => setIsEditModalOpen(true)}>Edit</Button>
            )}

            <Button
              onClick={generatePDF}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 9V4h10v5m-9 7h8v4H8v-4Zm-3-6h14a2 2 0 0 1 2 2v5H3v-5a2 2 0 0 1 2-2Z"
                />
              </svg>
              <span>Print Report</span>
            </Button>

            {!isProvincial && boat.is_active && (
              <Button
                onClick={() => setIsDeactivateModalOpen(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                Deactivate
              </Button>
            )}

            {!isProvincial && (
              boat.tracker ? (
                // If tracker already assigned
                <Button
                  onClick={() => setIsTrackerModalOpen(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Unassign Tracker
                </Button>
              ) : (
                // If no tracker assigned
                <Button
                  onClick={() => {
                    fetchTrackers();
                    setIsTrackerModalOpen(true);
                  }}
                >
                  Assign Tracker
                </Button>
              )
            )}
          </div>
        </div>
        <Section title="Tracker Assignment">
          {boat.tracker ? (
            <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-800">Tracker ID</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {boat.tracker.BirukBilugID}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Municipality</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {boat.tracker.municipality}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Status</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {boat.tracker.status || 'assigned'}
                    </span>
                  </p>
                </div>
                {boat.tracker.date_added && (
                  <div>
                    <p className="text-sm font-medium text-blue-800">Date Added</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {new Date(boat.tracker.date_added).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-500 text-center">No tracker assigned to this boat.</p>
            </div>
          )}
        </Section>
        {/* Account Information */}
        <Section title="Account Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Info label="MFBR Number" value={boat.mfbr_number} />
            <Info
              label="Status"
              value={boat.is_active ? "Active" : "Inactive"}
            />
            <Info
              label="Type of Registration"
              value={boat.type_of_registration}
            />
            <Info label="Type of Ownership" value={boat.type_of_ownership} />
          </div>
        </Section>

        {/* Profile Information */}
        <Section title="Boat Information">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Info label="Boat Name" value={boat.boat_name} />
            <Info label="Boat Type" value={boat.boat_type} />
            <Info label="Material Used" value={boat.material_used} />
            <Info label="Built Place" value={boat.built_place} />
            <Info label="Built Year" value={boat.built_year} />
            <Info label="Engine Make" value={boat.engine_make} />
            <Info label="Serial Number" value={boat.serial_number} />
            <Info label="Horsepower" value={boat.horsepower} />
            <Info label="Homeport" value={boat.homeport} />
            <Info label="Fishing Ground" value={boat.fishing_ground} />
            <Info label="FMA Number" value={boat.fma_number} />
            <Info label="No. of Fishers" value={boat.no_fishers} />
            <Info label="Application Date" value={boat.application_date} />
          </div>
        </Section>

        {/* Measurements Section */}
        {measurements && (
          <Section title="Boat Measurements">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Info
                label="Registered Length"
                value={measurements.registered_length}
              />
              <Info
                label="Registered Breadth"
                value={measurements.registered_breadth}
              />
              <Info
                label="Registered Depth"
                value={measurements.registered_depth}
              />
              <Info
                label="Tonnage Length"
                value={measurements.tonnage_length}
              />
              <Info
                label="Tonnage Breadth"
                value={measurements.tonnage_breadth}
              />
              <Info label="Tonnage Depth" value={measurements.tonnage_depth} />
              <Info label="Gross Tonnage" value={measurements.gross_tonnage} />
              <Info label="Net Tonnage" value={measurements.net_tonnage} />
            </div>
          </Section>
        )}

        {/* Gear Assignment Section */}
        {/* Gear Assignment Section */}
        <Section title="Gear Assignment">
          {boat.gear_assignments && boat.gear_assignments.length > 0 ? (
            boat.gear_assignments.map((assignment) => {
              // Split types into marine vs inland
              const marineTypes =
                assignment.types_data?.filter(
                  (t) => t.gear_type?.classification === 1
                ) || [];
              const inlandTypes =
                assignment.types_data?.filter(
                  (t) => t.gear_type?.classification === 2
                ) || [];

              const renderTypeList = (types) => (
                <ul className="space-y-3">
                  {types.map((type) => (
                    <li key={type.id} className="border-b border-gray-200 pb-2">
                      <div className="font-medium text-gray-800">
                        {type.gear_type?.name
                          ? type.gear_type?.name.split(" ").slice(1).join(" ")
                          : "Unknown Type"}
                      </div>

                      {/* Subtypes */}
                      {type.subtypes_data?.length > 0 && (
                        <ul className="mt-2 ml-4 space-y-2">
                          {type.subtypes_data.map((sub) => (
                            <li
                              key={sub.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-gray-700">
                                {sub.gear_subtype?.name
                                  ? sub.gear_subtype.name
                                    .split(" ")
                                    .slice(1)
                                    .join(" ")
                                  : "Unknown Subtype"}{" "}
                              </span>
                              {sub.is_present ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                                  Qty: {sub.quantity ?? "—"}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 text-xs font-medium">
                                  Absent
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              );

              return (
                <div key={assignment.id} className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Marine Column */}
                    <div>
                      <h4 className="text-lg font-semibold text-blue-700 border-b border-blue-200 pb-1 mb-3">
                        Marine Gear Types
                      </h4>
                      {marineTypes.length > 0 ? (
                        renderTypeList(marineTypes)
                      ) : (
                        <p className="text-gray-500">
                          No marine gear types registered.
                        </p>
                      )}
                    </div>

                    {/* Inland Column */}
                    <div>
                      <h4 className="text-lg font-semibold text-blue-700 border-b border-green-200 pb-1 mb-3">
                        Inland Gear Types
                      </h4>
                      {inlandTypes.length > 0 ? (
                        renderTypeList(inlandTypes)
                      ) : (
                        <p className="text-gray-500">
                          No inland gear types registered.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-gray-500">No gear assignments found.</p>
          )}
        </Section>

        {/* Certification */}
        <h2 className="text-xl font-medium text-blue-800 mb-3 bg-blue-100 rounded px-3 py-2 mt-6">
          Certification
        </h2>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
          <p className="text-gray-700 mb-4 italic">
            I hereby certify that all information contained herein is true and correct.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name of Applicant</label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={boat?.fisherfolk
                    ? formatNameWithMiddleInitial(
                        boat.fisherfolk.first_name,
                        boat.fisherfolk.middle_name,
                        boat.fisherfolk.last_name
                      ) || 'Not specified'
                    : boat?.owner_name || 'Not specified'}
                  readOnly
                  className="relative w-full cursor-default rounded-lg bg-gray-100 py-3 pl-3 pr-10 text-left border border-gray-300 focus:outline-none text-gray-900 italic"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Automatic name from fisherfolk data
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date of Application</label>
                            <div className="relative mt-1">
                <input
                  type="text"
                  value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
        <Section title="Signatories">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="mt-12 border-t border-gray-900 pt-2 font-semibold">
                  {signatories.fisheryCoordinator
                    ? formatNameWithMiddleInitial(
                      signatories.fisheryCoordinator.first_name,
                      signatories.fisheryCoordinator.middle_name,
                      signatories.fisheryCoordinator.last_name
                    ).toUpperCase()
                    : 'NOT ASSIGNED'}
                </div>
                <div className="text-xs text-gray-600">Municipal Fishery Coordinator</div>
              </div>
              <div className="text-center">
                <div className="mt-12 border-t border-gray-900 pt-2 font-semibold">
                  {signatories.notedBy
                    ? formatNameWithMiddleInitial(
                      signatories.notedBy.first_name,
                      signatories.notedBy.middle_name,
                      signatories.notedBy.last_name
                    ).toUpperCase()
                    : 'NOT ASSIGNED'}
                </div>
                <div className="text-xs text-gray-600">
                  {signatories.notedBy?.position === 'Provincial Agriculturist' ? 'Provincial Agriculturist' : 'Municipal Agriculturist'}
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Modals */}

      {/* Deactivate Modal */}
      <AnimatePresence>
        {isDeactivateModalOpen && (
          <>
            <Motion.div
              className="fixed inset-0 z-40 top-20 bottom-12 left-79 bg-white/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <Motion.div
              className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none"
              initial={{ y: -50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full pointer-events-auto">
                <h2 className="text-lg font-semibold mb-2">Deactivate Boat</h2>
                <p className="mb-4">{`Are you sure you want to deactivate ${boat.boat_name}? This only deactivates the boat under the current owner.`}</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsDeactivateModalOpen(false)}
                    className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await archiveBoat(id);
                        setSuccessTitle("Boat Deactivated");
                        setSuccessMessage("✅ The boat has been successfully deactivated.");
                        setIsSuccessModalOpen(true);
                        setIsDeactivateModalOpen(false);
                        const response = await axios.get(`${API_BASE}/api/boats/${id}/`);
                        setBoat(response.data);
                      } catch (err) {
                        console.error("Error deactivating boat:", err);
                        setSuccessTitle("Error");
                        setSuccessMessage("❌ Failed to deactivate boat.");
                        setIsSuccessModalOpen(true);
                      }
                    }}
                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            </Motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <>
            {/* Overlay */}
            <Motion.div
              className="fixed inset-0 z-40 top-20 bottom-12 left-79 bg-white/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Modal Content */}
            <Motion.div
              className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none"
              initial={{ y: -50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full pointer-events-auto">
                <h2 className="text-lg font-semibold mb-2">{`Edit ${boat.boat_name}`}</h2>
                <p className="mb-4">{`Edit ${boat.boat_name}'s info?`}</p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditConfirm}
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </Motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Tracker Modal */}
      <AnimatePresence>
        {isTrackerModalOpen && (
          <>
            {/* Overlay */}
            <Motion.div
              className="fixed inset-0 z-40 top-20 bottom-12 left-79 bg-white/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Modal Content */}
            <Motion.div
              className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none"
              initial={{ y: -50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full pointer-events-auto">
                <h2 className="text-lg font-semibold mb-2">
                  {boat.tracker ? "Unassign Tracker" : "Assign Tracker"}
                </h2>
                <p className="mb-4">
                  {boat.tracker
                    ? "Are you sure you want to unassign this tracker?"
                    : "Select a tracker to assign to this boat."}
                </p>

                {!boat.tracker && (
                  <div className="mb-4 mt-2">
                    <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-md">
                      {trackers.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No available trackers found for this municipality.
                        </div>
                      ) : (
                        trackers.map((tracker, index) => {
                          const isNewest = index === 0;
                          const isSelected = selectedTracker === tracker.BirukBilugID;
                          const dateAdded = tracker.date_added
                            ? new Date(tracker.date_added).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                            : 'N/A';

                          return (
                            <div
                              key={tracker.BirukBilugID}
                              onClick={() => setSelectedTracker(tracker.BirukBilugID)}
                              className={`p-3 border-b border-gray-200 cursor-pointer transition-all duration-200 ${isSelected
                                  ? 'bg-blue-100 border-l-4 border-l-blue-600'
                                  : isNewest
                                    ? 'bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500'
                                    : 'hover:bg-gray-50'
                                }`}
                              title={isNewest ? 'Latest tracker added' : ''}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-900">
                                      Tracker ID: {tracker.BirukBilugID}
                                    </span>
                                    {isNewest && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">
                                        ✨ Latest
                                      </span>
                                    )}
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {tracker.status}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    📍 {tracker.municipality}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    🕒 Added: {dateAdded}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="ml-2">
                                    <svg
                                      className="w-5 h-5 text-blue-600"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {selectedTracker && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm font-medium text-blue-900">
                          Selected: Tracker {selectedTracker}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsTrackerModalOpen(false)}
                    className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (boat.tracker) {
                          await unassignTrackerFromBoat(boat.tracker.BirukBilugID);
                          setSuccessTitle("Tracker Unassigned");
                          setSuccessMessage(
                            "✅ The tracker has been successfully unassigned."
                          );
                        } else {
                          if (!selectedTracker) return;
                          await assignTrackerToBoat(boat.mfbr_number, selectedTracker);
                          setSuccessTitle("Tracker Assigned");
                          setSuccessMessage(
                            "✅ The tracker has been successfully assigned."
                          );
                        }
                        setIsSuccessModalOpen(true);
                        setIsTrackerModalOpen(false);

                        const response = await axios.get(`${API_BASE}/api/boats/${id}/`);
                        setBoat(response.data);
                      } catch (error) {
                        console.error("Error assigning/unassigning tracker:", error);
                        setSuccessTitle("Error");
                        setSuccessMessage("❌ Failed to update tracker assignment.");
                        setIsSuccessModalOpen(true);
                      }
                    }}
                    className={`px-4 py-2 rounded ${boat.tracker ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                      } text-white`}
                  >
                    {boat.tracker ? "Unassign" : "Assign"}
                  </button>
                </div>
              </div>
            </Motion.div>
          </>
        )}
      </AnimatePresence>

      <SuccessModal
        isOpen={isSuccessModalOpen}
        title={successTitle}
        message={successMessage}
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </div >
  );
};

export default BoatProfile;
