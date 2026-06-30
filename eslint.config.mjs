import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".sst/**",
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "sst-env.d.ts"
    ]
  },
  ...nextVitals,
  ...nextTypeScript
];

export default eslintConfig;
