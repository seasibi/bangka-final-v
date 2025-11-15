import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Modal from "../../components/Modal";

const BoatList = ({ boats, onEdit, controls, profileBasePath = '/admin' }) => {
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const navigate = useNavigate();

  const _handleEditClick = (boatRegistryNo) => {
    setSelectedRegistration(boatRegistryNo);
    setIsEditModalOpen(true);
  };

  const handleEditConfirm = () => {
    if (!selectedRegistration) return;
    setIsEditModalOpen(false);
    onEdit(selectedRegistration.boat_registry_no);
  };

  console.log("BoatList component rendered with boats:", boats);
  return (
<div className="bg-white rounded-lg shadow w-full font-montserrat">
  {controls && (
    <div className="flex items-center justify-between mb-4 px-4 pt-4">
      {controls}
    </div>
  )}
  <div className="overflow-y-auto h-[50vh] sm:h-[60vh] md:h-[65vh] lg:h-[70vh] xl:h-[70vh] 2xl:h-[72vh] w-full">
      <table className="w-full divide-y divide-gray-200">
        <thead className="sticky top-0 w-full">
          <tr
            style={{
              backgroundColor: "#3863CF",
              fontFamily: "Montserrat, sans-serif",
            }}
          >
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Boat Registry Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Boat Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Tracker
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Fisherfolk Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {[...boats]
            .sort((a, b) => {
              // Active boats first
              if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;

              // Within inactive, most recently deactivated fisherfolk first
              if (!a.is_active && !b.is_active) {
                try {
                  const map = JSON.parse(localStorage.getItem('ff_last_deactivated') || '{}');
                  const ka = a.fisherfolk?.registration_number || a.fisherfolk?.id;
                  const kb = b.fisherfolk?.registration_number || b.fisherfolk?.id;
                  const ta = typeof map[ka] === 'number' ? map[ka] : Number(map[ka]) || 0;
                  const tb = typeof map[kb] === 'number' ? map[kb] : Number(map[kb]) || 0;
                  if (ta !== tb) return tb - ta;
                } catch {}
              }

              // Fallback by date_added desc
              return new Date(b.date_added) - new Date(a.date_added);
            })
            .map((boat, index) => {
              const fisherfolkActive = boat.fisherfolk?.is_active ?? true;
              return (
                <tr
                  key={boat.mfbr_number}
                  className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {boat.mfbr_number}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        boat.boat_type === "Motorized"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {boat.boat_type}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {boat.tracker ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                        Tracker {boat.tracker.BirukBilugID}
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs">
                        No tracker assigned
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {boat.fisherfolk ? (
                      <span>
                        {boat.fisherfolk.first_name} {boat.fisherfolk.last_name}{" "}
                        {!fisherfolkActive && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            Inactive Fisherfolk
                          </span>
                        )}
                      </span>
                    ) : (
                      "N/A"
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        boat.is_active === true
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {boat.is_active === true ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm flex gap-2">
                    {fisherfolkActive ? (
                      <button
                        onClick={() =>
                          navigate(
                             `${profileBasePath}/boat-registry/profile/${boat.mfbr_number}`
                          )
                        }
                        className="text-white bg-blue-700 py-1 px-3 hover:bg-blue-500 rounded-md"
                      >
                        View Boat Profile
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      {boats.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          No boats registered yet.
        </div>
      )}

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onConfirm={handleEditConfirm}
        title="Edit Boat"
        message={`Are you sure you want to edit ${selectedRegistration?.boat.boat_name}'s information?`}
        confirmText="Continue"
        cancelText="Cancel"
      />
    </div>
  </div>
  );
};

BoatList.propTypes = {
  boats: PropTypes.arrayOf(
    PropTypes.shape({
      boat_id: PropTypes.number.isRequired,
      boat_name: PropTypes.string.isRequired,
      boat_type: PropTypes.string.isRequired,
      built_place: PropTypes.string.isRequired,
      material_used: PropTypes.string.isRequired,
    })
  ).isRequired,
  onEdit: PropTypes.func.isRequired,
  controls: PropTypes.node,
};

export default BoatList;
