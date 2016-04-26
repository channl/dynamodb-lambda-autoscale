try {
  var lambda = require('../build/index.js');

  var context = {
    succeed: function(data) {
      try {
        if (data) {
          console.log(JSON.stringify(data));
        }
      } catch (e) {
        console.error(e);
      }
    },
    fail: function(e) {
      console.error(e);
    }
  };

  var event = {};
  lambda.handler(event, context);

} catch (e) {
  console.error(e);
}
