declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

/** Vite ?raw query — returns the file's contents as a string at build time. */
declare module '*?raw' {
  const src: string;
  export default src;
}
