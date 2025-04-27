require("dotenv").config({ path: "./config.env" });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require("path");
const stripe = require("stripe")(process.env.STRIPE_SERVER_KEY);

const { createProduct } = require("./controller/Product");
const productsRouter = require("./routes/Products");
const categoriesRouter = require("./routes/Categories");
const brandsRouter = require("./routes/Brands");
const usersRouter = require("./routes/Users");
const authRouter = require("./routes/Auth");
const cartRouter = require("./routes/Cart");
const ordersRouter = require("./routes/Order");
const { User } = require("./model/User");
const { Order } = require("./model/Order");
const { isAuth, sanitizeUser, cookieExtractor } = require("./services/common");

const server = express();

// --- Stripe Webhook (MUST come before express.json) ---
const endpointSecret = process.env.ENDPOINT_SECRET;

server.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      console.error(`Webhook Error: ${err.message}`);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle payment intent success
    if (event.type === "payment_intent.succeeded") {
      const paymentIntentSucceeded = event.data.object;
      try {
        const order = await Order.findById(
          paymentIntentSucceeded.metadata.orderId
        );
        if (order) {
          order.paymentStatus = "received";
          await order.save();
        }
      } catch (err) {
        console.error("Error updating order payment status", err);
      }
    } else {
      console.log(`Unhandled event type ${event.type}`);
    }

    response.status(200).send();
  }
);

// --- Middlewares (CORS, Cookie, Body Parsing) ---
server.use(
  cors({
    origin: [
      "https://our-culture-frontend-new.vercel.app",
      "http://localhost:3000",
    ],
    credentials: true,
    exposedHeaders: ["X-Total-Count"],
  })
);

server.use(cookieParser());

// Session must come before passport
server.use(
  session({
    secret: process.env.SESSION_KEY,
    resave: false,
    saveUninitialized: false,
  })
);

server.use(passport.initialize());
server.use(passport.session());

// Body Parser (AFTER webhook raw body)
server.use(express.json());

// Serve static files
server.use(express.static(path.resolve(__dirname, "build")));

// --- Routers ---
server.use("/auth", authRouter.router);
server.use("/products", isAuth(), productsRouter.router);
server.use("/categories", isAuth(), categoriesRouter.router);
server.use("/brands", isAuth(), brandsRouter.router);
server.use("/users", isAuth(), usersRouter.router);
server.use("/cart", isAuth(), cartRouter.router);
server.use("/orders", isAuth(), ordersRouter.router);

// Create Payment Intent (Stripe)
server.post("/create-payment-intent", async (req, res) => {
  const { totalAmount, orderId } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount * 100, // converting rupees to paise
      currency: "inr",
      automatic_payment_methods: { enabled: true },
      metadata: { orderId },
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Payment intent creation failed", err);
    res.status(500).send({ error: "Payment intent creation failed" });
  }
});

// Serve React App (For any other route)
server.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "build", "index.html"));
});

// --- Passport Strategies ---
// Local Strategy
passport.use(
  "local",
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }

        crypto.pbkdf2(
          password,
          user.salt,
          310000,
          32,
          "sha256",
          async (err, hashedPassword) => {
            if (err) return done(err);

            if (!crypto.timingSafeEqual(user.password, hashedPassword)) {
              return done(null, false, { message: "Invalid credentials" });
            }

            const token = jwt.sign(
              sanitizeUser(user),
              process.env.JWT_SECRET_KEY
            );
            return done(null, { id: user.id, role: user.role, token });
          }
        );
      } catch (err) {
        return done(err);
      }
    }
  )
);

// JWT Strategy
const opts = {
  jwtFromRequest: cookieExtractor,
  secretOrKey: process.env.JWT_SECRET_KEY,
};

passport.use(
  "jwt",
  new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      const user = await User.findById(jwt_payload.id);
      if (user) {
        return done(null, sanitizeUser(user));
      } else {
        return done(null, false);
      }
    } catch (err) {
      return done(err, false);
    }
  })
);

// Serialize and Deserialize
passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, { id: user.id, role: user.role });
  });
});

passport.deserializeUser((user, done) => {
  process.nextTick(() => {
    done(null, user);
  });
});

// --- Database Connection ---
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection error:", err);
  }
}

main();

// --- Start Server ---
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
