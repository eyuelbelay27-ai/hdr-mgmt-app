import { PrismaClient, Role, ItemCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildPermSet } from "../lib/permissions";

const prisma = new PrismaClient();

/**
 * Seeds the same accounts as the prototype (Section 4.5 brief / USERS_SEED
 * in the prototype), but with real bcrypt hashes instead of a plaintext
 * password list — Section 10 explicitly says not to carry the prototype's
 * demo passwords into production. Passwords come from env vars so a real
 * deployment can seed with real secrets instead of these dev defaults.
 */
const USERS_SEED: { username: string; name: string; role: Role; passwordEnv: string; fallback: string }[] = [
  { username: "bereket", name: "Bereket", role: Role.Admin, passwordEnv: "SEED_ADMIN_PASSWORD", fallback: "change-me-admin" },
  { username: "eyuel", name: "Eyuel", role: Role.OwnerFinance, passwordEnv: "SEED_OWNER_FINANCE_PASSWORD", fallback: "change-me-owner" },
  { username: "netsi", name: "Netsi", role: Role.Designer, passwordEnv: "SEED_DESIGNER_PASSWORD", fallback: "change-me-designer" },
  { username: "yonas", name: "Yonas", role: Role.Manager, passwordEnv: "SEED_MANAGER_PASSWORD", fallback: "change-me-manager" },
  { username: "dawit", name: "Dawit", role: Role.Supervisor, passwordEnv: "SEED_SUPERVISOR_PASSWORD", fallback: "change-me-supervisor" },
];

function matSeed(over: {
  name: string;
  category: ItemCategory;
  unit: string;
  rate?: number | null;
  active?: boolean;
  defaultQty?: number | null;
  notes?: string;
}) {
  return {
    active: true,
    defaultQty: null,
    notes: "",
    ...over,
  };
}

// Seeded from the real Hadar Sign Shop price list (brief Section 4.2 /
// prototype SIGNAGE_MATERIALS_SEED). Items with no confirmed price are
// left inactive rather than guessed, per the business owner's instruction.
const MATERIALS_SEED = [
  matSeed({ name: "Mica", category: ItemCategory.cash, unit: "Kare", rate: 5000 }),
  matSeed({ name: "Transparent Mica 8mm", category: ItemCategory.cash, unit: "Kare", rate: 15000 }),
  matSeed({ name: "Color Board", category: ItemCategory.cash, unit: "Kare", rate: 8000 }),
  matSeed({ name: "LED Module", category: ItemCategory.cash, unit: "pc", rate: 27 }),
  matSeed({ name: "LED Strip", category: ItemCategory.cash, unit: "m", rate: 500 }),
  matSeed({ name: "Foam 20mm", category: ItemCategory.cash, unit: "Kare", rate: 4500 }),
  matSeed({ name: "Foam 10mm", category: ItemCategory.cash, unit: "Kare", rate: 3500 }),
  matSeed({ name: "Foam 5mm", category: ItemCategory.cash, unit: "Kare", rate: 3000 }),
  matSeed({ name: "Aluminum Service", category: ItemCategory.cash, unit: "Kare", rate: 600 }),
  matSeed({ name: "Metal", category: ItemCategory.cash, unit: "Berga", rate: 1650 }),
  matSeed({ name: "Aluminum Panel 3.50", category: ItemCategory.cash, unit: "pc", rate: 14000 }),
  matSeed({ name: "Aluminum Panel 2.44", category: ItemCategory.cash, unit: "pc", rate: 12000 }),
  matSeed({ name: "Power Supply 60W", category: ItemCategory.cash, unit: "pc", rate: 1800 }),
  matSeed({
    name: "Wire",
    category: ItemCategory.stock,
    unit: "m",
    rate: 58.46,
    notes: "Price derived from source worked example (8 × 58.46 = 467.68 ETB).",
  }),
  matSeed({
    name: "Adapter",
    category: ItemCategory.stock,
    unit: "pc",
    rate: 800,
    notes: "Price derived from source worked example (2 × 800 = 1,600 ETB).",
  }),
  matSeed({
    name: "Amir",
    category: ItemCategory.stock,
    unit: "",
    rate: null,
    active: false,
    defaultQty: 1.3,
    notes: "Default quantity given in source; unit price not confirmed.",
  }),
  matSeed({
    name: "Mebeyeya Electrode",
    category: ItemCategory.stock,
    unit: "pc",
    rate: null,
    active: false,
    defaultQty: 5,
    notes: "Default quantity given in source; unit price not confirmed.",
  }),
  ...[
    "Socket", "Neon Transparent Wire", "Small Chain", "Bigger Chain", "Screw", "Fisher",
    "Jumper", "Angle Bar", "Anchor Bolt", "Hook", "Paint", "Power Supplies (other)",
    "UV Print", "UV Board", "Clad / Alucobond", "Transparent Sticker", "Transport",
    "Footing", "Scaffolding", "Spacer", "Relief", "Transparent Mica 3mm", "Clad Relief",
    "Engraving", "Rollup", "Metal 60", "Mesh Sticker", "White Sticker", "Frosted Sticker",
    "MDF", "Mica Service", "Lid", "Banner", "Service", "Mesh",
  ].map((name) =>
    matSeed({
      name,
      category: ItemCategory.stock,
      unit: "",
      rate: null,
      active: false,
      notes: "Price not confirmed in source — update in Price Database.",
    })
  ),
];

async function main() {
  for (const u of USERS_SEED) {
    const password = process.env[u.passwordEnv] || u.fallback;
    const passwordHash = await bcrypt.hash(password, 12);
    const { actions, actionViews, pages, tabs } = buildPermSet(u.role);

    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        name: u.name,
        role: u.role,
        passwordHash,
        actions,
        actionViews,
        pages,
        tabs,
      },
    });
  }

  for (const m of MATERIALS_SEED) {
    const existing = await prisma.material.findFirst({ where: { name: m.name } });
    if (!existing) {
      await prisma.material.create({ data: m });
    }
  }

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  console.log(`Seeded ${USERS_SEED.length} users and ${MATERIALS_SEED.length} materials.`);
  console.log("Dev-default seed passwords are placeholders — override via the SEED_*_PASSWORD env vars before seeding a real environment.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
