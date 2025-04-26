// middleware/isAuth.js
module.exports = function isAuth() {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    try {
      // Optionally use jwt.verify() to decode and verify token
      // const user = jwt.verify(token, process.env.JWT_SECRET);
      // req.user = user;

      // TEMP: allow through
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
    }
  };
};
