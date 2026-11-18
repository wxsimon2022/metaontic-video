export interface AgentDefinition {
  id: string;
  name: string;
  businesses: readonly string[];
  skills: readonly string[];
  icon: string;
  prompt?: (config: any) => string;
}
