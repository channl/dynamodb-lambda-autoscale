var gulp = require("gulp");
var del = require('del');
var rename = require('gulp-rename');
var install = require('gulp-install');
var zip = require('gulp-zip');
var uglify = require('gulp-uglify');
var AWS = require('aws-sdk');
var fs = require('fs');
var runSequence = require('run-sequence');
var webpack = require('webpack-stream');

// First we need to clean out the dist folder and remove the compiled zip file.
gulp.task('clean', function(cb) {
  del('./dist');
  cb();
});

gulp.task("webpack", function () {
  return gulp.src('src/Index.js')
  .pipe(webpack( require('./webpack-dev.config.js') ))
  .pipe(gulp.dest('build/'));
});

// The js task could be replaced with gulp-coffee as desired.
gulp.task("js", function () {
  return gulp
    .src("build/Index.js")
    .pipe(gulp.dest("dist/"));
});

// Here we want to install npm packages to dist, ignoring devDependencies.
gulp.task('npm', function() {
  return gulp
    .src('./package.json')
    .pipe(gulp.dest('./dist/'))
    .pipe(install({production: true}));
});

// Next copy over environment variables managed outside of source control.
gulp.task('env', function() {
  return gulp
    .src('./config.env.production')
    .pipe(rename('.env'))
    .pipe(gulp.dest('./dist'));
});

// Now the dist directory is ready to go. Zip it.
gulp.task('zip', function() {
  return gulp
    .src(['dist/**/*', '!dist/package.json', 'dist/.*'])
    .pipe(zip('dist.zip'))
    .pipe(gulp.dest('./'));
});

// Per the gulp guidelines, we do not need a plugin for something that can be
// done easily with an existing node module. #CodeOverConfig
//
// Note: This presumes that AWS.config already has credentials. This will be
// the case if you have installed and configured the AWS CLI.
//
// See http://aws.amazon.com/sdk-for-node-js/
gulp.task('upload', function() {

  // TODO: This should probably pull from package.json
  AWS.config.region = 'us-east-1';
  var lambda = new AWS.Lambda();
  var functionName = 'video-events';

  lambda.getFunction({FunctionName: functionName}, function(err, data) {
    if (err) {
      if (err.statusCode === 404) {
        var warning = 'Unable to find lambda function ' + deploy_function + '. '
        warning += 'Verify the lambda function name and AWS region are correct.'
        gutil.log(warning);
      } else {
        var warning = 'AWS API request failed. '
        warning += 'Check your AWS credentials and permissions.'
        gutil.log(warning);
      }
    }

    // This is a bit silly, simply because these five parameters are required.
    var current = data.Configuration;
    var params = {
      FunctionName: functionName,
      Handler: current.Handler,
      Mode: current.Mode,
      Role: current.Role,
      Runtime: current.Runtime
    };

    fs.readFile('./dist.zip', function(err, data) {
      params['FunctionZip'] = data;
      lambda.uploadFunction(params, function(err, data) {
        if (err) {
          var warning = 'Package upload failed. '
          warning += 'Check your iam:PassRole permissions.'
          gutil.log(warning);
        }
      });
    });
  });
});

// The key to deploying as a single command is to manage the sequence of events.
gulp.task('dist', function(cb) {
  return runSequence(
    ['clean'],
    ['webpack'],
    ['js', 'npm', 'env'],
    ['zip'],
//    ['upload'],
    function (err) {
      //if any error happened in the previous tasks, exit with a code > 0
      if (err) {
        cb(err);
        var exitCode = 2;
        console.log('[ERROR] gulp build task failed', err);
        console.log('[FAIL] gulp build task failed - exiting with code ' + exitCode);
        return process.exit(exitCode);
      }
      else {
        return cb();
      }
    }
  );
});
