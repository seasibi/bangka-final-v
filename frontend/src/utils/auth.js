// Utility function to get the access token from cookies
export const getAccessToken = () => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; access_token=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  
  return null;
};

// Utility function to set headers with auth token
export const getAuthHeaders = () => {
  const token = getAccessToken();
  if (!token) return {};
  
  return {
    Authorization: `Bearer ${token}`,
  };
};
