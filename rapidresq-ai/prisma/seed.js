const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.user.createMany({
    data: [
      { name: "Anoop Kumar", phone: "9900011111", email: "anoop@example.com" },
      { name: "Divya Rao", phone: "9900022222", email: "divya@example.com" },
      { name: "Rahul Shetty", phone: "9900033333", email: "rahul@example.com" },
      { name: "Sneha Pai", phone: "9900044444", email: "sneha@example.com" },
      { name: "Vikram Nayak", phone: "9900055555", email: "vikram@example.com" },
      { name: "Priya Bhat", phone: "9900066666", email: "priya@example.com" },
    ],
    skipDuplicates: true,
  });

  await prisma.responder.createMany({
    data: [
      { name: "Ambulance Unit 1", phone: "8800011111", vehicleType: "Ambulance", latitude: 12.9141, longitude: 74.8560 },
      { name: "Ambulance Unit 2", phone: "8800022222", vehicleType: "Ambulance", latitude: 12.9200, longitude: 74.8500 },
      { name: "Ambulance Unit 3", phone: "8800077777", vehicleType: "Ambulance", latitude: 12.9250, longitude: 74.8450 },
      { name: "Fire Unit 1", phone: "8800033333", vehicleType: "Fire Truck", latitude: 12.9100, longitude: 74.8600 },
      { name: "Fire Unit 2", phone: "8800088888", vehicleType: "Fire Truck", latitude: 12.9180, longitude: 74.8620 },
      { name: "Police Patrol 1", phone: "8800099999", vehicleType: "Police Vehicle", latitude: 12.9160, longitude: 74.8530 },
      { name: "Police Patrol 2", phone: "8800010101", vehicleType: "Police Vehicle", latitude: 12.9220, longitude: 74.8480 },
    ],
    skipDuplicates: true,
  });

  console.log("Seed data inserted: 6 users, 7 responders.");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
