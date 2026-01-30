/**
 * A2A-compatible Agent Card generated from AWP identity
 */
export interface AgentCard {
  name: string;
  description?: string;
  url?: string;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
  };
  skills?: AgentSkill[];
  authentication?: {
    schemes: string[];
  };
}

export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
}

/**
 * DID Document (simplified W3C DID Core)
 */
export interface DIDDocument {
  "@context": string[];
  id: string;
  verificationMethod?: VerificationMethod[];
  authentication?: string[];
  assertionMethod?: string[];
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
}
