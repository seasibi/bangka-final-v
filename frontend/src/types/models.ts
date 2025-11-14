export interface User {
  id: number;
  username: string;
  email: string;
  password?: string;
  last_login?: string;
  is_superuser: boolean;
  user_role: string;
  is_active: boolean;
  date_added: string;
  municipal_agriculturist?: MunicipalAgriculturist;
  provincial_agriculturist?: ProvincialAgriculturist;
}

export interface MunicipalAgriculturist {
  MunicipalAgriculturistID: number;
  FirstName: string;
  MiddleName?: string;
  LastName: string;
  Sex: string;
  Municipality: string;
  ContactNo: string;
  Position: string;
  Status: string;
  DateAdded: string;
}

export interface ProvincialAgriculturist {
  ProvincialAgriculturistID: number;
  FirstName: string;
  MiddleName?: string;
  LastName: string;
  Sex: string;
  ContactNo: string;
  Position: string;
  Status: string;
  DateAdded: string;
}

export interface Fisherfolk {
  registration_number: string;
  salutation: string;
  last_name: string;
  first_name: string;
  middle_name?: string;
  appelation?: string;
  civil_status: string;
  nationality: string;
  barangay: string;
  municipality: string;
  contact_number: string;
  birth_date: string;
  birth_place: string;
  fishery_section: string;
  picture?: string;
  signature?: string;
  date_added: string;
}

export interface Boat {
  boat_id: number;
  BoatName: string;
  BoatType: string;
  BuiltPlace: string;
  BuiltYear: number;
  MaterialUsed: string;
  RegisteredLength: number;
  RegisteredBreadth: number;
  RegisteredDepth: number;
  BoatImage?: string;
  DateAdded: string;
}

export interface FisherfolkBoat {
  BoatRegistryNo: number;
  FisherfolkID: Fisherfolk;
  BoatID: Boat;
  TypeOfRegistration: string;
  TypeOfOwnership: string;
  MaterialUsed: string;
  NoOfFishers: number;
  Homeport: string;
  DateAdded: string;
}

export interface BirukbilugTracker {
  BirukBilugID: number;
  Municipality: string;
  Status: string;
  DateAdded: string;
}

export interface BoatBirukbilugTracker {
  TrackingNo: number;
  BirukBilugID: BirukbilugTracker;
  BoatRegistryNo: FisherfolkBoat;
  Timestamp: string;
  Longitude: number;
  Latitude: number;
} 