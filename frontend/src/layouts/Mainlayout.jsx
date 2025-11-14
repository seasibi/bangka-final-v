import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const MainLayout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow p-6 bg-gray-50">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
