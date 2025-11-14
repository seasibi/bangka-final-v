import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Add interceptor for Authorization
api.interceptors.request.use(
  (config) => {
    const token = getCookie("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
// Fetch all fisherfolk
export const getFisherfolk = async () => {
  try {
    const response = await api.get("/fisherfolk/");
    return response.data;
  } catch (error) {
    console.error("Error fetching fisherfolk:", error);
    throw error;
  }
};

// Fetch fisherfolk by municipality (checks nested address.municipality)
export const getFisherfolkByMunicipality = async (municipality) => {
  try {
    const allFisherfolk = await getFisherfolk();
    // Filter by nested address.municipality
    const filtered = allFisherfolk.filter(f =>
      f.address && f.address.municipality && f.address.municipality === municipality
    );
    return filtered;
  } catch (error) {
    console.error("Error fetching fisherfolk by municipality:", error);
    throw error;
  }
};

// Fetch a single fisherfolk by ID or number
export const getFisherfolkById = async (id) => {
  try {
    const response = await api.get(`/fisherfolk/${id}/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching fisherfolk by id:", error);
    throw error;
  }
};

export const createFisherfolk = async (data) => {
  try {
    const formData = new FormData();
    const payload = { ...data };

    // Normalize primitives to avoid sending arrays/objects for simple fields
    const BOOLEAN_FIELDS = ['farming_income','fisheries_income','with_voterID','is_CCT_4ps','is_ICC','is_active'];
    const NUMBER_FIELDS = ['age','residency_years','no_in_school','no_out_school','no_employed','no_unemployed'];
    const DATE_FIELDS = ['birth_date','verified_date'];
    const ARRAY_WHITELIST = ['other_source_livelihood','organizations'];
    const CHOICE_FIELDS = ['salutations','sex','religion','educational_background','main_source_livelihood','civil_status','fisherfolk_status'];
    const DECIMAL_FIELDS = ['farming_income_salary','fisheries_income_salary'];

    const coerceArrayStringToScalar = (v) => {
      if (typeof v === 'string') {
        const s = v.trim();
        if (s.startsWith('[') && s.endsWith(']')) {
          try {
            const jsonish = s.replace(/'/g, '"');
            const arr = JSON.parse(jsonish);
            if (Array.isArray(arr) && arr.length) return String(arr[0]);
          } catch (e) { /* ignore parse errors */ }
        }
      }
      return v;
    };

    const toBoolean = (v) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (typeof v === 'string') {
        const s = coerceArrayStringToScalar(v).toString().trim().toLowerCase();
        if (['true','1','yes','y','on'].includes(s)) return true;
        if (['false','0','no','n','off'].includes(s)) return false;
      }
      return Boolean(v);
    };

    const normalizeDateString = (v) => {
      if (v instanceof Date) return v.toISOString().split('T')[0];
      if (typeof v === 'string') {
        const s = coerceArrayStringToScalar(v).toString().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        // Year-only input: default to first day of year
        if (/^\d{4}$/.test(s)) return `${s}-01-01`;
        let m;
        // m/d/yyyy or mm/dd/yyyy
        m = s.match(/^([01]?\d)[\/\-]([0-3]?\d)[\/\-](\d{4})$/);
        if (m) {
          const [, mo, da, yr] = m;
          return `${yr}-${mo.padStart(2,'0')}-${da.padStart(2,'0')}`;
        }
        // yyyy/m/d or yyyy-mm-dd
        m = s.match(/^(\d{4})[\/\-]([01]?\d)[\/\-]([0-3]?\d)$/);
        if (m) {
          const [, yr, mo, da] = m;
          return `${yr}-${mo.padStart(2,'0')}-${da.padStart(2,'0')}`;
        }
        const d = new Date(s);
        if (!isNaN(d)) return d.toISOString().split('T')[0];
      }
      return '';
    };

    const coerceNumberString = (v) => {
      if (v === '' || v === null || v === undefined) return '';
      if (typeof v === 'string') {
        const s = coerceArrayStringToScalar(v).toString().trim();
        if (s === '') return '';
        const n = Number(s);
        return Number.isFinite(n) ? String(n) : '';
      }
      if (typeof v === 'number') return String(v);
      return '';
    };

    Object.keys(payload).forEach((key) => {
      let val = payload[key];
      if (val === undefined || val === null) return;

      // Coerce bracketed array-like strings to scalars for all string fields
      if (typeof val === 'string') {
        val = coerceArrayStringToScalar(val);
      }

      // Flatten unexpected arrays to first value
      if (Array.isArray(val) && !ARRAY_WHITELIST.includes(key)) {
        val = val.length ? String(val[0]) : '';
      }

      // Object wrappers like { value: 'Ms' }
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        if (typeof val.value !== 'undefined') {
          val = String(val.value);
        }
      }

      // Dates to YYYY-MM-DD
      if (DATE_FIELDS.includes(key)) {
        val = normalizeDateString(val);
      }

      // Booleans
      if (BOOLEAN_FIELDS.includes(key)) {
        val = toBoolean(val);
      }

      // Numbers as numeric strings
      if (NUMBER_FIELDS.includes(key)) {
        val = coerceNumberString(val);
      }

      // Choices: trim
      if (CHOICE_FIELDS.includes(key) && typeof val === 'string') {
        val = val.trim();
      }

      payload[key] = val;
    });

    console.log("Creating fisherfolk with data:", payload);

    // -------------------------------
    // 0. Normalize 'Others' free-text for livelihood
    // -------------------------------
    const osl = Array.isArray(payload.other_source_livelihood)
      ? payload.other_source_livelihood
      : [];
    const otherText = (payload.other_source_livelihood_other ?? "").toString().trim();
    if (osl.includes("Others") && otherText) {
      // Store free-text detail alongside the enum selection using existing backend field
      payload.other_source_income = otherText;
    }
    // Do not send unknown field to backend
    delete payload.other_source_livelihood_other;

    // -------------------------------
    // 1. Flatten organizations into individual fields
    // -------------------------------
    if (Array.isArray(payload.organizations)) {
      payload.organizations.forEach((org, index) => {
        // Only send org if at least one field is filled
        if (org.org_name || org.member_since || org.org_position) {
          if (org.org_name) formData.append(`organizations[${index}][org_name]`, org.org_name);
          if (org.member_since) {
            const normalizedMemberSince = normalizeDateString(org.member_since);
            if (normalizedMemberSince) {
              formData.append(`organizations[${index}][member_since]`, normalizedMemberSince);
            }
          }
          if (org.org_position) formData.append(`organizations[${index}][org_position]`, org.org_position);
        }
      });
    }

    // -------------------------------
    // 2. Append other fields
    // -------------------------------
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (key === 'picturePreview') return; // UI-only field
      if (key === "organizations") return; // Already handled

      // Files
      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      }
      // Arrays of strings (other_source_livelihood)
      else if (Array.isArray(value)) {
        if (key === "other_source_livelihood") {
          value.forEach((v) => formData.append('other_source_livelihood', v));
        } else if (value.length > 0) {
          // For unexpected arrays, send first item only to match CharField expectations
          formData.append(key, String(value[0]));
        }
      }
      // Plain objects (non-file): skip to avoid invalid JSON for CharFields
      else if (typeof value === "object") {
        // If object has a 'value' field, send that; otherwise skip
        if (value && typeof value.value !== 'undefined') {
          formData.append(key, String(value.value));
        }
      }
      // Primitives
      else {
        // Normalize booleans to 'true'/'false' strings for consistent parsing
        if (typeof value === 'boolean') {
          formData.append(key, value ? 'true' : 'false');
        } else if (DECIMAL_FIELDS.includes(key)) {
          const s = String(value).trim();
          if (s !== '' && !isNaN(Number(s))) formData.append(key, s);
        } else {
          formData.append(key, String(value));
        }
      }
    });

    // -------------------------------
    // 3. Send POST request
    // -------------------------------
    const response = await api.post("/fisherfolk/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    console.log("Fisherfolk created successfully:", response.data);


    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Error creating fisherfolk:", {
        status: error.response.status,
        data: error.response.data,
        message: error.message,
      });
    } else {
      console.error("Error creating fisherfolk:", error);
    }
    throw error;
  }
};




// Update a fisherfolk by ID
export const updateFisherfolk = async (id, data) => {
  try {
    const formData = new FormData();
    const payload = { ...data };

    // Normalize "Others" free-text for other_source_livelihood
    const osl = Array.isArray(payload.other_source_livelihood)
      ? payload.other_source_livelihood
      : [];
    const otherText = (payload.other_source_livelihood_other ?? "").toString().trim();
    if (osl.includes("Others") && otherText) {
      // Store free-text detail alongside the enum selection using existing backend field
      payload.other_source_income = otherText;
    }
    // Do not send unknown helper field to backend
    delete payload.other_source_livelihood_other;

    // Flatten organizations into individual fields if provided
    if (Array.isArray(payload.organizations)) {
      payload.organizations.forEach((org, index) => {
        if (org && (org.org_name || org.member_since || org.org_position)) {
          if (org.org_name) formData.append(`organizations[${index}][org_name]`, org.org_name);
          if (org.member_since) formData.append(`organizations[${index}][member_since]`, org.member_since);
          if (org.org_position) formData.append(`organizations[${index}][org_position]`, org.org_position);
        }
      });
    }

    // Append other fields
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (key === "organizations") return; // Already flattened above

      // Files
      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      }
      // Arrays of strings (other_source_livelihood)
      else if (Array.isArray(value)) {
        if (key === "other_source_livelihood") {
          // Send as JSON string for robust backend parsing
          formData.append(key, JSON.stringify(value));
        } else {
          value.forEach((v) => formData.append(`${key}[]`, v));
        }
      }
      // Plain objects (non-file)
      else if (typeof value === "object") {
        formData.append(key, JSON.stringify(value));
      }
      // Primitives
      else {
        formData.append(key, value);
      }
    });

    const response = await api.put(`/fisherfolk/${id}/`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error updating fisherfolk:", error);
    throw error;
  }
};

export const checkRegistrationNumber = async (registration_number) => {
  try {
    const response = await api.get("/fisherfolk/check-registration-number/", {
      params: { registration_number },
    });
    return response.data.available;
  } catch (error) {
    console.error("Error checking registration number:", error);
    return false;
  }
};
