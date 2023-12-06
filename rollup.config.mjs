import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default [{
	input: 'src/TooltipsV2.ts',
	plugins: [ typescript() ],
	output: [{
		name: 'GW2TooltipsV2',
		file: 'out/tooltips.min.js',
		format: 'iife',
		plugins: [ terser() ],
		sourcemap: true,
	}]
},{
	input: 'src/APICacheWorker.ts',
	plugins: [ typescript() ],
	output: [{
		name: 'GW2APICacheWorker',
		file: 'out/worker.min.js',
		format: 'iife',
		plugins: [ terser() ],
		sourcemap: true,
	}]
}]