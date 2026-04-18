module.exports = {
  plugins: [
    require('postcss-preset-env')({
      stage: 1, // Enforces modern specifications across all browsers
      features: {
        'nesting-rules': true,      // In case any nesting crept in
        'custom-properties': false, // Preserve CSS variables natively
      }
    }),
    require('autoprefixer')() // Adds structural prefixes (-webkit-, -moz-) for older iOS/safari displays
  ]
};
