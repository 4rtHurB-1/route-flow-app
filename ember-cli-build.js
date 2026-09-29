'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
    let app = new EmberApp(defaults, {
        storeConfigInMeta: false,
        tests: false,

        babel: {
            plugins: [require.resolve('ember-auto-import/babel-plugin')],
        },

        'ember-bootstrap': {
            bootstrapVersion: 4,
            importBootstrapCSS: false,
            include: [
                'bs-form',
                'bs-navbar',
                'bs-button',
                'bs-spinner',
                'bs-dropdown',
                'bs-modal',
                'bs-tooltip'
            ],
        },

        'ember-power-select': {
            theme: 'bootstrap',
        },

        'asset-cache': {
            lenientErrors: true,
            include: [
                'assets/*',
                '../images/**/*',
                '../images/*',
                'manifest/**/*',
                'manifest/*',
                'translations/*'
            ]
        },
    });

    // Use `app.import` to add additional libraries to the generated
    // output files.
    //
    // If you need to use different assets in different
    // environments, specify an object as the first parameter. That
    // object's keys should be the environment name and the values
    // should be the asset to use in that environment.
    //
    // If the library that you are including contains AMD or ES6
    // modules that you would like to import into your application
    // please specify an object with the list of modules as keys
    // along with the exports of each module as its value.

    //app.import('vendor/qr-scanner-worker.min.js', { outputFile: 'assets/qr-scanner-worker.min.js' });
    //app.import('vendor/qr-scanner.min.js', { outputFile: 'assets/qr-scanner.min.js' });

    return app.toTree();
};
