import React, { useEffect, useState } from 'react';
import { getBoats } from '../../services/boatService';
import boatIcon from '../../assets/boat.svg';

const ActiveBoat = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetchBoats = async () => {
      try {
        const boats = await getBoats();
        const activeCount = boats.filter(b => b.is_active === true).length;
        setCount(activeCount);
        console.log('Active Boats Count (frontend):', activeCount);
      } catch {
        setCount(0);
      }
    };
    fetchBoats();
  }, []);

  return (
    <div className="bg-blue-700 relative flex flex-col my-3 p-2 shadow-sm border border-slate-200 rounded-lg w-full text-white">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <img src={boatIcon} alt="boat" className="h-9 w-9 text-white" />
        <span>Active Boats</span>
      </h2>
      <p className='text-5xl text-right w-full font-semibold'>{count}</p>
    </div>
  );
};

export default ActiveBoat;