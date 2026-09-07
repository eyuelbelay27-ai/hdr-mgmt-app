import { PrismaClient } from "@prisma/client";
import { runSeed } from "../lib/seed-data";

const prisma = new PrismaClient();

runSeed(prisma)
  .then(({ usersSeeded, materialsSeeded }) => {
    console.log(`Seeded ${usersSeeded} users and ${materialsSeeded} materials.`);
    console.log(
      "Dev-default seed passwords are placeholders — override via the SEED_*_PASSWORD env vars before seeding a real environment."
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
