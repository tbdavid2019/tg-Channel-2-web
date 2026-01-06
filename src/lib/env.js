export function getEnv(env, Astro, name) {
  const value = env[name] ?? Astro.locals?.runtime?.env?.[name] ?? (typeof process !== 'undefined' ? process.env?.[name] : undefined)
  
  if (typeof value === 'string') {
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1)
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1)
    }
  }
  return value
}
