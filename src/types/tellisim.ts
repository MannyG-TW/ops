/**
 * TelliSIM API v3 type definitions.
 */

export interface SubscriptionLocation {
  iccid: string;
  imsi?: string;
  mcc?: string;
  mnc?: string;
  country?: string;
  countryCode?: string;
  operator?: string;
  lastSeen?: string;
  latitude?: number;
  longitude?: number;
}

export interface CoverageCountry {
  iso2: string;
  name: string;
}

export interface CoverageOperator {
  id: string;
  name: string;
  mcc: string;
  mnc: string;
  country: CoverageCountry;
  technologies?: string[];
}

export interface CoverageProfile {
  id: string;
  name: string;
  description?: string;
  countries: CoverageCountry[];
  operators: CoverageOperator[];
}

export interface Operator {
  id: string;
  label: string;
  mcc: string;
  mnc: string;
  iso2: string;
  country?: string;
  technologies?: string[];
}
