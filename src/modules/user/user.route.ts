import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getAllUsers } from "./user.controller";
 
const router = Router();

router.get("/", authMiddleware, getAllUsers);

export default router;