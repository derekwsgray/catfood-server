module.exports = {
    plugins: [
        'chai-friendly' // Makes exceptions for no-unused-expressions rule
    ],
    extends: 'eslint:recommended',
    env: {
        node: true,
        es6: true,
        mocha: true
    },
    globals: {
        rootRequire: true,
        testRequire: true,
        requireFresh: true,
        rootRequireFresh: true,
        testRequireFresh: true
    },
    parserOptions: {
        ecmaVersion: 9,
        sourceType: 'module',
    },
    rules: {
        'no-unused-vars': 1,
        'no-console': 1,
        'quotes': ['error', 'single'],
        'arrow-parens': ['warn', 'as-needed', {
            'requireForBlockBody': true
        }],
        'semi': ['error', 'always', {
            "omitLastInOneLineBlock": false
        }],
        'max-lines': ['error',{
            max: 500,
            skipBlankLines: true,
            skipComments: true
        }],
        'max-depth': ['warn', {
            max: 4
        }],
        'indent': 'error', // (default: 4 spaces, not tabs.)
        'keyword-spacing': ["error", {
            "before": true,
            "after": true
        }],
        'curly': 'error',
        'object-curly-spacing': ["error", "always"],
        'no-else-return': 'error',
        'block-spacing': 'error',
        'key-spacing': ['error', {
            'beforeColon': false,
            'mode': 'minimum'
        }],
        'lines-between-class-members': ['error', 'always'],
        'padded-blocks': ['error', {
            'classes': 'always'
        }],
        'no-nested-ternary': 'error',
        'no-var': 'error',
        'prefer-const': 'error',
        'no-path-concat': 'error',
        'array-bracket-spacing': ['error', 'never'],
        'eqeqeq': 'error',
        'no-template-curly-in-string': 'error',
        'no-await-in-loop': 'error',
        'require-await': 'error',
        //'no-magic-numbers': 'error', // Enable in another JIRA and also fix errors. Most are HTTP status codes, consider something like https://github.com/prettymuchbryce/node-http-status#readme
        'no-unused-expressions': 0, // Disable in favour of the chai-friendly version.
        'chai-friendly/no-unused-expressions': 'error',
        'max-lines-per-function': ['error', 75]
    },
    overrides: [
        {
            'files': ['test/**/*.js'],
            'rules': {
                'no-magic-numbers': 0,       // Too onerous to enforce in unit tests.
                'max-lines-per-function': 0  // Test often have big sample data line chunks in them.
            }
        }
    ]
};
