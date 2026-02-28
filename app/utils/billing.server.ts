import prisma from "../db.server";

export const isTestStore = async (shopDomain: string): Promise<boolean> => {
  const adminStore = await prisma.adminStore.findUnique({
    where: { name: shopDomain },
  });
  return adminStore !== null;
};
