import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { UserService } from "./user.service";
import { prisma } from "../../config/client";
import { ListUserQueryDto } from "./user.dto";
import { UserRepository } from "./user.repository";

const userService = new UserService(new UserRepository(prisma));

const mapErrorStatus = (code: string): number => {
    switch (code) {
      case "FORBIDDEN":
        return 403;
      default:
        return 500;
    }
  };

export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        if(!req.user?.userId || !req.user?.role) {
            return res.status(401).json({ error: "UNAUTHORIZED" });
        }

        const result = await userService.getAllUsers(req.user.role, req.query as ListUserQueryDto);
        res.status(200).json({
            result,
        });
        
    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code });
    }
}