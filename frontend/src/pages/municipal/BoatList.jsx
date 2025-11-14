import React, { useState } from "react";
import PropTypes from "prop-types";
import Button from "../../components/Button";
import Modal from "../../components/Modal";

const MABoatList = ({ boats, onEdit, onArchive, onAssign }) => {
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditClick = (boatRegistryNo) => {
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
    <div className="bg-white rounded-lg shadow overflow-y-auto h-[50vh] sm:h-[60vh] md:h-[65vh] lg:h-[70vh] xl:h-[70vh] 2xl:h-[76vh] w-full">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="sticky top-0 w-full">
          <tr className="bg-blue-700">
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Boat Registry Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
              Boat Name
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
          {[...boats].reverse().map((boat, index) => (
            <tr
              key={boat.boat_registry_no}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {boat.boat_registry_no}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    boat.boat.boat_name == "Unnamed"
                      ? "bg-red-100 text-red-800"
                      : "text-gray-900"
                  }`}
                >
                  {boat.boat.boat_name}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    boat.boat.boat_type === "motorized"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {boat.boat.boat_type}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {boat.BirukBilugID ? (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    Assigned (ID: {boat.BirukBilugID})
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                    Not Assigned
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{`${boat.fisherfolk.last_name}, ${boat.fisherfolk.first_name} ${boat.fisherfolk.middle_name}`}</td>
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
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => handleEditClick(boat)}
                  className="text-white bg-blue-700 py-1 px-2 hover:bg-blue-500 mr-4 rounded-md"
                >
                  Edit
                </button>
                <button
                  onClick={() => onArchive(boat.boat_registry_no)}
                  className="text-white bg-yellow-700 py-1 px-2 hover:bg-yellow-500 mr-4 rounded-md"
                >
                  Archive
                </button>
                <button
                  onClick={() =>
                    onAssign(boat.boat_registry_no, boat.BirukBilugID)
                  }
                  disabled={!!boat.BirukBilugID}
                  className={`py-1 px-2 rounded-md ${
                    boat.BirukBilugID
                      ? "bg-gray-400 text-white cursor-not-allowed"
                      : "bg-green-700 text-white hover:bg-green-500"
                  }`}
                >
                  {boat.BirukBilugID ? "Assigned" : "Assign Tracker"}
                </button>
              </td>
            </tr>
          ))}
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
  );
};

MABoatList.propTypes = {
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
  onArchive: PropTypes.func.isRequired,
};

export default MABoatList;
