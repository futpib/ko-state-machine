
module.exports = {
	entry: './index.js',
	output: {
		library: {
			root: 'KoStateMachine',
			amd: 'ko-state-machine',
			commonjs: 'ko-state-machine'
		},
		filename: './browser.js',
		libraryTarget: 'umd'
	},
	externals: {
		knockout: {
			commonjs: 'knockout',
			commonjs2: 'knockout',
			amd: 'knockout',
			root: 'ko'
		},
		lodash: {
			commonjs: 'lodash',
			commonjs2: 'lodash',
			amd: 'lodash',
			root: '_'
		}
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /(node_modules|bower_components)/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['env']
					}
				}
			}
		]
	}
};
