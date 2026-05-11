import { OAuth2Client } from "google-auth-library";
import "dotenv/config";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const SCOPES = [ "openid", "email", "profile"];

function getEnv(name: string): string {
    const v = process.env[name];
    if(!v) {
        throw new Error(`${name}_NOT_CONFIGURED`);
    }
    return v;
}

/** Google OAuth redirect URI — dùng GOOGLE_CALLBACK_URL hoặc GOOGLE_REDIRECT_URI (tên cũ). */
function getGoogleRedirectUri(): string {
    const v = process.env.GOOGLE_CALLBACK_URL ?? process.env.GOOGLE_REDIRECT_URI;
    if (!v) {
        throw new Error("GOOGLE_CALLBACK_URL_NOT_CONFIGURED");
    }
    return v;
}

export function buildGoogleAuthorizeUrl(state: string): string {
    const clientId = getEnv("GOOGLE_CLIENT_ID");
    const redirectUri = getGoogleRedirectUri();

    const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
    });

    return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

export interface GoogleUserFromOAuth {
    sub: string;
    email: string;
    name: string;
    picture? : string;
}

export async function exchangeCodeForUser(
    code: string
): Promise<GoogleUserFromOAuth> {
    const clientId = getEnv("GOOGLE_CLIENT_ID");
    const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
    const redirectUri = getGoogleRedirectUri();

    const body = new URLSearchParams({
        code, 
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    if(!res.ok) {
        throw new Error('GOOGLE_TOKEN_EXCHANGE_FAILED');
    }

    const json = (await res.json()) as { id_token?:  string };
    if(!json.id_token) {
        throw new Error('GOOGLE_NO_ID_TOKEN');
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
        idToken: json.id_token,
        audience: clientId,
    });

    const p = ticket.getPayload();
    if(!p?.sub || !p.email || p.email_verified !== true) {
        throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
    }

    const emailLower = p.email.toLowerCase();
    const nameFromEmail = emailLower.includes("@")
        ? emailLower.slice(0, emailLower.indexOf("@"))
        : emailLower;

    return {
        sub: p.sub,
        email: emailLower,
        name: (p.name && p.name.trim()) || nameFromEmail,
        ...(p.picture ? { picture: p.picture } : {}),
    };
}