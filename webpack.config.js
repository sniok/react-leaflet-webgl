const path = require('path')

module.exports = {
  entry: './src/index.js',
  output: {
    library: 'Leaflet-webgl',
    libraryTarget: 'umd',
    filename: 'index.js',
    path: path.resolve(__dirname, 'lib'),
    umdNamedDefine: false
  },
  module: {
    rules: [{ test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader' }],
  },
  externals: [
    {
      leaflet: {
        amd: 'leaflet',
        commonjs: 'leaflet',
        commonjs2: 'leaflet',
        root: 'L'
      }
    },
    {
      'leaflet-draw': {
        amd: 'leaflet-draw',
        commonjs: 'leaflet-draw',
        commonjs2: 'leaflet-draw',
        root: 'L'
      }
    },
    {
      'react-leaflet': {
        amd: 'react-leaflet',
        commonjs: 'react-leaflet',
        commonjs2: 'react-leaflet'
      }
    },
    {
      react: {
        amd: 'react',
        commonjs: 'react',
        commonjs2: 'react',
        root: 'React'
      }
    }
  ]
}
