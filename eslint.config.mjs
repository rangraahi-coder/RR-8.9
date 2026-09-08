import parser from '@typescript-eslint/parser';
import hooks from 'eslint-plugin-react-hooks';
import next from '@next/eslint-plugin-next';
// Functional lint gate. Type correctness is checked separately by tsc and next build.
export default [{ignores:['.next/**','node_modules/**','verification/**']},{
 files:['src/**/*.{ts,tsx}'],languageOptions:{parser,parserOptions:{ecmaVersion:'latest',sourceType:'module',ecmaFeatures:{jsx:true}}},
 plugins:{'react-hooks':hooks,'@next/next':next},
 rules:{'react-hooks/rules-of-hooks':'error','no-unreachable':'error','@next/next/no-head-element':'error'}
}];
