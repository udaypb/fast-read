declare module 'vanta/dist/*' {
  const vantaEffect: (options: Record<string, unknown>) => unknown;
  export default vantaEffect;
}
