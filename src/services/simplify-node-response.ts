import type { Node as FigmaDocumentNode, Paint, Vector } from "@figma/rest-api-spec";
import { processComponentData } from "./process-component-data.js";
import type { ComponentData } from "~/types/component.js";

// Type guards and utilities
const hasValue = <K extends string, T extends object>(key: K, obj: T, guard?: (val: any) => boolean): obj is T & Record<K, unknown> => {
  const val = (obj as any)[key];
  return val !== undefined && val !== null && (guard ? guard(val) : true);
};

const isVisible = (node: FigmaDocumentNode): boolean => {
  return node && (!hasValue("visible", node) || node.visible !== false);
};

const isRectangleCornerRadii = (val: unknown): val is number[] => {
  return Array.isArray(val) && val.length === 4 && val.every(v => typeof v === "number");
};

// Core types
export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlignHorizontal: string;
  textAlignVertical: string;
  textCase?: string;
};

export type SimplifiedFill = {
  type?: Paint["type"];
  hex?: string;
  rgba?: string;
  opacity?: number;
  imageRef?: string;
  scaleMode?: string;
  gradientHandlePositions?: Vector[];
  gradientStops?: Array<{
    position: number;
    color: string;
  }>;
};

export type SimplifiedStroke = {
  colors: string[];
  strokeWeight: string;
};

export type SimplifiedEffect = {
  boxShadow: string;
};

export type SimplifiedLayout = {
  mode: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  padding?: string;
  sizing: {
    horizontal?: string;
    vertical?: string;
  };
  dimensions?: {
    width: number;
    height: number;
  };
};

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
  textStyle?: string;
  fills?: string;
  styles?: Record<string, string>;
  strokes?: string;
  effects?: string;
  opacity?: number;
  borderRadius?: string;
  layout?: string;
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
    styles: Record<string, TextStyle | SimplifiedFill[] | SimplifiedStroke | SimplifiedEffect | SimplifiedLayout>;
  };
}

// Helper functions
function findOrCreateVar(
  globalVars: SimplifiedDesign["globalVars"],
  type: string,
  value: any
): string {
  // Check if the same value already exists
  const [existingVarId] =
    Object.entries(globalVars.styles).find(
      ([_, existingValue]) => JSON.stringify(existingValue) === JSON.stringify(value)
    ) ?? [];

  if (existingVarId) {
    return existingVarId;
  }

  // Create a new variable if it doesn't exist
  const key = `${type}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  globalVars.styles[key] = value;
  return key;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbaToString(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

// Main parsing functions
export function parseFigmaResponse(response: any): SimplifiedDesign {
  const { name, lastModified, thumbnailUrl, nodes } = response;
  const globalVars = { styles: {} };
  const parsedNodes: SimplifiedNode[] = [];

  for (const nodeId in nodes) {
    const node = nodes[nodeId].document;
    if (isVisible(node)) {
      const parsedNode = parseNode(node, globalVars);
      if (parsedNode) {
        parsedNodes.push(parsedNode);
      }
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

function parseNode(
  n: FigmaDocumentNode,
  globalVars: SimplifiedDesign["globalVars"]
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

  if (hasValue("characters", n)) {
    node.text = n.characters;
  }

  if (hasValue("style", n) && Object.keys(n.style).length) {
    const textStyle: TextStyle = {
      fontFamily: n.style.fontFamily,
      fontSize: n.style.fontSize,
      fontWeight: n.style.fontWeight,
      lineHeight: n.style.lineHeightPx,
      letterSpacing: n.style.letterSpacing,
      textAlignHorizontal: n.style.textAlignHorizontal,
      textAlignVertical: n.style.textAlignVertical,
      ...(n.style.textCase && { textCase: n.style.textCase }),
    };
    node.textStyle = findOrCreateVar(globalVars, "style", textStyle);
  }

  if (hasValue("fills", n) && Array.isArray(n.fills) && n.fills.length) {
    const fills: SimplifiedFill[] = n.fills.map(fill => {
      if (fill.type === "SOLID") {
        return {
          type: "SOLID",
          hex: rgbToHex(fill.color.r, fill.color.g, fill.color.b),
          opacity: fill.opacity,
        };
      }
      return {
        type: fill.type,
        imageRef: fill.imageRef,
        scaleMode: fill.scaleMode,
        opacity: fill.opacity,
        gradientHandlePositions: fill.gradientHandlePositions,
        gradientStops: fill.gradientStops?.map(stop => ({
          position: stop.position,
          color: rgbaToString(stop.color.r, stop.color.g, stop.color.b, stop.color.a),
        })),
      };
    });
    node.fills = findOrCreateVar(globalVars, "fill", fills);
  }

  if (hasValue("strokes", n) && Array.isArray(n.strokes) && n.strokes.length) {
    const stroke: SimplifiedStroke = {
      colors: n.strokes.map(stroke => rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b)),
      strokeWeight: `${n.strokeWeight}px`,
    };
    node.strokes = findOrCreateVar(globalVars, "stroke", stroke);
  }

  if (hasValue("effects", n) && Array.isArray(n.effects) && n.effects.length) {
    const effect: SimplifiedEffect = {
      boxShadow: n.effects
        .map(effect => `${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px 0px rgba(0, 0, 0, ${effect.color.a})`)
        .join(", "),
    };
    node.effects = findOrCreateVar(globalVars, "effect", effect);
  }

  if (n.styles) {
    node.styles = {};
    for (const [key, value] of Object.entries(n.styles)) {
      node.styles[key] = value.key;
    }
  }

  if (typeof n.opacity === "number" && n.opacity !== 1) {
    node.opacity = n.opacity;
  }

  if (hasValue("cornerRadius", n) && typeof n.cornerRadius === "number") {
    node.borderRadius = `${n.cornerRadius}px`;
  }
  if (hasValue("rectangleCornerRadii", n, isRectangleCornerRadii)) {
    node.borderRadius = `${n.rectangleCornerRadii[0]}px ${n.rectangleCornerRadii[1]}px ${n.rectangleCornerRadii[2]}px ${n.rectangleCornerRadii[3]}px`;
  }

  if (n.layoutMode) {
    const layout: SimplifiedLayout = {
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
    };
    node.layout = findOrCreateVar(globalVars, "layout", layout);
  }

  if (n.children) {
    node.children = n.children
      .filter(isVisible)
      .map(child => parseNode(child, globalVars))
      .filter((n): n is SimplifiedNode => n !== null);
  }

  return node;
}