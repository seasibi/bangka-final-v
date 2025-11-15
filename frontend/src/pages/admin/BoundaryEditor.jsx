// src/pages/BoundaryEditor.jsx
import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Popup } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import { FaChevronLeft } from "react-icons/fa";
import "leaflet/dist/leaflet.css";
import PageTitle from "../../components/PageTitle";
import ConfirmModal from "../../components/ConfirmModal";
import SuccessModal from "../../components/SuccessModal";
import L from "leaflet";
import * as turf from "@turf/turf";
import {
  getBoundaries,
  getLandBoundaries,
  createBoundary,
  updateBoundary,
} from "../../services/boundaryService";
import api from "../../services/boundaryService";

// Zoom map to selected feature
const FitToFeature = ({ feature }) => {
  const map = useMap();
  useEffect(() => {
    if (feature) {
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();
      // Only fit bounds if valid and non-empty
      if (bounds.isValid() && !bounds.isEmpty) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [feature, map]);
  return null;
};


const BoundaryEditor = () => {
  const navigate = useNavigate();
  const [mapRefreshKey, setMapRefreshKey] = useState(Date.now());
  const [mode, setMode] = useState("water");
  const [pendingMode, setPendingMode] = useState(null);
  const [boundaries, setBoundaries] = useState({ type: "FeatureCollection", features: [] });
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [editingVertex, setEditingVertex] = useState(null);
  const [isCoordInputFocused, setIsCoordInputFocused] = useState(false);
  const coordInputRefs = React.useRef([]);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const [showAddMunicipality, setShowAddMunicipality] = useState(false);
  const [showEditBoundary, setShowEditBoundary] = useState(false);
  const [showConfirmAdd, setShowConfirmAdd] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [municipalities, setMunicipalities] = useState([]);
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false);
  const [municipalitiesError, setMunicipalitiesError] = useState("");
  const [newMunicipality, setNewMunicipality] = useState({
    name: "",
    municipality: null,
    water_area: "",
    coastlineLength: "",
    coordinates: [[0, 0]],
  });

  const [undoStackAdd, setUndoStackAdd] = useState([]);
  const [redoStackAdd, setRedoStackAdd] = useState([]);
  const [undoStackEdit, setUndoStackEdit] = useState([]);
  const [redoStackEdit, setRedoStackEdit] = useState([]);

  const selectedFeature = selectedIndex !== null ? boundaries.features[selectedIndex] : null;


  const closeRing = useCallback((ring) => {
    if (!ring || ring.length === 0) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return [...ring, first];
    }
    return ring;
  }, []);

  // Load Municipality options (for linking boundaries to Municipality model)
  useEffect(() => {
    const loadMunicipalities = async () => {
      setMunicipalitiesLoading(true);
      setMunicipalitiesError("");
      try {
        const res = await api.get("/municipalities/");
        const data = res?.data;
        const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        setMunicipalities(list);
      } catch (e) {
        setMunicipalitiesError("Failed to load municipalities");
        setMunicipalities([]);
      } finally {
        setMunicipalitiesLoading(false);
      }
    };
    loadMunicipalities();
  }, []);

  const computeMetrics = useCallback((geometry) => {
    try {
      if (!geometry || geometry.type !== 'Polygon') return { areaKm2: 0, coastlineKm: 0 };
      const ring = geometry.coordinates?.[0] || [];
      const closed = closeRing(ring);
      const poly = { type: 'Polygon', coordinates: [closed] };
      const area = turf.area(poly) / 1_000_000; // m^2 -> km^2
      const line = turf.polygonToLine(poly);
      const coastlineKm = turf.length(line, { units: 'kilometers' });
      return {
        areaKm2: Number.isFinite(area) ? Number(area.toFixed(4)) : 0,
        coastlineKm: Number.isFinite(coastlineKm) ? Number(coastlineKm.toFixed(3)) : 0,
      };
    } catch (e) {
      console.warn('Metric computation failed', e);
      return { areaKm2: 0, coastlineKm: 0 };
    }
  }, []);

  const normalizeGeometry = (coords) => {
    if (!coords) return null;
    if (coords.type && coords.coordinates) return coords; // already GeoJSON
    // If array-of-rings or ring, normalize to Polygon
    if (Array.isArray(coords) && Array.isArray(coords[0])) {
      // If first element is a pair of numbers -> ring
      if (typeof coords[0][0] === 'number') {
        return { type: 'Polygon', coordinates: [coords] };
      }
      return { type: 'Polygon', coordinates: coords };
    }
    return null;
  };

  useEffect(() => {
    console.log('Current mode:', mode);
    console.log('Transformed boundaries:', boundaries);
    // Do NOT reset selectedIndex here; let user keep editing
  }, [mode, boundaries]);  

  useEffect(() => {
    setUndoStackAdd([]);
    setRedoStackAdd([]);
    setUndoStackEdit([]);
    setRedoStackEdit([]);
  }, [mode, selectedIndex, showAddMunicipality]);

  // Compute municipalities already assigned for the current mode
  const assignedMunicipalityIds = React.useMemo(() => {
    try {
      return new Set(
        (boundaries?.features || [])
          .map(f => f?.properties?.municipality)
          .filter((v) => v !== null && v !== undefined)
      );
    } catch {
      return new Set();
    }
  }, [boundaries]);

  const availableMunicipalities = React.useMemo(() => {
    return (municipalities || []).filter(m => !assignedMunicipalityIds.has(m.municipality_id));
  }, [municipalities, assignedMunicipalityIds]);

  const transformBoundaries = (data) => ({
    type: "FeatureCollection",
    features: data
      .filter(item => {
        // Defensive: skip if coordinates are missing or malformed
        if (!item.coordinates) return false;
        // Accept GeoJSON Polygon for land boundaries
        if (item.coordinates.type === "Polygon" && Array.isArray(item.coordinates.coordinates) && item.coordinates.coordinates.length > 0) return true;
        // Accept array for water boundaries
        if (Array.isArray(item.coordinates) && item.coordinates.length > 0 && Array.isArray(item.coordinates[0])) return true;
        return false;
      })
      .map((item) => {
        let coordinates;
        if (item.coordinates && item.coordinates.type === "Polygon" && Array.isArray(item.coordinates.coordinates)) {
          coordinates = item.coordinates.coordinates;
        } else if (Array.isArray(item.coordinates) && Array.isArray(item.coordinates[0])) {
          coordinates = [
            item.coordinates.filter(
              c => Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number" && !isNaN(c[0]) && !isNaN(c[1])
            )
          ];
        } else {
          coordinates = [];
        }
        return {
          type: "Feature",
          properties: {
            name: item.name,
            municipality: item.municipality,
            water_area: parseFloat(item.water_area) || 0,
            land_area: parseFloat(item.land_area) || 0,
            coastlineLength: parseFloat(item.coastline_length || item.boundary_length) || 0,
            boundary_length: parseFloat(item.boundary_length) || 0,
            id: item.land_id || item.id,
          },
          geometry: {
            type: "Polygon",
            coordinates,
          },
        };
      }),
  });

  // Fetch boundaries from backend
  useEffect(() => {
    async function fetchInitialBoundaries() {
      try {
        const data = await getBoundaries();
        setBoundaries(transformBoundaries(data));
      } catch (error) {
        console.error("Failed to fetch boundaries", error);
      }
    }
    fetchInitialBoundaries();
  }, []);

  // Toggle between water and land boundaries
  const handleToggle = async (newMode) => {
  setPendingMode(newMode);
  setSelectedIndex(null);
  setShowAddMunicipality(false);
  setShowEditBoundary(false);
      try {
        const data = newMode === "water" ? await getBoundaries() : await getLandBoundaries();
        setBoundaries(transformBoundaries(data));
        setMode(newMode);
      } catch (error) {
        console.error('Failed to fetch boundaries', error);
      }
    };


  // --- Update polygon properties immutably ---
  const handlePropertyChange = (field, value) => {
    if (selectedIndex === null) return;
    setBoundaries((prev) => {
      const newFeatures = prev.features.map((feature, idx) =>
        idx === selectedIndex
          ? { ...feature, properties: { ...feature.properties, [field]: value } }
          : feature
      );
      return { ...prev, features: newFeatures };
    });
  };

  const setEditCoords = (newCoords) => {
    if (selectedIndex === null) return;
    setBoundaries((prev) => {
      const newFeatures = prev.features.map((feature, idx) => {
        if (idx !== selectedIndex) return feature;
        return {
          ...feature,
          geometry: { ...feature.geometry, coordinates: [newCoords.map((c) => [...c])] },
        };
      });
      return { ...prev, features: newFeatures };
    });
  };

  const undoEditCoords = () => {
    setUndoStackEdit((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const current = (boundaries.features[selectedIndex]?.geometry?.coordinates?.[0] || []).map((c) => [...c]);
      setRedoStackEdit((r) => [...r, current]);
      setEditCoords(last);
      return prev.slice(0, -1);
    });
  };

  const redoEditCoords = () => {
    setRedoStackEdit((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const current = (boundaries.features[selectedIndex]?.geometry?.coordinates?.[0] || []).map((c) => [...c]);
      setUndoStackEdit((u) => [...u, current]);
      setEditCoords(last);
      return prev.slice(0, -1);
    });
  };

  // --- Update coordinates immutably ---
  const handleCoordChange = (pointIndex, coordIndex, value) => {
    if (selectedIndex === null) return;
    const numValue = parseFloat(value) || 0;

    // snapshot before change
    setUndoStackEdit((s) => {
      const current = (boundaries.features[selectedIndex]?.geometry?.coordinates?.[0] || []).map((c) => [...c]);
      return [...s, current];
    });
    setRedoStackEdit([]);

    setBoundaries((prev) => {
      const newFeatures = prev.features.map((feature, idx) => {
        if (idx !== selectedIndex) return feature;

        const newCoords = feature.geometry.coordinates[0].map((coord, i) =>
          i === pointIndex
            ? coord.map((c, j) => (j === coordIndex ? numValue : c))
            : coord
        );

        setEditingVertex({ lat: newCoords[pointIndex][1], lng: newCoords[pointIndex][0] });

        const newGeom = { ...feature.geometry, coordinates: [newCoords] };
        const metrics = computeMetrics(newGeom);
        return {
          ...feature,
          geometry: newGeom,
          properties: {
            ...feature.properties,
            waterArea: metrics.areaKm2,
            coastlineLength: metrics.coastlineKm,
          },
        };
      });
      return { ...prev, features: newFeatures };
    });
  };

  // --- Add Municipality Handlers ---
  const addCoordinate = () =>
    setNewMunicipality((prev) => {
      setUndoStackAdd((s) => [...s, prev.coordinates.map((c) => [...c])]);
      setRedoStackAdd([]);
      return { ...prev, coordinates: [...prev.coordinates, [0, 0]] };
    });

  const removeCoordinate = (idx) =>
    setNewMunicipality((prev) => {
      setUndoStackAdd((s) => [...s, prev.coordinates.map((c) => [...c])]);
      setRedoStackAdd([]);
      return {
        ...prev,
        coordinates: prev.coordinates.filter((_, i) => i !== idx),
      };
    });

  const handleNewCoordChange = (coordIdx, index, value) => {
    const num = parseFloat(value) || 0;
    setNewMunicipality((prev) => {
      setUndoStackAdd((s) => [...s, prev.coordinates.map((c) => [...c])]);
      setRedoStackAdd([]);
      return {
        ...prev,
        coordinates: prev.coordinates.map((c, i) =>
          i === coordIdx ? (index === 0 ? [num, c[1]] : [c[0], num]) : c
        ),
      };
    });
  };

  const undoAddCoords = () => {
    setUndoStackAdd((prev) => {
      if (prev.length === 0) return prev;
      setNewMunicipality((nm) => {
        const last = prev[prev.length - 1];
        setRedoStackAdd((r) => [...r, nm.coordinates.map((c) => [...c])]);
        return { ...nm, coordinates: last.map((c) => [...c]) };
      });
      return prev.slice(0, -1);
    });
  };

  const redoAddCoords = () => {
    setRedoStackAdd((prev) => {
      if (prev.length === 0) return prev;
      setNewMunicipality((nm) => {
        const last = prev[prev.length - 1];
        setUndoStackAdd((u) => [...u, nm.coordinates.map((c) => [...c])]);
        return { ...nm, coordinates: last.map((c) => [...c]) };
      });
      return prev.slice(0, -1);
    });
  };

  // --- Add Municipality (Backend) ---
  const handleAddMunicipalityClick = () => {
    if (!newMunicipality.municipality || !newMunicipality.name || newMunicipality.coordinates.length === 0) {
      alert("Please fill all required fields");
      return;
    }
    setShowConfirmAdd(true);
  };

  const addMunicipality = async () => {
    const type = (pendingMode ?? mode) === "land" ? "land" : "water";
    const closed = closeRing(newMunicipality.coordinates);
    const base = {
      name: newMunicipality.name,
      municipality: newMunicipality.municipality,
      coordinates: { type: "Polygon", coordinates: [closed] },
    };
    const payload =
      type === "land"
        ? {
            ...base,
            land_area: parseFloat(newMunicipality.water_area) || 0,
            boundary_length: parseFloat(newMunicipality.coastlineLength) || 0,
          }
        : {
            ...base,
            water_area: parseFloat(newMunicipality.water_area) || 0,
            coastline_length: parseFloat(newMunicipality.coastlineLength) || 0,
          };

    try {
      const created = await createBoundary(payload, type);
      // Re-fetch the correct list to ensure consistency
      const data = type === "land" ? await getLandBoundaries() : await getBoundaries();
      const newBoundaries = transformBoundaries(data);
      setBoundaries(newBoundaries);
      // Select the newly created one by id
      const createdId = created.land_id || created.id;
      const idx = newBoundaries.features.findIndex((f) => f.properties.id === createdId);
      setSelectedIndex(idx >= 0 ? idx : null);
      setNewMunicipality({ name: "", water_area: "", coastlineLength: "", coordinates: [[0, 0]] });
      setShowAddMunicipality(false);
    } catch (err) {
      console.error("Failed to create boundary", err);
      alert("Failed to create boundary. See console for details.");
    }
  };

  // --- Save changes to backend ---
  const handleSaveClick = () => {
    if (!selectedFeature || !selectedFeature.properties.id) return;
    setShowConfirmSave(true);
  };

  const handleSave = async () => {

    const ring = selectedFeature.geometry?.coordinates?.[0] || [];
    const closed = closeRing(ring);
    const type = (pendingMode ?? mode) === "land" ? "land" : "water";
    const payload = {
      name: selectedFeature.properties.name,
      ...(type === "land"
        ? { boundary_length: parseFloat(selectedFeature.properties.coastlineLength) || 0 }
        : { coastline_length: parseFloat(selectedFeature.properties.coastlineLength) || 0 }),
      coordinates: { type: 'Polygon', coordinates: [closed] },
      ...(type === "land"
        ? { land_area: parseFloat(selectedFeature.properties.land_area) || 0 }
        : { water_area: parseFloat(selectedFeature.properties.water_area) || 0 })
    };

    try {
      await updateBoundary(selectedFeature.properties.id, payload, type);
      setShowSaveSuccess(true);
      // Re-fetch boundaries to refresh map
      const data = type === "land" ? await getLandBoundaries() : await getBoundaries();
      const newBoundaries = transformBoundaries(data);
      setBoundaries(newBoundaries);
      // Re-select the updated boundary by id
      const updatedIdx = newBoundaries.features.findIndex(
        f => f.properties.id === selectedFeature.properties.id
      );
      if (updatedIdx !== -1) {
        setSelectedIndex(updatedIdx);
      }
      // Reset editing vertex to force marker refresh
      setEditingVertex(null);
      // Force map container to refresh
      setMapRefreshKey(Date.now());
    } catch (err) {
      console.error("Failed to update boundary", err);
      alert("Failed to save changes. See console for details.");
    }
  };


  // Prevent background scroll when modal open; close on ESC
  useEffect(() => {
    const original = document.body.style.overflow;
    if (showSaveSuccess) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = original || '';
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setShowSaveSuccess(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original || '';
      window.removeEventListener('keydown', onKey);
    };
  }, [showSaveSuccess]);

  return (
    <div className="h-full bg-gray-50 font-montserrat" style={{ fontFamily: "Montserrat, sans-serif" }}>
      {/* Page Title */}
      <div className="px-6 py-6 bg-white rounded-b-xl flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin/utility')}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
        >
          <FaChevronLeft className="w-5 h-5" />
        </button>
        <PageTitle value="Boundary Editor" />
      </div>

      <div className="flex gap-6 h-[calc(100vh-200px)] p-6">
        {/* Left Panel - match map height */}
        <div className="w-1/3 space-y-6 h-full flex flex-col">

          {/* Toggle Water/Land Boundaries (toggle group style) */}
          <div className="mb-4 flex rounded-lg overflow-hidden border border-gray-300">
            <button
              className={`flex-1 px-4 py-2 font-semibold transition-all duration-150 focus:outline-none ${mode === "water" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-blue-100"}`}
              style={{ borderRight: "1px solid #e5e7eb" }}
              onClick={() => handleToggle("water")}
              aria-pressed={mode === "water"}
            >
              View Water Boundaries
            </button>
            <button
              className={`flex-1 px-4 py-2 font-semibold transition-all duration-150 focus:outline-none ${mode === "land" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-blue-100"}`}
              onClick={() => handleToggle("land")}
              aria-pressed={mode === "land"}
            >
              View Land Boundaries
            </button>
          </div>

          {/* Add/Edit Boundary Standard Buttons */}
          <div className="flex gap-4 mb-4">
            <button
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-150 focus:outline-none bg-green-600 text-white hover:bg-green-700`}
              onClick={() => {
                setShowAddMunicipality(true);
                setShowEditBoundary(false);
              }}
              >
              Add Boundary
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-150 focus:outline-none bg-blue-600 text-white hover:bg-blue-700`}
              onClick={() => {
                // If no boundary is selected, select the first one
                if (selectedIndex === null && boundaries.features.length > 0) {
                  setSelectedIndex(0);
                }
                setShowEditBoundary(true);
                setShowAddMunicipality(false);
              }}
              disabled={boundaries.features.length === 0}
            >
              Edit Boundary
            </button>
          </div>

                    {/* Select Boundary - hidden when Add Boundary is selected */}
          {!showAddMunicipality && (
            <div className="bg-white rounded-xl shadow-md p-5 mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select {(pendingMode ?? mode) === "water" ? "Municipality" : "Municipality"}
              </label>
              <select
                value={selectedIndex ?? ""}
                onChange={(e) => {
                  setSelectedIndex(e.target.value === "" ? null : Number(e.target.value));
                  // Do not close edit panel if already open
                }}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <option value="">-- Choose a {(pendingMode ?? mode) === "water" ? "municipality" : "land boundary"} --</option>
                {boundaries.features.map((feature, index) => (
                  <option key={index} value={index}>
                    {feature.properties?.name || `Boundary ${index+1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Add Municipality Panel */}

          {showAddMunicipality && (
            <div className="bg-white rounded-xl shadow-md p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-600">Municipality</label>
                <select
                  value={newMunicipality.municipality ?? ""}
                  onChange={(e) => {
                    const id = e.target.value ? parseInt(e.target.value, 10) : null;
                    const selected = municipalities.find(m => m.municipality_id === id);
                    setNewMunicipality((prev) => ({
                      ...prev,
                      municipality: id,
                      name: selected?.name || "",
                    }));
                  }}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                >
                  <option value="" disabled>
                    {municipalitiesLoading ? "Loading municipalities..." : "Select Municipality"}
                  </option>
                  {municipalitiesError && (
                    <option value="" disabled>{municipalitiesError}</option>
                  )}
                  {!municipalitiesLoading && !municipalitiesError && availableMunicipalities.map((m) => (
                    <option key={m.municipality_id} value={m.municipality_id}>
                      {m.name}
                    </option>
                  ))}

              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">{(pendingMode ?? mode) === "land" ? "Land Area (sq km)" : "Water Area (sq km)"}</label>
              <input
                type="number"
                value={newMunicipality.water_area}
                onChange={(e) => setNewMunicipality((prev) => ({ ...prev, water_area: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">{(pendingMode ?? mode) === "land" ? "Boundary Length (km)" : "Coastline Length (km)"}</label>
              <input
                type="number"
                value={newMunicipality.coastlineLength}
                onChange={(e) => setNewMunicipality((prev) => ({ ...prev, coastlineLength: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-600">Coordinates (Lng, Lat)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={undoAddCoords}
                    disabled={undoStackAdd.length === 0}
                    className={`px-2 py-1 rounded border text-xs ${undoStackAdd.length === 0 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={redoAddCoords}
                    disabled={redoStackAdd.length === 0}
                    className={`px-2 py-1 rounded border text-xs ${redoStackAdd.length === 0 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Redo
                  </button>
                </div>
              </div>
              {newMunicipality.coordinates.map((coord, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="number"
                    step="0.00001"
                    placeholder="Longitude"
                    value={coord[0]}
                    onChange={(e) => handleNewCoordChange(idx, 0, e.target.value)}
                    className="w-1/2 px-2 py-1 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
                  />
                  <input
                    type="number"
                    step="0.00001"
                    placeholder="Latitude"
                    value={coord[1]}
                    onChange={(e) => handleNewCoordChange(idx, 1, e.target.value)}
                    className="w-1/2 px-2 py-1 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeCoordinate(idx)}
                    className="text-red-500 font-semibold"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addCoordinate}
                className="text-blue-600 font-semibold hover:underline text-sm mt-1"
              >
                + Add Coordinate
              </button>
            </div>
            <button
              onClick={handleAddMunicipalityClick}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 mt-4"
            >
              Add Municipality
            </button>
          </div>
        )}

          {/* Edit Boundary Panel */}
          {showEditBoundary && selectedFeature && (
            <div className="bg-white rounded-xl shadow-md p-5 space-y-6 flex-1 overflow-y-auto">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                Editing: {selectedFeature.properties.name} Boundaries
              </h3>

              {/* Properties */}
              <div className="space-y-4">
                {(pendingMode ?? mode) === "land" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Land Area (sq km)</label>
                    <input
                      type="number"
                      value={selectedFeature.properties.land_area}
                      onChange={(e) => handlePropertyChange("land_area", e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>
                )}
                {(pendingMode ?? mode) === "water" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600">Water Area (sq km)</label>
                    <input
                      type="number"
                      value={selectedFeature.properties.water_area}
                      onChange={(e) => handlePropertyChange("water_area", e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-600">{(pendingMode ?? mode) === "land" ? "Boundary Length (km)" : "Coastline Length (km)"}</label>
                  <input
                    type="number"
                    value={selectedFeature.properties.coastlineLength}
                    onChange={(e) => handlePropertyChange("coastlineLength", e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Coordinates */}
              <div>
                <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700">Coordinates</h4>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={undoEditCoords}
                    disabled={undoStackEdit.length === 0}
                    className={`px-2 py-1 rounded border text-xs ${undoStackEdit.length === 0 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    onClick={redoEditCoords}
                    disabled={redoStackEdit.length === 0}
                    className={`px-2 py-1 rounded border text-xs ${redoStackEdit.length === 0 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Redo
                  </button>
                </div>
              </div>
                <div className="space-y-2">
                  {(Array.isArray(selectedFeature?.geometry?.coordinates) && Array.isArray(selectedFeature.geometry.coordinates[0])
                    ? selectedFeature.geometry.coordinates[0]
                    : []
                  ).map((coord, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="number"
                        step="0.00001"
                        value={coord[0]}
                        ref={el => coordInputRefs.current[idx * 2] = el}
                        onFocus={() => {
                          setEditingVertex({ lat: coord[1], lng: coord[0] });
                          setIsCoordInputFocused(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            // If neither input is focused, close marker
                            const focused = coordInputRefs.current.some(ref => ref && ref === document.activeElement);
                            if (!focused) {
                              setIsCoordInputFocused(false);
                              setEditingVertex(null);
                            }
                          }, 0);
                        }}
                        onChange={(e) => handleCoordChange(idx, 0, e.target.value)}
                        className="w-1/2 px-2 py-1 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm coord-input"
                        placeholder="Longitude"
                      />
                      <input
                        type="number"
                        step="0.00001"
                        value={coord[1]}
                        ref={el => coordInputRefs.current[idx * 2 + 1] = el}
                        onFocus={() => {
                          setEditingVertex({ lat: coord[1], lng: coord[0] });
                          setIsCoordInputFocused(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            const focused = coordInputRefs.current.some(ref => ref && ref === document.activeElement);
                            if (!focused) {
                              setIsCoordInputFocused(false);
                              setEditingVertex(null);
                            }
                          }, 0);
                        }}
                        onChange={(e) => handleCoordChange(idx, 1, e.target.value)}
                        className="w-1/2 px-2 py-1 border border-gray-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm coord-input"
                      />
                      <button
                        type="button"
                        className="text-red-500 font-semibold ml-2"
                        onClick={() => {
                          // snapshot then remove coordinate from selected feature
                          setUndoStackEdit((s) => {
                            const current = (boundaries.features[selectedIndex]?.geometry?.coordinates?.[0] || []).map((c) => [...c]);
                            return [...s, current];
                          });
                          setRedoStackEdit([]);
                          setBoundaries((prev) => {
                            const newFeatures = prev.features.map((feature, fidx) => {
                              if (fidx !== selectedIndex) return feature;
                              const coords = feature.geometry.coordinates[0].filter((_, cidx) => cidx !== idx);
                              return {
                                ...feature,
                                geometry: {
                                  ...feature.geometry,
                                  coordinates: [coords],
                                },
                              };
                            });
                            return { ...prev, features: newFeatures };
                          });
                        }}
                        disabled={selectedFeature.geometry.coordinates[0].length <= 1}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-blue-600 font-semibold hover:underline text-sm mt-2"
                    onClick={() => {
                      // snapshot then add coordinate to selected feature
                      setUndoStackEdit((s) => {
                        const current = (boundaries.features[selectedIndex]?.geometry?.coordinates?.[0] || []).map((c) => [...c]);
                        return [...s, current];
                      });
                      setRedoStackEdit([]);
                      setBoundaries((prev) => {
                        const newFeatures = prev.features.map((feature, fidx) => {
                          if (fidx !== selectedIndex) return feature;
                          const coords = [...feature.geometry.coordinates[0], [0, 0]];
                          return {
                            ...feature,
                            geometry: {
                              ...feature.geometry,
                              coordinates: [coords],
                            },
                          };
                        });
                        return { ...prev, features: newFeatures };
                      });
                    }}
                  >
                    + Add Coordinate
                  </button>
                </div>
              </div>

               <button
                onClick={handleSaveClick}
                disabled={selectedIndex === null}
                className={`w-full py-3 rounded-xl text-white font-semibold transition-all duration-200 ${
                  selectedIndex === null
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-lg"
                }`}
              >
                Save Changes
              </button>
</div>
          )}
              
        </div>

        {/* Right Panel: Map Preview */}
        <div className="w-2/3 relative rounded-xl overflow-hidden shadow-md">
  <MapContainer
  key={mapRefreshKey}
    center={[16.6154, 120.3199]}
    zoom={12}
    scrollWheelZoom={true}
    className="h-full w-full"
    attributionControl={false}
  >
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors"
    />

        {boundaries.features.length > 0 && (
      <GeoJSON
        key={boundaries.features.length + mode + '-' + (selectedIndex ?? '') + '-' + (boundaries.features[selectedIndex]?.properties.id ?? '')}
        data={boundaries}
        style={(feature) => ({
          color:
            selectedFeature && feature.properties?.name === selectedFeature.properties?.name
              ? "#2563eb"
              : "#555",
          weight:
            selectedFeature && feature.properties?.name === selectedFeature.properties?.name
              ? 3
              : 2,
          fillOpacity:
            selectedFeature && feature.properties?.name === selectedFeature.properties?.name
              ? 0.35
              : 0.15,
        })}
      />
    )}

    {selectedFeature && (
      <FitToFeature key={'fit-' + (selectedFeature.properties.id ?? '') + '-' + Date.now()} feature={selectedFeature} />
    )}
    {editingVertex && editingVertex.lat && editingVertex.lng && (
      <Marker position={[editingVertex.lat, editingVertex.lng]}>
        <Popup>Editing Vertex</Popup>
      </Marker>
    )}
  </MapContainer>
</div>
      </div>

      <ConfirmModal
        isOpen={showConfirmAdd}
        onClose={() => setShowConfirmAdd(false)}
        onConfirm={addMunicipality}
        title="Confirm Add Boundary"
        message="Are you sure you want to add this boundary?"
      />

      <ConfirmModal
        isOpen={showConfirmSave}
        onClose={() => setShowConfirmSave(false)}
        onConfirm={handleSave}
        title="Confirm Save Changes"
        message="Are you sure you want to save these boundary changes?"
      />

      <SuccessModal
        isOpen={showSaveSuccess}
        onClose={() => setShowSaveSuccess(false)}
        title="Boundary Saved"
        message={`Changes to ${selectedFeature?.properties?.name} have been saved successfully.`}
      />
    </div>
  );
};

export default BoundaryEditor;
