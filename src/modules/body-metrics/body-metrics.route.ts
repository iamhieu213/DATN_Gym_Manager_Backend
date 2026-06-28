import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { 
    getMemberHistory, 
    createMetric, 
    updateMetric, 
    deleteMetric 
} from "./body-metrics.controller";

const router = Router();

router.use(authMiddleware);

router.get("/history", getMemberHistory); // Thay đổi thành /history
router.post("/", createMetric);                  
router.patch("/:id", updateMetric);              
router.delete("/:id", deleteMetric);            

export default router;