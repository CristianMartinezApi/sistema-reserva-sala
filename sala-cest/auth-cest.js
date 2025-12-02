import app from "../firebase-config.js";
import { createAuthHelpers } from "../auth.js";

export const { login, loginWithGoogle, logout, monitorAuthState } =
  createAuthHelpers(app);
