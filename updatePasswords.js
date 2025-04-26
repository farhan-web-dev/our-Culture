const mongoose = require("mongoose");
const crypto = require("crypto");
const { User } = require("./model/User"); // Adjust this path to your User model file

mongoose
  .connect("mongodb://localhost:27017/E-commerce", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

// Function to update passwords for all users
const updateUserPasswords = async () => {
  try {
    const users = await User.find({}); // Find all users

    for (const user of users) {
      if (user.password && !user.salt) {
        const salt = crypto.randomBytes(16).toString("hex");
        crypto.pbkdf2(
          user.password.toString(),
          salt,
          310000,
          32,
          "sha256",
          async (err, hashedPassword) => {
            if (err) {
              console.error(
                `Error hashing password for user ${user.email}`,
                err
              );
              return;
            }

            user.password = hashedPassword;
            user.salt = Buffer.from(salt);
            await user.save();
            console.log(`Updated password for user: ${user.email}`);
          }
        );
      }
    }

    console.log("Password update process completed");
  } catch (err) {
    console.error("Error updating user passwords", err);
  }
};

// Execute the function to update passwords
updateUserPasswords();
