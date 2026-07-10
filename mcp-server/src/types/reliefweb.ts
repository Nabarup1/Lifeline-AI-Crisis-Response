export interface ReliefWebReport {
  id: string;
  title: string;
  date: string;
  url: string;
  summary: string; // Truncated body
  source: string[];
}

export interface ReliefWebDisaster {
  id: string;
  name: string;
  status: string;
  type: string;
  url: string;
}

export interface ReliefWebCountry {
  id: string;
  name: string;
  shortname: string;
  url: string;
}
