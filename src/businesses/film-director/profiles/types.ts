export interface FilmProfile {
  id: string;
  revision: string;
  label: string;
  strategy: string;
  boundary: string;
  creative_fields: Record<string,string>;
  script_fields: Record<string,string>;
  review_criteria: {id:string;description:string}[];
  role_rules: Partial<Record<string,string>>;
}
