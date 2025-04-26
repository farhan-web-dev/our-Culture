const { MongoClient } = require("mongodb");
const fs = require("fs");

async function importData() {
  const client = await MongoClient.connect("mongodb://localhost:27017", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = client.db("E-commerce"); // Replace with your desired DB name
  await db.dropDatabase();

  const data = JSON.parse(fs.readFileSync("data.json", "utf-8"));

  for (const [collectionName, documents] of Object.entries(data)) {
    if (Array.isArray(documents)) {
      const result = await db.collection(collectionName).insertMany(documents);
      console.log(
        `✅ Inserted ${result.insertedCount} documents into "${collectionName}"`
      );
    }
  }

  await client.close();
  console.log("✅ Done.");
}

importData().catch(console.error);
