export default defineEventHandler(async () => {
  return {
    ok: true,
    service: "activation-service",
    now: new Date().toISOString()
  };
});
