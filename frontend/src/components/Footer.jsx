import React, { useLayoutEffect, useRef } from 'react';

const Footer = () => {
  const ref = useRef(null);

  // Expose footer height as a CSS variable so pages can offset sticky elements above it
  useLayoutEffect(() => {
    const updateVar = () => {
      const h = ref.current?.offsetHeight || 0;
      document.documentElement.style.setProperty('--footer-h', `${h}px`);
    };
    updateVar();
    window.addEventListener('resize', updateVar);
    return () => window.removeEventListener('resize', updateVar);
  }, []);

  return (
   <footer ref={ref} className="fixed bottom-0 w-full text-white px-4 flex justify-between py-3" style={{ backgroundColor: '#3863CF', fontFamily: 'Montserrat, sans-serif' }}>
      <div className="">
        Fisheries Section
      </div>
      <div className="">
        © {new Date().getFullYear()} Office of the Provincial Agriculturist, City of San Fernando, La Union
      </div>
    </footer>
  );
};

export default Footer;
