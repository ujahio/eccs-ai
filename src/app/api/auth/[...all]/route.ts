import { toNextJsHandler } from "better-auth/next-js";
import { authHandler } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(authHandler);
