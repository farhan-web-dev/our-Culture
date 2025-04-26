const mongoose = require("mongoose");
const crypto = require("crypto");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: Buffer, required: true },
    role: { type: String, required: true, default: "user" },
    addresses: { type: [Schema.Types.Mixed] },
    name: { type: String },
    salt: Buffer,
    resetPasswordToken: { type: String, default: "" },
  },
  { timestamps: true }
);

// Pre-save hook to hash password before saving the user
userSchema.pre("save", function (next) {
  if (this.isModified("password") || this.isNew) {
    // Only hash if password is new or modified
    const salt = crypto.randomBytes(16).toString("hex"); // Generate a salt
    crypto.pbkdf2(
      this.password.toString(),
      salt,
      310000,
      32,
      "sha256",
      (err, hashedPassword) => {
        if (err) {
          return next(err); // Pass error to next callback
        }
        this.password = hashedPassword; // Set hashed password
        this.salt = Buffer.from(salt); // Store the salt
        next(); // Proceed to save the user
      }
    );
  } else {
    next(); // If password wasn't modified, just save the user
  }
});

// Virtual field to expose _id as id
const virtual = userSchema.virtual("id");
virtual.get(function () {
  return this._id;
});

userSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  },
});

exports.User = mongoose.model("User", userSchema);
