import { forbidden } from "@/lib/partner/server";

// Anything else under /api/partner: 403.
export const GET = async () => forbidden();
export const POST = async () => forbidden();
export const PUT = async () => forbidden();
export const PATCH = async () => forbidden();
export const DELETE = async () => forbidden();
