import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { GEAR_MAP } from '../../../constants/gearMap';
import { getSignatories } from '../../../services/signatoriesService';

// Remove common prefixes from display names for cleaner section titles
const stripDomain = (name = '') => name.replace(/^(Marine|Inland)\s+/i, '').trim();

// Optional: simplify subtype prefixes (e.g., "MMG Spear Gun" -> "Spear Gun")
const cleanSubtype = (name = '') => name.replace(/^(SN|FN|FAD|SNT|SCN|MMG|LN|CN|MTP|GN|HL|GL|SL|ITP|FG|ISCN|IMG)\s+/i, '').trim();

const buildGearGroups = (formData) => {
  const typeKeys = Object.keys(GEAR_MAP).filter((k) => GEAR_MAP[k].kind === 'type');
  const subKeys = Object.keys(GEAR_MAP).filter((k) => GEAR_MAP[k].kind === 'subtype');
  // Sort type keys so the longest prefix matches first (avoids partial matches)
  const sortedTypes = [...typeKeys].sort((a, b) => b.length - a.length);

  const groups = { marine: [], inland: [] };
  const groupMap = {};

  // Create a group for each checked gear type
  sortedTypes.forEach((typeKey) => {
    if (!formData?.[typeKey]) return;
    const domain = typeKey.startsWith('marine_') ? 'marine' : 'inland';
    const group = {
      key: typeKey,
      label: stripDomain(GEAR_MAP[typeKey]?.name || typeKey),
      items: [],
    };
    groups[domain].push(group);
    groupMap[typeKey] = group;
  });

  // Add checked subtypes with their quantities to the proper group
  subKeys.forEach((subKey) => {
    if (!formData?.[subKey]) return; // only if checkbox is selected
    const parentType = sortedTypes.find((tk) => subKey.startsWith(tk + '_'));
    if (!parentType) return;

    const group = groupMap[parentType];
    if (!group) return; // skip if parent type wasn't selected

    const qty = formData?.[`${subKey}_no`];
    group.items.push({
      key: subKey,
      label: cleanSubtype(GEAR_MAP[subKey]?.name || subKey),
      qty: qty || 1,
    });
  });

  // Only keep groups that have at least one selected subtype
  groups.marine = groups.marine.filter((g) => g.items.length > 0);
  groups.inland = groups.inland.filter((g) => g.items.length > 0);
  return groups;
};

const ConfirmDetails = ({ formData }) => {
  const [signatories, setSignatories] = useState({
    fisheryCoordinator: null,
    notedBy: null
  });
  const [loading, setLoading] = useState(true);

  // Fetch signatories based on municipality
  useEffect(() => {
    const fetchSignatories = async () => {
      if (!formData?.municipality) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const allSignatories = await getSignatories({ municipality: formData.municipality });
        
        // Find Municipal Fishery Coordinator (for Enumerator)
        const fisheryCoordinator = allSignatories.find(
          sig => sig.position === 'Municipal Fishery Coordinator' && 
                 sig.municipality.name === formData.municipality
        );
        
        // Find Noted By (Priority: Municipal Agriculturist > Provincial Agriculturist)
        const municipalAgriculturist = allSignatories.find(
          sig => sig.position === 'Municipal Agriculturist' && 
                 sig.municipality.name === formData.municipality
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
        setLoading(false);
      }
    };

    fetchSignatories();
  }, [formData?.municipality]);

  const renderSection = (title, fields) => (
    <div className="mb-8">
      <h4 className="text-xl font-semibold text-blue-800 mb-4">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-700">
        {fields.map(([label, value]) => (
          <div key={label}>
            <span className="font-semibold">{label}:</span> {value}
          </div>
        ))}
      </div>
    </div>
  );

  const gear = buildGearGroups(formData || {});

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-2xl font-semibold text-gray-900 mb-6 border-b pb-3">
        Confirm Details
      </h3>
      {renderSection('Fisherfolk Information', [
        ['Fisherfolk Number', formData.fisherfolk_number],
        ['Name', formData.fisherfolk_name],
        ['Municipality', formData.municipality],
      ])}
      {renderSection('Registration Details', [
        ['Type of Ownership', formData.type_of_ownership],
        ['Number of Fishers', formData.no_of_fishers],
        ['Homeport', formData.homeport],
      ])}
      {renderSection('Boat Profile', [
        ['Boat Name', formData.boat_name ? formData.boat_name : 'Unnamed'],
        ['Boat Type', formData.boat_type],
        ['Place Built', formData.built_place],
        ['Year Built', formData.built_year],
        ['Material Used', formData.material_used],
      ])}
      <div className="mb-8">
        <h4 className="text-xl font-semibold text-blue-800 mb-4">Boat Dimensions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-700">
          <div>
            <span className="font-semibold">Registered Length:</span> {formData.registered_length} meters
          </div>
          <div>
            <span className="font-semibold">Registered Breadth:</span> {formData.registered_breadth} meters
          </div>
          <div>
            <span className="font-semibold">Registered Depth:</span> {formData.registered_depth} meters
          </div>
          <div>
            <span className="font-semibold">Boat Image:</span> {formData.boat_image ? (
              <img
                src={
                  typeof formData.boat_image === 'string'
                    ? formData.boat_image
                    : URL.createObjectURL(formData.boat_image)
                }
                alt="Boat Preview"
                className="w-48 h-32 object-cover rounded border border-gray-200 mt-2"
              />
            ) : (
              <span className="text-gray-400">No image uploaded</span>
            )}
          </div>
        </div>
      </div>

      {/* Gear summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-lg font-semibold text-blue-800 mb-3">Marine Gear Types</h4>
          {gear.marine.length === 0 ? (
            <div className="text-gray-500 text-sm">None selected</div>
          ) : (
            gear.marine.map((group) => (
              <div key={group.key} className="mb-4">
                <div className="text-gray-900 font-medium">{group.label}</div>
                <ul className="mt-1 ml-4 space-y-1">
                  {group.items.map((it) => (
                    <li key={it.key} className="flex items-center justify-between text-sm text-gray-700">
                      <span>{it.label}</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">Qty: {it.qty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-lg font-semibold text-green-800 mb-3">Inland Gear Types</h4>
          {gear.inland.length === 0 ? (
            <div className="text-gray-500 text-sm">None selected</div>
          ) : (
            gear.inland.map((group) => (
              <div key={group.key} className="mb-4">
                <div className="text-gray-900 font-medium">{group.label}</div>
                <ul className="mt-1 ml-4 space-y-1">
                  {group.items.map((it) => (
                    <li key={it.key} className="flex items-center justify-between text-sm text-gray-700">
                      <span>{it.label}</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">Qty: {it.qty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Certification Section */}
      <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
        <h4 className="text-xl font-semibold text-blue-900 mb-4">Certification</h4>
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
      </div>

      {/* Signatories Section */}
      <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
        <h4 className="text-xl font-semibold text-green-900 mb-4">Signatories</h4>
        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-600">Loading signatories...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
              <span className="block text-sm text-gray-600 mb-2">Enumerator:</span>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                Municipal Fishery Coordinator
              </p>
              <p className="text-base font-medium text-green-700">
                {signatories.fisheryCoordinator
                  ? `${signatories.fisheryCoordinator.first_name} ${signatories.fisheryCoordinator.middle_name ? signatories.fisheryCoordinator.middle_name + ' ' : ''}${signatories.fisheryCoordinator.last_name}`
                  : 'Not assigned'}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
              <span className="block text-sm text-gray-600 mb-2">Noted by:</span>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                {signatories.notedBy?.position === 'Provincial Agriculturist'
                  ? 'Provincial Agriculturist'
                  : 'Municipal Agriculturist'}
              </p>
              <p className="text-base font-medium text-green-700">
                {signatories.notedBy
                  ? `${signatories.notedBy.first_name} ${signatories.notedBy.middle_name ? signatories.notedBy.middle_name + ' ' : ''}${signatories.notedBy.last_name}`
                  : 'Not assigned'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

ConfirmDetails.propTypes = {
  formData: PropTypes.object.isRequired,
};

export default ConfirmDetails;
