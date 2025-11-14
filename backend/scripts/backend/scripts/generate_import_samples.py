import os
from datetime import date
import pandas as pd

# Output directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(os.path.dirname(BASE_DIR), "samples")
os.makedirs(OUT_DIR, exist_ok=True)

# 1) Fisherfolk import sample (matches ImportFisherfolkExcelView.required_columns)
fisherfolk_columns = [
    "registration_number", "salutations", "last_name", "first_name", "middle_name",
    "appelation", "birth_date", "age", "birth_place", "civil_status", "sex",
    "contact_number", "nationality", "fisherfolk_status", "mothers_maidenname",
    "fishing_ground", "fma_number", "religion", "educational_background",
    "household_month_income", "other_source_income", "farming_income",
    "farming_income_salary", "fisheries_income", "fisheries_income_salary",
    "with_voterID", "voterID_number", "is_CCT_4ps", "is_ICC", "main_source_livelihood",
    "other_source_livelihood", "street", "barangay", "municipality", "province",
    "region", "residency_years", "barangay_verifier", "position", "verified_date",
    "contact_fname", "contact_mname", "contact_lname", "contact_relationship", "contact_contactno",
    "contact_municipality", "contact_barangay", "total_no_household_memb", "no_male",
    "no_female", "no_children", "no_in_school", "no_out_school", "no_employed",
    "no_unemployed", "org_name", "member_since", "org_position"
]

fisherfolk_row = {
    "registration_number": "2025-012354256-96542",
    "salutations": "Mr",
    "last_name": "Dela Cruz",
    "first_name": "Juan",
    "middle_name": "Santos",
    "appelation": "JR",
    "birth_date": "1985-06-15",
    "age": 39,
    "birth_place": "City of San Fernando, La Union",
    "civil_status": "Married",
    "sex": "Male",
    "contact_number": "09171234567",
    "nationality": "Filipino",
    "fisherfolk_status": "Active",
    "mothers_maidenname": "Maria Reyes",
    "fishing_ground": "Lingayen Gulf",
    "fma_number": "FMA-6",
    "religion": "Roman Catholic",
    "educational_background": "High School",
    "household_month_income": "15000",
    "other_source_income": "Small Store",
    "farming_income": True,
    "farming_income_salary": 3000.00,
    "fisheries_income": True,
    "fisheries_income_salary": 12000.00,
    "with_voterID": True,
    "voterID_number": "213456",
    "is_CCT_4ps": False,
    "is_ICC": False,
    "main_source_livelihood": "Capture Fishing",
    "other_source_livelihood": "Fish Vending, Gleaning",
    "street": "Purok 1, Brgy. Pagudpud",
    "barangay": "Pagudpud",
    "municipality": "City Of San Fernando",
    "province": "La Union",
    "region": "Ilocos Region",
    "residency_years": 15,
    "barangay_verifier": "Pedro Barrios",
    "position": "Barangay Secretary",
    "verified_date": "2024-01-10",
    "contact_fname": "Ana",
    "contact_mname": "Lopez",
    "contact_lname": "Dela Cruz",
    "contact_relationship": "Wife",
    "contact_contactno": "09998887777",
    "contact_municipality": "San Fernando",
    "contact_barangay": "Pagudpud",
    "total_no_household_memb": 5,
    "no_male": 3,
    "no_female": 2,
    "no_children": 3,
    "no_in_school": 2,
    "no_out_school": 1,
    "no_employed": 2,
    "no_unemployed": 1,
    "org_name": "San Fernando Fishers Assoc.",
    "member_since": "2020-07-01",
    "org_position": "Member",
}

# Ensure column order
fisherfolk_df = pd.DataFrame([fisherfolk_row], columns=fisherfolk_columns)

fisherfolk_path = os.path.join(OUT_DIR, "fisherfolk_import_sample.xlsx")
fisherfolk_df.to_excel(fisherfolk_path, index=False)

# 2) Boat sample (template based on Boat model). Note: boat import endpoint may not yet exist server-side.
boat_columns = [
    "mfbr_number",
    "application_date",
    "type_of_registration",
    "fisherfolk_registration_number",
    "type_of_ownership",
    "boat_name",
    "boat_type",
    "fishing_ground",
    "fma_number",
    "built_place",
    "no_fishers",
    "material_used",
    "homeport",
    "built_year",
    "engine_make",
    "serial_number",
    "horsepower",
    "registered_municipality"
]

boat_row = {
    "mfbr_number": "LU-CSF-0001",
    "application_date": "2024-10-05",
    "type_of_registration": "New/Initial Registration",
    "fisherfolk_registration_number": "2025-012354256-96542",  # must match a fisherfolk registration_number
    "type_of_ownership": "Individual",
    "boat_name": "Santa Maria",
    "boat_type": "Motorized",
    "fishing_ground": "Lingayen Gulf",
    "fma_number": "FMA-6",
    "built_place": "City Of San Fernando",
    "no_fishers": 3,
    "material_used": "Wood",
    "homeport": "San Fernando",
    "built_year": 2022,
    "engine_make": "Yanmar",
    "serial_number": "ENG-ABC-123",
    "horsepower": "12",
    "registered_municipality": "City Of San Fernando",
}

boat_df = pd.DataFrame([boat_row], columns=boat_columns)
boat_path = os.path.join(OUT_DIR, "boats_import_sample.xlsx")
boat_df.to_excel(boat_path, index=False)

print("Generated samples:")
print(" -", fisherfolk_path)
print(" -", boat_path)