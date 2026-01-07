export function getEnv(env, Astro, name) {
  const value = (typeof process !== 'undefined' ? process.env?.[name] : undefined) ?? Astro.locals?.runtime?.env?.[name] ?? env[name]
  
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
