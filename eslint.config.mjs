import nextConfig from 'eslint-config-next';

export default [
  ...nextConfig,
  {
    // The new React 19 Compiler-oriented hook rules (purity,
    // set-state-in-effect, set-state-in-render) ship as errors with
    // eslint-plugin-react-hooks@7. Our existing code uses patterns they flag
    // (e.g. `useRef(Date.now())`, synchronous setState in effects) that work
    // fine at runtime but aren't Compiler-safe. Downgrade to warn until we
    // do a deliberate Compiler pass.
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
];
