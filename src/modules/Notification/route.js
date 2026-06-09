const router = require("express").Router();
const controller = require("./controller");
const { protect } = require("../Middleware/authMiddleware");

console.log("controller:", controller);

router.post(
    "/send-all",
    protect,
    controller.sendToAllUsers
);


module.exports = router;