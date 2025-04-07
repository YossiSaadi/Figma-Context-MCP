import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import { processComponentData } from "./process-component-data.js";
import { ComponentData } from "~/types/component.js";

export interface SimplifiedNode extends ComponentData {
  id: string;
  name: string;
  type: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text?: string;
  textStyle?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: number;
    textAlignHorizontal: string;
    textAlignVertical: string;
  };
  fills?: string[];
  styles?: Record<string, string>;
  strokes?: string[];
  effects?: string[];
  opacity?: number;
  borderRadius?: string;
  children?: SimplifiedNode[];
}

export interface SimplifiedDesign {
  metadata: {
    name: string;
    lastModified: string;
    thumbnailUrl: string;
  };
  nodes: SimplifiedNode[];
  globalVars: {
    styles: Record<string, any>;
  };
}

export function parseFigmaResponse(response: any): SimplifiedDesign {
  const { name, lastModified, thumbnailUrl, nodes } = response;
  const globalVars = { styles: {} };
  const parsedNodes: SimplifiedNode[] = [];

  for (const nodeId in nodes) {
    const node = nodes[nodeId].document;
    const parsedNode = parseNode(node, globalVars);
    if (parsedNode) {
      parsedNodes.push(parsedNode);
    }
  }

  return {
    metadata: {
      name,
      lastModified,
      thumbnailUrl,
    },
    nodes: parsedNodes,
    globalVars,
  };
}

function findOrCreateVar(
  globalVars: { styles: Record<string, any> },
  type: string,
  value: any
): string {
  const key = `${type}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  globalVars.styles[key] = value;
  return key;
}

function parseNode(
  n: FigmaDocumentNode,
  globalVars: { styles: Record<string, any> }
): SimplifiedNode | null {
  if (!n) return null;

  const node: SimplifiedNode = {
    id: n.id,
    name: n.name,
    type: n.type === "VECTOR" ? "IMAGE-SVG" : n.type,
  };

  // Process component data
  const componentData = processComponentData(n);
  if (componentData) {
    Object.assign(node, componentData);
  }

  if (n.absoluteBoundingBox) {
    node.boundingBox = {
      x: n.absoluteBoundingBox.x,
      y: n.absoluteBoundingBox.y,
      width: n.absoluteBoundingBox.width,
      height: n.absoluteBoundingBox.height,
    };
  }

  if (n.characters) {
    node.text = n.characters;
  }

  if (n.style) {
    node.textStyle = {
      fontFamily: n.style.fontFamily,
      fontSize: n.style.fontSize,
      fontWeight: n.style.fontWeight,
      lineHeight: n.style.lineHeightPx,
      letterSpacing: n.style.letterSpacing,
      textAlignHorizontal: n.style.textAlignHorizontal,
      textAlignVertical: n.style.textAlignVertical,
    };
  }

  if (n.fills?.length) {
    node.fills = n.fills.map((fill) => {
      if (fill.type === "SOLID") {
        return findOrCreateVar(globalVars, "fill", [
          `#${Math.round(fill.color.r * 255)
            .toString(16)
            .padStart(2, "0")}${Math.round(fill.color.g * 255)
            .toString(16)
            .padStart(2, "0")}${Math.round(fill.color.b * 255)
            .toString(16)
            .padStart(2, "0")}`,
        ]);
      }
      return findOrCreateVar(globalVars, "fill", fill);
    });
  }

  if (n.strokes?.length) {
    node.strokes = n.strokes.map((stroke) => {
      return findOrCreateVar(globalVars, "stroke", {
        colors: [
          `#${Math.round(stroke.color.r * 255)
            .toString(16)
            .padStart(2, "0")}${Math.round(stroke.color.g * 255)
            .toString(16)
            .padStart(2, "0")}${Math.round(stroke.color.b * 255)
            .toString(16)
            .padStart(2, "0")}`,
        ],
        strokeWeight: `${n.strokeWeight}px`,
      });
    });
  }

  if (n.effects?.length) {
    node.effects = n.effects.map((effect) => {
      return findOrCreateVar(globalVars, "effect", {
        boxShadow: `${effect.offset.x}px ${effect.offset.y}px ${
          effect.radius
        }px 0px rgba(0, 0, 0, ${effect.color.a})`,
      });
    });
  }

  if (n.styles) {
    node.styles = {};
    for (const [key, value] of Object.entries(n.styles)) {
      node.styles[key] = value.key;
    }
  }

  if (typeof n.opacity === "number") {
    node.opacity = n.opacity;
  }

  if (n.cornerRadius) {
    node.borderRadius = `${n.cornerRadius}px`;
  }

  if (n.layoutMode) {
    const layoutKey = findOrCreateVar(globalVars, "layout", {
      mode: n.layoutMode.toLowerCase(),
      ...(n.primaryAxisAlignItems && {
        justifyContent: n.primaryAxisAlignItems.toLowerCase(),
      }),
      ...(n.counterAxisAlignItems && {
        alignItems: n.counterAxisAlignItems.toLowerCase(),
      }),
      ...(n.itemSpacing && { gap: `${n.itemSpacing}px` }),
      ...(n.paddingLeft && {
        padding: `${n.paddingTop}px ${n.paddingRight}px ${n.paddingBottom}px ${n.paddingLeft}px`,
      }),
      sizing: {
        horizontal: n.layoutSizingHorizontal?.toLowerCase(),
        vertical: n.layoutSizingVertical?.toLowerCase(),
      },
      ...(n.width && {
        dimensions: {
          width: n.width,
          height: n.height,
        },
      }),
    });
    node.layout = layoutKey;
  }

  if (n.children) {
    node.children = n.children
      .map((child) => parseNode(child, globalVars))
      .filter((n): n is SimplifiedNode => n !== null);
  }

  return node;
}