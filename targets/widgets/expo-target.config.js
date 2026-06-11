/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'Spending',
  deploymentTarget: '17.0',
  colors: {
    $widgetBackground: '#000000',
    $accent: '#FFFFFF',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.justin.expensetracker'],
  },
};
