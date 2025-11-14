import React from "react";
import logo from '../assets/logo.png';

const ReportHeader = () => {
  const styles = {
    container: {
      display: "flex",
      alignItems: "center",
      borderBottom: "2px solid #000",
      paddingBottom: "15px",
      marginBottom: "20px",
      fontFamily: "Arial, sans-serif",
    },
    logoContainer: {
      flexShrink: 0,
      marginRight: "20px",
    },
    logo: {
      width: "100px",
      height: "100px",
      objectFit: "contain",
      border: "1px solid #ccc",
      padding: "5px",
      backgroundColor: "#fff",
    },
    textContainer: {
      flexGrow: 1,
      color: "#000",
    },
    officeName: {
      margin: 0,
      fontSize: "24px",
      fontWeight: "bold",
    },
    contactInfo: {
      margin: "5px 0 0 0",
      fontSize: "14px",
      lineHeight: 1.4,
      whiteSpace: "pre-line", // to preserve line breaks if using \n
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.logoContainer}>
        {/* Replace src with your actual logo image path */}
        <img
          src={logo}
          alt="Office Logo"
          style={styles.logo}
        />
      </div>
      <div style={styles.textContainer}>
        <h1 style={styles.officeName}>Office of the Provincial Agriculturist - Fisheries Section</h1>
        <p style={styles.contactInfo}>
          Provincial Agriculturist Office, Aguila Road, Brgy. II
          <br />
          City of San Fernando, La Union 2500
          <br />
          Phone: (072) 888-3184 / 607-4492 / 607-4488
          <br />
          Email: opaglaunion@yahoo.com
        </p>
      </div>
    </div>
  );
};

export default ReportHeader;
