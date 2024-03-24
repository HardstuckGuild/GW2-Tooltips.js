import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import strip from 'rollup-plugin-strip-code';

const ts = typescript();
const strip_test_code = strip({ start_comment: '@TEST_ONLY_START', end_comment: '@TEST_ONLY_END' });
const minify = terser();

export default [{
	input: 'src/TooltipsV2.ts',
	plugins: [ strip_test_code, ts ],
	output: [{
		name: 'GW2TooltipsV2',
		file: 'out/tooltips.min.js',
		format: 'iife',
		plugins: [ minify ],
		sourcemap: true,
	}]
},{
	input: 'src/TooltipsV2.ts',
	plugins: [ ts ],
	output: [{
		name: 'GW2TooltipsV2',
		file: 'tests/tooltips.min.js',
		format: 'cjs',
		exports: 'named',
		plugins: [ minify ],
		sourcemap: true,
	}]
},{
	input: 'src/APICacheWorker.ts',
	plugins: [ strip_test_code, ts ],
	output: [{
		name: 'GW2APICacheWorker',
		file: 'out/worker.min.js',
		format: 'iife',
		plugins: [ minify ],
		sourcemap: true,
	}]
}]