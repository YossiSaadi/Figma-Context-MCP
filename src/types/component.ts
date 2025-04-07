export interface ComponentProperty {
  value: any;
  type: 'VARIANT' | 'TEXT' | 'INSTANCE_SWAP' | 'BOOLEAN';
  preferredValues?: Array<{
    type: string;
    key: string;
  }>;
  boundVariables?: Record<string, any>;
}

export interface ComponentMetadata {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
  documentationLinks: string[];
}

export interface ComponentSet {
  key: string;
  name: string;
  description: string;
  variants?: ComponentMetadata[];
}

export interface ComponentData {
  componentId?: string;
  componentProperties?: Record<string, ComponentProperty>;
  componentMetadata?: ComponentMetadata;
  componentSet?: ComponentSet;
}