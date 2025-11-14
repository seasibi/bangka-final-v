// src/pages/admin/FisherfolkManagement.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageTitle from "../../components/PageTitle";
import Loader from "../../components/Loader";
import { apiClient } from "../../services/api_urls";
import { useAuth } from "../../contexts/AuthContext";

const municipalityPrefixes = {
  Agoo: "AGO",
  Aringay: "ARI",
  Bacnotan: "BAC",
  Bagulin: "BAG",
  Balaoan: "BAL",
  Bangar: "BNG",
  Bauang: "BAU",
  Burgos: "BRG",
  Caba: "CAB",
  "City Of San Fernando": "CSF",
  Luna: "LUN",
  Naguilian: "NAG",
  Pugo: "PUG",
  Rosario: "ROS",
  "San Gabriel": "SGB",
  "San Juan": "SJN",
  "Santo Tomas": "STO",
  Santol: "SNL",
  Sudipen: "SUD",
  Tubao: "TUB",
};

const PAFisherfolkManagement = () => {
  const navigate = useNavigate();
  const [fisherfolk, setFisherfolk] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(null);
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const pageOptions = [25, 52, 100];

  useEffect(() => {
    fetchFisherfolk();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize, fisherfolk.length]);

  const fetchFisherfolk = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get("/fisherfolk/");
      // response.data expected to be an array of fisherfolk objects;
      // these objects may already include nested related objects (address, contacts, etc.)
      setFisherfolk(response.data || []);

    } catch (error) {
      console.error("Error fetching fisherfolk:", error);
      setError("Failed to fetch fisherfolk data. Please try again.");
    } finally {
      setLoading(false);
    }
  };



  // helper: read nested address from a fisherfolk object (robust to multiple shapes)
const getAddressForFisherfolk = (person) => {
  if (!person) return null;

  // 1) prefer explicit address object
  if (person.address && typeof person.address === "object") return person.address;

  // 2) then addresses array
  if (Array.isArray(person.addresses) && person.addresses.length > 0) return person.addresses[0];

  // 3) some serializers put address fields flattened on the person object
  if (person.barangay || person.municipality || person.street) {
    return {
      street: person.street || "",
      barangay: person.barangay || "",
      municipality: person.municipality || "",
      province: person.province || "",
      region: person.region || "",
      residency_years: person.residency_years || "",
      barangay_verifier: person.barangay_verifier || "",
      position: person.position || "",
      verified_date: person.verified_date || "",
    };
  }

  // nothing available
  return null;
};

// helper: return correct prefixed registration number
const getPrefixedRegNumber = (person) => {
  if (!person) return "";

  const municipalityPrefixesLocal = municipalityPrefixes; // from top-level const

  const address = getAddressForFisherfolk(person);
  let municipality = (address?.municipality || person?.municipality || "").toString().trim();

  // normalize common variations (trim, collapse extra spaces)
  municipality = municipality.replace(/\s+/g, " ").trim();

  // find matching key case-insensitively
  const muniKey = Object.keys(municipalityPrefixesLocal).find(
    (k) => k.toLowerCase() === municipality.toLowerCase()
  );

  const prefix = muniKey ? municipalityPrefixesLocal[muniKey] : "XXX";

  // Registration number raw
  let reg = (person.registration_number || "").toString().trim();

  // If no reg number, return prefix + placeholder
  if (!reg) return `${prefix}-UNKNOWN`;

  // If reg already starts with a 3-letter prefix, extract it
  const match = reg.match(/^([A-Z]{3})-(.+)$/);
  if (match) {
    const existingPrefix = match[1];
    const rest = match[2];

    // If existing prefix is already the correct one => return as-is
    if (existingPrefix === prefix) {
      return reg;
    }

    // If existing prefix appears in our prefixes (reverse lookup), but is different,
    // replace it with the correct prefix.
    const knownPrefixes = new Set(Object.values(municipalityPrefixesLocal));
    if (knownPrefixes.has(existingPrefix)) {
      return `${prefix}-${rest}`;
    }

    // Existing prefix isn't a known prefix (could be malformed). Replace it anyway.
    return `${prefix}-${rest}`;
  }

  // If no existing prefix, just prepend the correct one
  return `${prefix}-${reg}`;
};

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex justify-center items-center h-64">
          <Loader />
        </div>
      </div>
    );
  }

  // filter + sort + paginate
  const filtered = fisherfolk.filter(p =>
    statusFilter === 'all' ? true : statusFilter === 'active' ? p.is_active : !p.is_active
  );
  const sorted = [...filtered]
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      if (!a.is_active && !b.is_active) {
        try {
          const map = JSON.parse(localStorage.getItem('ff_last_deactivated') || '{}');
          const ka = a.registration_number || a.id;
          const kb = b.registration_number || b.id;
          const ta = typeof map[ka] === 'number' ? map[ka] : Number(map[ka]) || 0;
          const tb = typeof map[kb] === 'number' ? map[kb] : Number(map[kb]) || 0;
          if (ta !== tb) return tb - ta;
        } catch {}
      }
      if (a.date_added && b.date_added) return new Date(b.date_added) - new Date(a.date_added);
      return (b.id || 0) - (a.id || 0);
    });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);

  return (
    <div className="h-full bg-gray-50 " style={{ fontFamily: "Montserrat, sans-serif" }}>
      <div className="h-full px-4 py-6" style={{ fontFamily: "Montserrat, sans-serif" }}>
        <div className="flex justify-between items-center mb-6">
          <PageTitle value="Fisherfolk Management" />
        </div>

        {error && <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}
        {success && <div className="mb-4 p-4 text-green-700 bg-green-100 rounded-lg">{success}</div>}

        <div className="bg-white rounded-lg shadow w-full font-montserrat p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Rows per page:</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm"
              >
                {pageOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className="text-sm text-gray-600">Total: {filtered.length}</div>
              <label className="ml-4 text-sm text-gray-700">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 border rounded disabled:opacity-50"
                disabled={currentPage <= 1}
              >
                Prev
              </button>
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }).slice(0, 10).map((_, idx) => (
                  <button
                    key={idx + 1}
                    onClick={() => setPage(idx + 1)}
                    className={`px-2 py-1 rounded ${currentPage === idx + 1 ? 'bg-blue-600 text-white' : 'border'}`}
                  >
                    {idx + 1}
                  </button>
                ))}
                {totalPages > 10 && <span className="px-2">...</span>}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 border rounded disabled:opacity-50"
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[60vh] rounded-b">
            <table className="w-full divide-y divide-gray-200">
              <thead className="sticky top-0 w-full">
              <tr style={{ backgroundColor: "#3863CF", fontFamily: "Montserrat, sans-serif" }}>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Registration Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Last Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">First Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">MI</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-4 text-center text-gray-500">No fisherfolk records found</td>
                </tr>
              ) : (
                paginated
                  .map((person, index) => (
                    <tr key={person.id || index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getPrefixedRegNumber(person)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.last_name || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.first_name || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{person.middle_name ? person.middle_name.charAt(0) : "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {person.is_active ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => navigate(`/admin/fisherfolk/profile/${person.registration_number}`)}
                          className="text-white bg-blue-700 py-1 px-3 hover:bg-blue-500 rounded-md"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PAFisherfolkManagement;
