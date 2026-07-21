import { Prisma } from "@prisma/client";
import prisma from "../db.server";
import type {
  CustomAttribute,
  PropertyTemplate,
  TemplateTarget,
} from "../types/draft-order";
import { isTemplateTarget } from "../types/draft-order";

const sanitizeProperties = (
  properties: CustomAttribute[],
): Prisma.InputJsonValue =>
  (properties || [])
    .map((p) => ({ key: (p.key || "").trim(), value: (p.value || "").trim() }))
    .filter((p) => p.key !== "") as unknown as Prisma.InputJsonValue;

const serialize = (record: {
  id: string;
  name: string;
  target: TemplateTarget;
  properties: unknown;
}): PropertyTemplate => ({
  id: record.id,
  name: record.name,
  // The enum keeps the column honest, but the templates page groups by target
  // and would silently drop a row with an unrecognized one — fall back instead.
  target: isTemplateTarget(record.target) ? record.target : "LINE_ITEM_PROPERTY",
  properties: Array.isArray(record.properties)
    ? (record.properties as CustomAttribute[])
    : [],
});

export async function listPropertyTemplates(
  shop: string,
  target?: TemplateTarget,
): Promise<PropertyTemplate[]> {
  const templates = await prisma.propertyTemplate.findMany({
    where: { shop, ...(target ? { target } : {}) },
    orderBy: { name: "asc" },
  });
  return templates.map(serialize);
}

export async function createPropertyTemplate(
  shop: string,
  name: string,
  target: TemplateTarget,
  properties: CustomAttribute[],
): Promise<PropertyTemplate> {
  const created = await prisma.propertyTemplate.create({
    data: {
      shop,
      name: name.trim(),
      target,
      properties: sanitizeProperties(properties),
    },
  });
  return serialize(created);
}

export async function updatePropertyTemplate(
  shop: string,
  id: string,
  name: string,
  target: TemplateTarget,
  properties: CustomAttribute[],
): Promise<PropertyTemplate | null> {
  const result = await prisma.propertyTemplate.updateMany({
    where: { id, shop },
    data: {
      name: name.trim(),
      target,
      properties: sanitizeProperties(properties),
    },
  });
  if (result.count === 0) return null;
  const updated = await prisma.propertyTemplate.findUnique({ where: { id } });
  return updated ? serialize(updated) : null;
}

export async function deletePropertyTemplate(
  shop: string,
  id: string,
): Promise<void> {
  await prisma.propertyTemplate.deleteMany({ where: { id, shop } });
}
