import Redis from "ioredis";
import "dotenv/config";

export class RedisService {
    private readonly enabled: boolean;
    private readonly prefix: string;
    private readonly client: Redis | null = null;

    constructor() {
        this.enabled = process.env.REDIS_ENABLED !== "false";
        this.prefix = process.env.REDIS_KEY_PREFIX ?? "hipu-hrm:dev:";

        if (!this.enabled) {
            console.warn("[Redis] Redis is disabled");
            return;
        }

        this.client = new Redis({
            host: process.env.REDIS_HOST ?? "localhost",
            port: Number(process.env.REDIS_PORT ?? 6379),
            password: process.env.REDIS_PASSWORD || undefined,
            db: Number(process.env.REDIS_DB ?? 0),
            maxRetriesPerRequest: 1,
            enableReadyCheck: true,
            lazyConnect: false,
        });

        this.client.on("connect", () => {
            console.log("[Redis] Redis connected successfully");
        });

        this.client.on("error", (err) => {
            console.error(`[Redis] Connection error: ${err.message}`);
        });
    }

    key(...parts: Array<string | number>) {
        return `${this.prefix}${parts.join(":")}`;
    }

    getClient() {
        if (!this.client) {
            throw new Error("Redis is disabled");
        }
        return this.client;
    }

    async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
        if (!this.client) return 1;

        const luaScript = `
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return current
        `;

        const result = await this.client.eval(luaScript, 1, key, ttlSeconds);
        return Number(result);
    }

    async getTtl(key: string) {
        if (!this.client) return -1;
        return this.client.ttl(key);
    }

    async get(key: string) {
        if (!this.client) return null;
        return this.client.get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number) {
        if (!this.client) return "OK";

        if (ttlSeconds) {
            return this.client.set(key, value, "EX", ttlSeconds);
        }
        return this.client.set(key, value);
    }

    async del(key: string) {
        if (!this.client) return 0;
        return this.client.del(key);
    }

    async acquireLock(key: string, ttlSeconds: number) {
        if (!this.client) return true;

        const result = await this.client.set(
            key,
            "1",
            "EX",
            ttlSeconds,
            "NX"
        );
        return result === "OK";
    }

    async releaseLock(key: string) {
        if (!this.client) return 0;
        return this.client.del(key);
    }

    async disconnect() {
        if (!this.client) return;
        try {
            await this.client.quit();
            console.log("[Redis] Connection closed gracefully");
        } catch (err) {
            console.error(`[Redis] Error closing connection: ${(err as Error).message}`);
        }
    }
}

export const redisService = new RedisService();
