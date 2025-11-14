import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { apiClient } from "../../services/api_urls";

// Normalize municipality names for comparison (treat aliases equally, case-insensitive)
const normalizeMunicipality = (name) => {
  const raw = (name || "").toString().trim();
  const s = raw.toLowerCase();
  if (!s) return raw;
  const map = new Map([
    ["san fernando", "City of San Fernando"],
    ["city of san fernando", "City of San Fernando"],
    ["sto. tomas", "Santo Tomas"],
    ["santo tomas", "Santo Tomas"],
  ]);
  return map.get(s) || raw;
};
const muniInList = (name, list) => {
  const n = normalizeMunicipality(name);
  return list.some((m) => normalizeMunicipality(m) === n);
};

const FisherfolkSearchForm = ({ onSelectFisherfolk, selectedFisherfolkId }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [fisherfolks, setFisherfolks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [addressMap, setAddressMap] = useState({}); // registration_number -> address object

  const fetchFisherfolks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(
        `/fisherfolk/search/?query=${searchTerm}`
      );
      
      // Define coastal municipalities (with aliases)
      const coastalMunicipalities = [
        "Agoo", "Aringay", "Bacnotan", "Balaoan", "Bangar",
        "Bauang", "Caba", "Luna", "Rosario", "City of San Fernando", "San Fernando",
        "San Juan", "Santo Tomas", "Sudipen"
      ];

      // First, fetch addresses for all fisherfolk
      if (Array.isArray(response.data)) {
        const addressPromises = response.data.map(async (fisherfolk) => {
          if (fisherfolk.registration_number) {
            try {
              const res = await apiClient.get(
                `/addresses/?fisherfolk=${fisherfolk.registration_number}`
              );
              if (Array.isArray(res.data) && res.data.length > 0) {
                return { reg: fisherfolk.registration_number, address: { ...res.data[0] } };
              }
            } catch {
              // Ignore fetch errors for address
            }
          }
          return { reg: fisherfolk.registration_number, address: null };
        });
        const addressResults = await Promise.all(addressPromises);
        const newAddressMap = {};
        addressResults.forEach(({ reg, address }) => {
          if (reg && address) {
            newAddressMap[reg] = { ...address };
          }
        });
        setAddressMap(newAddressMap);

        // Now filter only fisherfolk from coastal municipalities
        // Check address municipality from the addressMap we just built
        const coastalFisherfolk = response.data.filter(f => {
          const addressMunicipality = newAddressMap[f.registration_number]?.municipality;
          const municipality = f.municipality || addressMunicipality;
          return muniInList(municipality, coastalMunicipalities);
        });
        setFisherfolks(coastalFisherfolk);
      }
    } catch (error) {
      console.error("Error searching fisherfolk:", error);
      setError("Failed to search fisherfolk. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm) {
        fetchFisherfolks();
      } else {
        setFisherfolks([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchFisherfolks]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectFisherfolk = (fisherfolk) => {
    const address = addressMap[fisherfolk.registration_number] || {};
    const barangayValue = address.barangay || fisherfolk.barangay;
    if (!barangayValue) {
      setError(
        "Cannot select this fisherfolk. Barangay information is missing. Please update the fisherfolk's information first."
      );
      return;
    }
    onSelectFisherfolk({
      ...fisherfolk,
      address,
      barangay: barangayValue,
      municipality: address.municipality || fisherfolk.municipality,
      fisherfolk_number: fisherfolk.id,
    });
  };

  // Filter fisherfolks to match only from the start of the fields
  const filteredFisherfolks = fisherfolks.filter((f) =>
    f.first_name?.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
    f.last_name?.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
    (f.registration_number || "").toLowerCase().startsWith(searchTerm.toLowerCase())
  );

  return (
    <div className="" style={{ fontFamily: "Montserrat, sans-serif" }} >
        <div>
          <input
            id="fisherfolk-search"
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search fisherfolk by ID, name, or registration number..."
            className="w-full p-2 border-2 border-blue-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4 text-gray-500 mt-5">Searching...</div>
        ) : filteredFisherfolks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 mt-5">
                <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    {/* Select column */}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fullname
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
                {filteredFisherfolks.map((fisherfolk) => {
                  const address = addressMap[fisherfolk.registration_number] || {};
                  const isSelected = selectedFisherfolkId === fisherfolk.registration_number;
                  return (
                    <tr
                      key={fisherfolk.id}
                      onClick={() => handleSelectFisherfolk(fisherfolk)}
                      onMouseEnter={() => setHoveredRow(fisherfolk.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className={`${
                        isSelected ? "bg-blue-50 border-l-4 border-blue-600" : hoveredRow === fisherfolk.id ? "bg-gray-50" : ""
                      } hover:bg-gray-50 transition-all duration-150 cursor-pointer`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
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
                        {`${fisherfolk.first_name} ${
                          fisherfolk.middle_name
                            ? fisherfolk.middle_name.charAt(0) + ". "
                            : ""
                        }${fisherfolk.last_name}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {address.barangay || "Not specified"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {address.municipality || fisherfolk.municipality || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            fisherfolk.is_active
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
        ) : searchTerm && !loading ? (
          <div className="text-center py-4 text-gray-500">
            No fisherfolk found
          </div>
        ) : null}
    </div>
  );
};

FisherfolkSearchForm.propTypes = {
  onSelectFisherfolk: PropTypes.func.isRequired,
  selectedFisherfolkId: PropTypes.string,
};

export default FisherfolkSearchForm;
