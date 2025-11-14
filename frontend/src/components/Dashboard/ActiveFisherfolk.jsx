import React, { useEffect, useState } from 'react';
import axios from 'axios';
import fisherfolkIcon from '../../assets/fisherfolk.svg';

const ActiveFisherfolk = () => {
  const [count, setCount] = useState(0);

    const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  };
  
  useEffect(() => {
    const fetchFisherfolk = async () => {
      try {
        const token = getCookie("access_token");
      if (!token) {
        console.warn("No access token found. Please log in again.");
        return;
      }


        const response = await axios.get("http://localhost:8000/api/fisherfolk/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

        const fisherfolkList = Array.isArray(response.data)
          ? response.data
          : response.data.results || [];

        const activeCount = fisherfolkList.filter(f => f.is_active === true).length;

        setCount(activeCount);
        console.log('Active Fisherfolk Count (frontend):', activeCount);
      } catch (error) {
        console.error('Error fetching fisherfolk:', error);
        setCount(0);
      }
    };

    fetchFisherfolk();
  }, []);

  return (
    <div className="bg-blue-700 relative flex flex-col my-3 p-2 shadow-sm border border-slate-200 rounded-lg w-full text-white">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <img src={fisherfolkIcon} alt="Fisherfolk" className="h-9 w-9 text-white" />
        <span>Active Fisherfolk</span>
      </h2>
      <p className='text-5xl text-right w-full font-semibold'>{count}</p>
    </div>
  );
};

export default ActiveFisherfolk;
