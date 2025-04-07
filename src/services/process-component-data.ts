import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import { ComponentProperty, ComponentMetadata, ComponentSet } from "~/types/component.js";

export function processComponentData(node: FigmaDocumentNode): {
  componentId?: string;
  componentProperties?: Record<string, ComponentProperty>;
  componentMetadata?: ComponentMetadata;
  componentSet?: ComponentSet;
} {
  if (node.type !== 'INSTANCE' || !node.componentId) {
    return {};
  }

  const result: ReturnType<typeof processComponentData> = {
    componentId: node.componentId
  };

  // Process component properties
  if (node.componentProperties) {
    result.componentProperties = Object.entries(node.componentProperties).reduce((acc, [key, prop]) => {
      acc[key] = {
        value: prop.value,
        type: prop.type,
        preferredValues: prop.preferredValues,
        boundVariables: prop.boundVariables
      };
      return acc;
    }, {} as Record<string, ComponentProperty>);
  }

  // Process component metadata
  if (node.components?.[node.componentId]) {
    const component = node.components[node.componentId];
    result.componentMetadata = {
      key: component.key,
      name: component.name,
      description: component.description || '',
      componentSetId: component.componentSetId,
      documentationLinks: component.documentationLinks || []
    };

    // Process component set data
    if (component.componentSetId && node.componentSets?.[component.componentSetId]) {
      const componentSet = node.componentSets[component.componentSetId];
      result.componentSet = {
        key: componentSet.key,
        name: componentSet.name,
        description: componentSet.description || '',
        variants: Object.values(componentSet.components || {}).map(variant => ({
          key: variant.key,
          name: variant.name,
          description: variant.description || '',
          componentSetId: variant.componentSetId,
          documentationLinks: variant.documentationLinks || []
        }))
      };
    }
  }

  return result;
}