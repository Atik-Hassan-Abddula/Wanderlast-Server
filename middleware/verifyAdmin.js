import verifyToken from "./verifyToken.js";

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    const userRole = req.user?.role;

    console.log("Logged-in user role:", userRole);

    if (userRole !== "admin") {
      return res.status(403).send({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  });
};

export default verifyAdmin;