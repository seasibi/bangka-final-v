import { useState, useEffect } from 'react';
import { getMunicipalities } from '../services/municipalityService';

/**
 * Custom hook to fetch and manage municipalities
 * @returns {Object} { municipalities, municipalityPrefixes, loading, error, refetch }
 */
export const useMunicipalities = () => {
  const [municipalities, setMunicipalities] = useState([]);
  const [municipalityPrefixes, setMunicipalityPrefixes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMunicipalities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMunicipalities({ is_active: true });
      // Sort alphabetically
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setMunicipalities(sorted);
      
      // Create a mapping of municipality name to prefix
      const prefixMap = {};
      console.log('📍 Municipalities loaded:');
      sorted.forEach(muni => {
        const coastalMark = muni.is_coastal ? '🌊' : '🏔️';
        console.log(`${coastalMark} ${muni.name} - Prefix: ${muni.prefix}, Coastal: ${muni.is_coastal}`);
        if (muni.prefix) {
          prefixMap[muni.name] = muni.prefix;
        }
      });
      console.log('Final Prefix Map:', prefixMap);
      
      // Check for San Gabriel specifically
      const sanGabriel = sorted.find(m => m.name === 'San Gabriel');
      if (sanGabriel) {
        console.log('🔍 San Gabriel Status:', {
          name: sanGabriel.name,
          is_coastal: sanGabriel.is_coastal,
          prefix: sanGabriel.prefix,
          will_show_in_tracker_add: sanGabriel.is_coastal === true
        });
      }
      
      setMunicipalityPrefixes(prefixMap);
    } catch (err) {
      console.error('Error fetching municipalities:', err);
      setError(err.message || 'Failed to load municipalities');
      // Fallback to hardcoded list with prefixes if API fails
      const fallbackMunicipalities = [
        { municipality_id: 1, name: 'Agoo', prefix: 'AGO' },
        { municipality_id: 2, name: 'Aringay', prefix: 'ARI' },
        { municipality_id: 3, name: 'Bacnotan', prefix: 'BAC' },
        { municipality_id: 4, name: 'Bagulin', prefix: 'BAG' },
        { municipality_id: 5, name: 'Balaoan', prefix: 'BAL' },
        { municipality_id: 6, name: 'Bangar', prefix: 'BNG' },
        { municipality_id: 7, name: 'Bauang', prefix: 'BAU' },
        { municipality_id: 8, name: 'Burgos', prefix: 'BRG' },
        { municipality_id: 9, name: 'Caba', prefix: 'CAB' },
        { municipality_id: 11, name: 'Luna', prefix: 'LUN' },
        { municipality_id: 12, name: 'Naguilian', prefix: 'NAG' },
        { municipality_id: 13, name: 'Pugo', prefix: 'PUG' },
        { municipality_id: 14, name: 'Rosario', prefix: 'ROS' },
        { municipality_id: 10, name: 'City of San Fernando', prefix: 'CSF' },
        { municipality_id: 15, name: 'San Gabriel', prefix: 'SGB' },
        { municipality_id: 16, name: 'San Juan', prefix: 'SJN' },
        { municipality_id: 17, name: 'Santo Tomas', prefix: 'STO' },
        { municipality_id: 18, name: 'Santol', prefix: 'SNL' },
        { municipality_id: 19, name: 'Sudipen', prefix: 'SUD' },
        { municipality_id: 20, name: 'Tubao', prefix: 'TUB' }
      ];
      setMunicipalities(fallbackMunicipalities);
      
      const fallbackPrefixMap = {};
      fallbackMunicipalities.forEach(muni => {
        fallbackPrefixMap[muni.name] = muni.prefix;
      });
      setMunicipalityPrefixes(fallbackPrefixMap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMunicipalities();
  }, []);

  return {
    municipalities,
    municipalityPrefixes,
    loading,
    error,
    refetch: fetchMunicipalities
  };
};

export default useMunicipalities;
