/**
 * koa-surface
 * Version: 0.0.0
 * License: MIT
 */
'use strict';

/**
 * Dependencies
 */
var router = require('koa-router')
  , methods = require('methods')
  , fs = require('fs')
  , path = require('path');

/**
 * Expose
 */
module.exports = Surface;

/**
 * Surface Constructor.
 */
function Surface(app, option) {
  if (this instanceof Surface) {
    this.defaultSetting = {
      root: './lib',
      ctrl: 'controllers',
      model: 'models',
      format: 'json',
      multiple: false, // TODO Multiple routers
      pattern: {
        json: function(req, code, msg, data) {
          return {
            request: req,
            code: code,
            message: msg,
            data: data
          };
        },
        xml: function(req, code, msg, data) {
          return '<?xml version="1.0" encoding="utf-8" ?><response><request>' + req + '</request><code>' + code + '</code><message>' + msg + '</message><data>' + data + '</data></response>';
        }
      },
      routes: {
        'index': {
          method: 'get',
          path: ''
        },
        'new': {
          method: 'post',
          path: '/'
        },
        'get': {
          method: 'get',
          path: '/:id'
        },
        'update': {
          method: 'put',
          path: '/:id'
        },
        'del': {
          method: 'del',
          path: '/:id'
        }
      }
    };
  } else {
    var surface = new Surface();
    return surface.fn(app, option);
  }
}

var surface = Surface.prototype;

surface.fn = function(app, option) {
  var finalSetting = this.setting(option)
    , files = this.load('ctrl')
    , ctrl
    , path
    , routes
    ;


  if (finalSetting.multiple) {
    // TODO
  } else {
    app.use(router(app));
  }

  app.use(this.middleware());

  for (var file in files) {
    ctrl = require(files[file]);
    path = '/' + (ctrl.path || file.toLowerCase());
    routes = ctrl.routes || this.routes;

    for (var action in ctrl) {
      if (!!router(action)) {
        this.register(app, path, routes[action], ctrl[action]);
      }
    }
  }
  app.all('*', function *(next) {
    this.status = 404;
    yield next;
  });
};

surface.setting = function(option) {
  var defaultSetting = this.defaultSetting
    , finalSetting = this.finalSetting = {};
  for (var key in defaultSetting) {
    finalSetting[key] = option[key] || defaultSetting[key];
  }
  this.routes = finalSetting.routes;
  return finalSetting;
};

surface.middleware = function() {
  var surface = this;
  return function *API(next) {
    this.body = surface.api(this.body, this);
    yield next;
  };
};

/**
 * To parse ctx.body to the format which has been set.
 * 
 * @param  {ANY} data ctx.body
 * @param  {Object} ctx context object of koa
 * @return {JSON|XML}      formated data
 */
surface.api = function(data, ctx) {
  if (ctx.status === 200 && (data === undefined || data === null)) {
    ctx.status = 500;
    data = null;
  }
  return this.parse(this.finalSetting.format)(ctx.path, ctx.status, ctx.toJSON().response.string, data);
};

surface.register = function(app, path, routes, fn) {
  if (!!routes) {
    app[routes.method](path + routes.path, fn);
  }
};

surface.parse = function(format) {
  return this.finalSetting.pattern[format];
};

surface.load = function(components) {
  var dirPath = path.resolve(path.join(this.finalSetting.root, '/', this.finalSetting[components]))
    , files = fs.readdirSync(dirPath)
    , paths = {}
    ;

  files.forEach(function(file) {
    file = path.join(dirPath, '/', file);
    if (fs.statSync(file).isFile() && path.extname(file) == '.js') {
      paths[path.basename(file, '.js')] = file;
    }
  });
  return paths;
};