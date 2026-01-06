export function getEnv(env, Astro, name) {
  const value = env[name] ?? Astro.locals?.runtime?.env?.[name]
  if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }
  return value
}
