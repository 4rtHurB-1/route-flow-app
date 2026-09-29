'use strict';

module.exports = {
    singleQuote: true,
    tabWidth: 4,
    printWidth: 120,
    overrides: [
        {
            files: '*.hbs',
            options: {
                singleQuote: false,
                tabWidth: 4,
            },
        },
    ],
};
