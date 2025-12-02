import app from "./firebase-config.js";
import { monitorAuthState } from "./auth.js";
import { setupSalaReserva } from "./firebase-script-base.js";

const SALA_ID = "principal";
const CACHE_KEY = "reservasCache";

const salaReserva = setupSalaReserva({
  app,
  salaId: SALA_ID,
  cacheKey: CACHE_KEY,
  monitorAuthState,
  customUI: {
    // Adicione hooks ou funções específicas da tela principal, se necessário
  },
});

// Exemplo de uso:
// salaReserva.verificarLimiteReservas();
