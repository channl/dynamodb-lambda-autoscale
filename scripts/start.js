try {
  var lambda = require('../dist/index.js');

  process.chdir('./dist');

  var context = {
    succeed: function(data) {
      try {
        if (data) {
          console.log(JSON.stringify(data));
        }
      } catch (e) {
        console.log(e.stack);
        console.error(e);
      }
    },
    fail: function(e) {
      console.log(e.stack);
      console.error(e);
    }
  };

  var event = {
    json: { padding: 2 }
  };

  lambda.handler(event, context);

} catch (e) {
  console.log(e.stack);
  console.error(e);
}
