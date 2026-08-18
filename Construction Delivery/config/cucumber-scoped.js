module.exports = {
  default: {
    require: [
      'features/support/**/*.js',
      'features/step-definitions/**/*.js'
    ],
    publishQuiet: true,
    parallel: 0
  }
};
