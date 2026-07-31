const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.user.createMany({
    data: [
      { name: "Anoop Kumar", phone: "9900011111", email: "anoop@example.com" },
      { name: "Divya Rao", phone: "9900022222", email: "divya@example.com" },
      { name: "Rahul Shetty", phone: "9900033333", email: "rahul@example.com" },
    ],
    skipDuplicates: true,
  });

  await prisma.responder.createMany({
    data: [
      { name: "Ambulance Unit 1", phone: "8800011111", vehicleType: "Ambulance", latitude: 12.9141, longitude: 74.8560 },
      { name: "Ambulance Unit 2", phone: "8800022222", vehicleType: "Ambulance", latitude: 12.9200, longitude: 74.8500 },
      { name: "Fire Unit 1", phone: "8800033333", vehicleType: "Fire Truck", latitude: 12.9100, longitude: 74.8600 },
    ],
    skipDuplicates: true,
  });

  console.log("Seed data inserted.");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
