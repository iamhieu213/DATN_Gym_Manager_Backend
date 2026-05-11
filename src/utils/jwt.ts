import jwt, { type SignOptions } from "jsonwebtoken";
import "dotenv/config";
import { UserRole } from "@prisma/client";

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ??
  "15m") as NonNullable<SignOptions["expiresIn"]>;

const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ??
  "7d") as NonNullable<SignOptions["expiresIn"]>;

function requireEnv(value: string | undefined, errorCode: string): string {
  if (!value) {
    throw new Error(errorCode);
  }
  return value;
}

function getAccessSecret(): string {
  return requireEnv(JWT_ACCESS_SECRET, "JWT_ACCESS_SECRET_NOT_CONFIGURED");
}

function getRefreshSecret(): string {
  return requireEnv(JWT_REFRESH_SECRET, "JWT_REFRESH_SECRET_NOT_CONFIGURED");
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), {
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getAccessSecret()) as jwt.JwtPayload &
    Partial<AccessTokenPayload>;

  if (typeof decoded.userId !== "string" || typeof decoded.role !== "string") {
    throw new Error("INVALID_ACCESS_TOKEN_PAYLOAD");
  }

  return {
    userId: decoded.userId,
    role: decoded.role as UserRole,
  };
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, getRefreshSecret(), {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, getRefreshSecret()) as jwt.JwtPayload &
    Partial<RefreshTokenPayload>;

  if (
    typeof decoded.userId !== "string" ||
    typeof decoded.tokenId !== "string"
  ) {
    throw new Error("INVALID_REFRESH_TOKEN_PAYLOAD");
  }

  return {
    userId: decoded.userId,
    tokenId: decoded.tokenId,
  };
}