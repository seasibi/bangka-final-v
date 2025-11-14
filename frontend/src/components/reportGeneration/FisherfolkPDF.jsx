// FisherfolkPDF.jsx
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  PDFDownloadLink,
} from "@react-pdf/renderer";

// Styles for PDF content
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: "Times-Roman",
  },
  header: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  table: {
    display: "table",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#bfbfbf",
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableColHeader: {
    width: "25%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: "#f0f0f0",
    padding: 6,
    fontWeight: "bold",
  },
  tableCol: {
    width: "25%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 6,
  },
  noData: {
    marginTop: 20,
    textAlign: "center",
    fontStyle: "italic",
    color: "#666",
  },
  footer: {
    marginTop: 30,
    fontSize: 10,
    textAlign: "center",
    color: "#999",
  },
});

const FisherfolkPDF = ({ fisherfolk, startDate, endDate }) => (
  <Document>
    <Page size="LETTER" style={styles.page} wrap>
      <Text style={styles.header}>Fisherfolk Report</Text>
      <Text style={{ marginBottom: 10, textAlign: "center" }}>
        {startDate && endDate
          ? `From ${startDate} to ${endDate}`
          : "All Dates"}
      </Text>

      {fisherfolk.length === 0 ? (
        <Text style={styles.noData}>
          No data available for the selected date range.
        </Text>
      ) : (
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableRow}>
            <Text style={styles.tableColHeader}>Name</Text>
            <Text style={styles.tableColHeader}>Municipality</Text>
            <Text style={styles.tableColHeader}>Barangay</Text>
            <Text style={styles.tableColHeader}>Date Added</Text>
          </View>
          {/* Table Rows */}
          {fisherfolk.map(
            (
              { first_name, last_name, municipality, barangay, date_added },
              index
            ) => (
              <View style={styles.tableRow} key={index} wrap={false}>
                <Text style={styles.tableCol}>{`${first_name} ${last_name}`}</Text>
                <Text style={styles.tableCol}>{municipality}</Text>
                <Text style={styles.tableCol}>{barangay}</Text>
                <Text style={styles.tableCol}>{date_added}</Text>
              </View>
            )
          )}
        </View>
      )}

      <Text style={styles.footer}>
        &copy; {new Date().getFullYear()} Office of the Provincial Agriculturist - Fisheries Section.
      </Text>
    </Page>
  </Document>
);

export default FisherfolkPDF;
