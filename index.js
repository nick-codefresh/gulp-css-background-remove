'use strict';

var gutil = require('gulp-util');
var path = require('path');
var through = require('through2');
var css = require('css');
var fs = require('fs');
var extend = require('util')._extend;
var File = require('vinyl');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');

module.exports = function (opts) {
  opts = extend({
    filename: 'image.css',
    dest: '',
    writeImagesFile: true,
    regex: /.*(url\((["|']?.+["|']?)?\))+.*/g
  }, opts);

  var imagesContent;
  var throughObj = through.obj(function (file, enc, cb) {
    if (file.isNull()) {
      cb(null, file);
      return;
    }

    if (file.isStream()) {
      cb(new gutil.PluginError('gulp-css-background-remove', 'Streaming not supported'));
      return;
    }

    var cssObject = css.parse(file.contents.toString());
    var backgroundProperties = [
      'background',
      'background-image'
    ];

    // Default stylesheets as objects to parse with css
    var stylesheets = {

      // Image rules
      images: {
        type: 'stylesheet',
        stylesheet: {
          rules: [],
          parsingErrors: []
        }
      },

      // Rules without images
      rules: {
        type: 'stylesheet',
        stylesheet: {
          rules: [],
          parsingErrors: []
        }
      }
    };

    // Search regex to separate out elements
    var regex = opts.regex;

    // Empty stylesheet or broken
    if (!cssObject.stylesheet || !cssObject.stylesheet.rules) {
      cb(new gutil.PluginError('gulp-css-background-remove', 'Empty or broken stylesheet'));
      return;
    }

    // For each rule we find out if it's a image
    cssObject.stylesheet.rules.forEach(function (element) {
      var declaration;

      // Copy element
      var rule = JSON.parse(JSON.stringify(element));

      // Check if it has image content
      var hasImage = false;
      var shouldBeRemoved = [];
      var isDeclarationsReset = false;

      for (declaration in element.declarations) {
        var isBackgroundProp = element.declarations[declaration].property && element.declarations[declaration].property.indexOf('background') === 0;

        if (backgroundProperties.indexOf(element.declarations[declaration].property) > -1 || isBackgroundProp) {
          if (!hasImage) {
            hasImage = element.declarations[declaration].value.match(regex) !== null;
          }
          if (hasImage || isBackgroundProp) {

            if (!isDeclarationsReset) {
              rule.declarations = [];
              isDeclarationsReset = true;
            }

            rule.declarations.push(element.declarations[declaration]);
            shouldBeRemoved.push(element.declarations[declaration]);
          }
        }
      }

      // If it's an image we push the rule to the special set
      if (hasImage) {
        shouldBeRemoved.forEach(function(declaration) {
          var index = element.declarations.indexOf(declaration);
          element.declarations.splice(index, 1);
        });

        stylesheets.images.stylesheet.rules.push(rule);
      }

      stylesheets.rules.stylesheet.rules.push(element);
    });

    stylesheets.rules = css.stringify(stylesheets.rules);
    stylesheets.images = css.stringify(stylesheets.images);

    // Write images file
    if (opts.writeImagesFile) {
      fs.writeFileSync(
        path.join(opts.dest, opts.filename),
        stylesheets.images
      );
    }
    imagesContent = stylesheets.images;

    // Return rules file
    file.contents = new Buffer(stylesheets.rules);

    setImmediate(cb, null, file);
  });
  return extend(throughObj, {
    images: function (callback) {
      throughObj.on('finish', function () {
        var imagesFile = new File({
          contents: new Buffer(imagesContent)
        });

        callback(
          imagesFile
            .pipe(source(opts.filename))
            .pipe(buffer())
        );
      });
      return throughObj;
    }
  });
};
