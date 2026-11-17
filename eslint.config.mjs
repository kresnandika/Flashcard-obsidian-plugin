import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["main.js", "node_modules/**", "coverage/**"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.ts"],
		rules: {
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
			"@typescript-eslint/consistent-type-imports": "error",
			"no-console": ["warn", { allow: ["warn", "error"] }],
			eqeqeq: ["error", "smart"],
		},
	},
);
